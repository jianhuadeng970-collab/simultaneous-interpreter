import { LanguageCode, PipelineStatus, TranscriptUpdate } from '../../shared/types'

/** Audio format for pipeline processing */
export interface AudioSegment {
  /** PCM data as Float32Array (normalized -1..1) */
  pcmData: Float32Array
  /** Sample rate */
  sampleRate: number
  /** Duration in ms */
  durationMs: number
}

/** Result from ASR service */
export interface AsrResult {
  /** Recognized text */
  text: string
  /** Whether this is a final (not interim) result */
  isFinal: boolean
  /** Detected or configured language */
  language: LanguageCode
  /** Confidence score 0-1 */
  confidence: number
}

/** Result from Translation service */
export interface TranslationResult {
  /** Source text */
  source: string
  /** Translated text */
  translated: string
  /** Source language */
  sourceLanguage: LanguageCode
  /** Target language */
  targetLanguage: LanguageCode
}

/** Result from TTS service */
export interface TtsResult {
  /** Audio data as WAV buffer */
  audioBuffer: Buffer
  /** Audio format */
  format: 'wav' | 'mp3'
  /** Sample rate */
  sampleRate: number
  /** Text that was synthesized */
  text: string
  /** Language */
  language: LanguageCode
}

/** Pipeline state */
export interface PipelineState {
  status: PipelineStatus
  currentSourceLanguage: LanguageCode
  currentTargetLanguage: LanguageCode
  /** Accumulated transcript for current utterance */
  currentTranscript: string
  /** Last translation */
  lastTranslation: string
}

/** Session manager events */
export interface SessionEvents {
  onStatusChange: (status: PipelineStatus) => void
  onTranscriptUpdate: (update: TranscriptUpdate) => void
  onTtsAudioChunk: (audioBase64: string, format: 'wav' | 'mp3', sampleRate: number) => void
  onError: (message: string, code?: string) => void
}
