import { AUDIO } from '../lib/constants'
import { getElectronAPI } from '../lib/ipc-client'

/**
 * AudioEngine manages the Web Audio API pipeline.
 *
 * Architecture:
 *   Capture: Mic → MediaStreamSource → AudioWorkletNode (extracts PCM, NO output to speakers)
 *   Playback: TTS AudioBuffer → AudioBufferSourceNode → GainNode → destination (speakers)
 *
 * The two paths are completely isolated — the capture processor never connects
 * to audioContext.destination.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null
  private captureNode: AudioWorkletNode | null = null
  private mediaStream: MediaStream | null = null
  private gainNode: GainNode | null = null

  private onAudioChunk: ((pcmData: Float32Array) => void) | null = null
  private isRunning = false

  /**
   * Initialize the audio engine.
   * Creates AudioContext, sets up capture pipeline.
   */
  async initialize(
    onAudioChunk: (pcmData: Float32Array) => void
  ): Promise<void> {
    this.onAudioChunk = onAudioChunk

    // Create AudioContext at the target sample rate
    this.audioContext = new AudioContext({
      sampleRate: AUDIO.SAMPLE_RATE,
      latencyHint: 'interactive' // Minimize latency
    })

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain()
    const settings = await getElectronAPI().getSettings()
    this.gainNode.gain.value = settings.playbackVolume
    this.gainNode.connect(this.audioContext.destination)

    // Load the AudioWorklet processor
    try {
      await this.audioContext.audioWorklet.addModule(
        new URL('./audio-capture-processor.js', import.meta.url).href
      )
    } catch (error) {
      console.error('[AudioEngine] Failed to load AudioWorklet processor:', error)
      throw new Error('Audio capture processor could not be loaded.')
    }
  }

  /**
   * Start microphone capture.
   * The AudioWorkletNode extracts PCM but DOES NOT connect to destination.
   */
  async startCapture(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioEngine not initialized')
    }

    // Resume AudioContext (must be triggered by user gesture)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    // Get microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: AUDIO.SAMPLE_RATE,
        channelCount: AUDIO.CHANNELS,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    // Create capture pipeline
    const source = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.captureNode = new AudioWorkletNode(
      this.audioContext,
      'audio-capture-processor',
      {
        processorOptions: {
          targetSampleRate: AUDIO.SAMPLE_RATE,
          chunkSize: AUDIO.CHUNK_SIZE
        }
      }
    )

    // Connect source to worklet (for processing)
    source.connect(this.captureNode)

    // CRITICAL: Do NOT connect captureNode to destination.
    // This ensures the microphone audio NEVER reaches the speakers.

    // Listen for PCM chunks from the AudioWorklet processor
    this.captureNode.port.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        const pcmData = new Float32Array(event.data)
        this.onAudioChunk?.(pcmData)
      }
    }

    this.isRunning = true
    console.log('[AudioEngine] Capture started (mic audio isolated from speakers)')
  }

  /**
   * Play TTS audio from a WAV buffer.
   * This is the ONLY audio that reaches the speakers.
   */
  async playTtsAudio(wavBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      console.error('[AudioEngine] Cannot play: not initialized')
      return
    }

    try {
      // Ensure context is running
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Decode the WAV audio data
      const audioBuffer = await this.audioContext.decodeAudioData(wavBuffer)

      // Create source and connect to gain → destination
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.gainNode)
      // gainNode is already connected to destination

      // Play immediately
      source.start(0)
      console.log(`[AudioEngine] Playing TTS audio (${audioBuffer.duration.toFixed(2)}s)`)
    } catch (error) {
      console.error('[AudioEngine] Failed to play TTS audio:', error)
    }
  }

  /**
   * Set playback volume.
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  /**
   * Stop all audio and release resources.
   */
  async stop(): Promise<void> {
    this.isRunning = false

    // Stop capture
    if (this.captureNode) {
      this.captureNode.port.onmessage = null
      this.captureNode.disconnect()
      this.captureNode = null
    }

    // Stop microphone
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close()
      this.audioContext = null
      this.gainNode = null
    }

    console.log('[AudioEngine] Stopped')
  }

  /**
   * Check if capture is running.
   */
  get running(): boolean {
    return this.isRunning
  }
}

// Singleton
export const audioEngine = new AudioEngine()
