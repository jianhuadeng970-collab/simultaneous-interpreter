import { LanguageCode } from '@shared/types'

/** Audio capture constants */
export const AUDIO = {
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
  /** Size of each audio chunk sent to main process (in samples) */
  CHUNK_SIZE: 1536, // 96ms at 16kHz (matching Silero VAD frame size)
  /** Buffer size for AudioWorklet processor */
  PROCESSOR_BUFFER_SIZE: 128
} as const

/** VAD configuration */
export const VAD_CONFIG = {
  /** Speech start sensitivity (0-1, lower = more sensitive) */
  positiveSpeechThreshold: 0.5,
  /** Speech end sensitivity */
  negativeSpeechThreshold: 0.35,
  /** Frames of silence before speech end (8 frames × 96ms = 768ms) */
  redemptionFrames: 8,
  /** Minimum speech frames to trigger (3 frames × 96ms = 288ms) */
  minSpeechFrames: 3,
  /** Frames of audio before speech start to capture */
  preSpeechPadFrames: 5
} as const

/** Language display info */
export const LANGUAGE_INFO: Record<LanguageCode, { name: string; flag: string; color: string }> = {
  zh: { name: '中文', flag: '🇨🇳', color: '#ef4444' },
  en: { name: 'English', flag: '🇺🇸', color: '#6366f1' }
} as const
