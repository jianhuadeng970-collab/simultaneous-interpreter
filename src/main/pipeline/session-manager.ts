import { LanguageCode, PipelineStatus, TranscriptUpdate, Direction } from '../../shared/types'
import { AsrResult, SessionEvents } from './types'
import { AsrService } from '../services/asr/asr-interface'
import { TranslationService } from '../services/translation/translation-interface'
import { TtsService } from '../services/tts/tts-interface'
import { LocalAsrService } from '../services/asr/local-asr'
import { LocalTranslationService } from '../services/translation/local-translation'
import { LocalTtsService } from '../services/tts/local-tts'
import { getSetting } from '../config/store'

/**
 * SessionManager orchestrates the full speech-to-speech pipeline:
 *
 *   Audio Input → VAD → ASR → Translation → TTS → Audio Output
 *
 * State machine: IDLE → LISTENING → PROCESSING → PLAYING → LISTENING ...
 *
 * Critical constraint: original microphone audio is NEVER played back.
 * Only translated TTS audio reaches the speakers.
 */
export class SessionManager {
  private asrService: AsrService
  private translationService: TranslationService
  private ttsService: TtsService

  private status: PipelineStatus = 'idle'
  private currentSourceLanguage: LanguageCode = 'zh'
  private currentTargetLanguage: LanguageCode = 'en'
  private direction: Direction = 'A->B'

  private events: SessionEvents | null = null
  private isRunning = false

  // Audio buffer for accumulating incoming PCM chunks
  private audioBuffer: Float32Array[] = []

  // Translation queue to handle sequential translations
  private translateQueue: Array<{ text: string; isInterim: boolean }> = []
  private isTranslating = false

  // TTS queue
  private ttsQueue: string[] = []
  private isPlaying = false

  // Language setting from config
  private languageA: LanguageCode = 'zh'
  private languageB: LanguageCode = 'en'

  constructor() {
    const settings = getSetting('languageA') || 'zh'
    const settingsB = getSetting('languageB') || 'en'
    this.languageA = settings as LanguageCode
    this.languageB = settingsB as LanguageCode

    // All models run locally — no API keys needed
    this.asrService = new LocalAsrService()
    this.translationService = new LocalTranslationService()
    this.ttsService = new LocalTtsService()
    console.log('[SessionManager] Using all-local pipeline (ASR + NLLB-200 + VITS/Piper)')

    // Set initial direction
    this.currentSourceLanguage = this.languageA
    this.currentTargetLanguage = this.languageB
  }

  /**
   * Register event callbacks from the IPC layer.
   */
  registerEvents(events: SessionEvents): void {
    this.events = events
  }

  /**
   * Start a new interpretation session.
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    this.status = 'idle'
    this.isRunning = true
    this.emitStatus('idle')

    try {
      await this.asrService.initialize(this.currentSourceLanguage)
      this.status = 'listening'
      this.emitStatus('listening')
    } catch (error) {
      this.emitError(`Failed to initialize ASR: ${error}`)
      this.stop()
    }
  }

  /**
   * Set the translation direction.
   * A->B: Person A speaking, translate to Person B's language
   * B->A: Person B speaking, translate to Person A's language
   */
  setDirection(direction: Direction): void {
    this.direction = direction

    if (direction === 'A->B') {
      this.currentSourceLanguage = this.languageA
      this.currentTargetLanguage = this.languageB
    } else {
      this.currentSourceLanguage = this.languageB
      this.currentTargetLanguage = this.languageA
    }

    // Update ASR language if running
    if (this.isRunning) {
      this.asrService.setLanguage(this.currentSourceLanguage)
    }

    // Clear any queued audio from the previous direction
    this.audioBuffer = []
    this.translateQueue = []
    this.ttsQueue = []
    this.isTranslating = false
    this.isPlaying = false

    console.log(
      `[SessionManager] Direction: ${direction} (${this.currentSourceLanguage} → ${this.currentTargetLanguage})`
    )
  }

  /**
   * Receive PCM audio data from the renderer process.
   * This is the entry point for microphone audio.
   * CRITICAL: This data is used ONLY for ASR — it is NEVER played back.
   */
  processAudioChunk(pcmData: Float32Array): void {
    if (!this.isRunning) return

    // Accumulate audio for VAD processing
    this.audioBuffer.push(pcmData)

    // Forward to ASR service
    const int16Buffer = this.float32ToInt16Buffer(pcmData)
    this.asrService.recognizeStream(
      int16Buffer,
      (result: AsrResult) => this.handleAsrResult(result),
      (error: Error) => this.emitError(`ASR error: ${error.message}`)
    )
  }

  /**
   * Called when the VAD detects the start of speech.
   */
  onSpeechStart(): void {
    if (this.status === 'playing' && getSetting('bargeInEnabled')) {
      // Barge-in: stop current TTS playback
      this.ttsService.stop()
      this.ttsQueue = []
      this.isPlaying = false
      this.emitStatus('listening')
    }

    this.status = 'listening'
    this.emitStatus('listening')
  }

  /**
   * Called when the VAD detects the end of speech.
   * Flush ASR and begin translation.
   */
  async onSpeechEnd(): Promise<void> {
    if (this.status !== 'listening') return

    this.status = 'processing'
    this.emitStatus('processing')

    try {
      // Signal end of audio to ASR and get final result
      const finalResult = await this.asrService.endStream()

      // If we got a final result, queue it for translation
      if (finalResult && finalResult.text.trim()) {
        this.queueTranslation(finalResult.text, true)
      }

      // Re-initialize ASR for next utterance
      await this.asrService.initialize(this.currentSourceLanguage)
      this.audioBuffer = []

      // Process the translation queue
      this.processTranslationQueue()
    } catch (error) {
      this.emitError(`Speech end processing failed: ${error}`)
    }
  }

  /**
   * Stop the session and release all resources.
   */
  async stop(): Promise<void> {
    this.isRunning = false
    this.status = 'idle'
    this.emitStatus('idle')

    this.ttsService.stop()
    await this.asrService.close()

    this.audioBuffer = []
    this.translateQueue = []
    this.ttsQueue = []
    this.isTranslating = false
    this.isPlaying = false
  }

  /**
   * Preview a TTS voice — standalone synthesis not tied to a session.
   * Used by the Settings dialog for voice sample playback.
   */
  async previewTts(text: string, language: LanguageCode, speakerId = 0): Promise<{
    audioBuffer: Buffer
    format: string
    sampleRate: number
  }> {
    return this.ttsService.synthesize(text, language, speakerId)
  }

  // ========================
  // Private methods
  // ========================

  private handleAsrResult(result: AsrResult): void {
    // Emit transcript update
    if (this.events) {
      const update: TranscriptUpdate = {
        original: result.text,
        translated: '', // Will be filled after translation
        sourceLanguage: this.currentSourceLanguage,
        targetLanguage: this.currentTargetLanguage,
        isInterim: !result.isFinal,
        timestamp: Date.now()
      }
      this.events.onTranscriptUpdate(update)
    }

    // Queue final results for translation
    if (result.isFinal) {
      this.queueTranslation(result.text, true)
    }
  }

  private queueTranslation(text: string, isFinal: boolean): void {
    this.translateQueue.push({ text, isInterim: !isFinal })
    if (isFinal) {
      this.processTranslationQueue()
    }
  }

  private async processTranslationQueue(): Promise<void> {
    if (this.isTranslating || this.translateQueue.length === 0) return

    this.isTranslating = true

    while (this.translateQueue.length > 0) {
      const item = this.translateQueue.shift()!
      try {
        const translated = await this.translationService.translate(
          item.text,
          this.currentSourceLanguage,
          this.currentTargetLanguage
        )

        if (translated && this.events) {
          // Update transcript with translation
          const update: TranscriptUpdate = {
            original: item.text,
            translated,
            sourceLanguage: this.currentSourceLanguage,
            targetLanguage: this.currentTargetLanguage,
            isInterim: false,
            timestamp: Date.now()
          }
          this.events.onTranscriptUpdate(update)
        }

        // Only synthesize final translations
        if (!item.isInterim && translated) {
          this.queueTts(translated)
        }
      } catch (error) {
        this.emitError(`Translation failed: ${error}`)
      }
    }

    this.isTranslating = false
  }

  private queueTts(text: string): void {
    this.ttsQueue.push(text)
    this.processTtsQueue()
  }

  private async processTtsQueue(): Promise<void> {
    if (this.isPlaying || this.ttsQueue.length === 0) return

    this.isPlaying = true
    this.status = 'playing'
    this.emitStatus('playing')

    while (this.ttsQueue.length > 0) {
      const text = this.ttsQueue.shift()!

      try {
        const result = await this.ttsService.synthesize(text, this.currentTargetLanguage)

        if (result.audioBuffer) {
          const audioBase64 = result.audioBuffer.toString('base64')

          // Emit TTS audio to renderer — renderer handles routing
          // (local playback or WebRTC Data Channel relay)
          if (this.events) {
            this.events.onTtsAudioChunk(audioBase64, 'wav', result.sampleRate)
          }
        }
      } catch (error) {
        this.emitError(`TTS failed: ${error}`)
      }
    }

    this.isPlaying = false

    // Return to listening state
    if (this.isRunning) {
      this.status = 'listening'
      this.emitStatus('listening')
    }
  }

  private float32ToInt16Buffer(float32Array: Float32Array): Buffer {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return Buffer.from(int16Array.buffer)
  }

  private emitStatus(status: PipelineStatus): void {
    this.status = status
    this.events?.onStatusChange(status)
  }

  private emitError(message: string): void {
    console.error(`[SessionManager] ${message}`)
    this.events?.onError(message)
  }
}

// Singleton
export const sessionManager = new SessionManager()
