// ============================================================
// Shared types — used by main, preload, and renderer processes
// ============================================================

/** Supported language codes */
export type LanguageCode = 'zh' | 'en'

/** Language pair for direction control */
export interface LanguagePair {
  source: LanguageCode
  target: LanguageCode
}

/** Language display names */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  zh: '中文',
  en: 'English'
}

/** Conversation direction */
export type Direction = 'A->B' | 'B->A'

/** Pipeline status */
export type PipelineStatus = 'idle' | 'listening' | 'processing' | 'playing'

/** Session configuration */
export interface SessionConfig {
  languageA: LanguageCode
  languageB: LanguageCode
  direction: Direction
  /** Manual direction switch: the user manually controls who is speaking */
  directionMode: 'manual' | 'auto'
}

/** Transcript update event */
export interface TranscriptUpdate {
  /** Original recognized text */
  original: string
  /** Translated text */
  translated: string
  /** Source language */
  sourceLanguage: LanguageCode
  /** Target language */
  targetLanguage: LanguageCode
  /** Whether this is an interim (partial) result */
  isInterim: boolean
  /** Timestamp */
  timestamp: number
}

/** Translation update event (for streaming translation) */
export interface TranslationUpdate {
  /** Original text being translated */
  original: string
  /** Partial or final translation */
  translated: string
  /** Whether this is the final translation */
  isFinal: boolean
}

/** TTS audio chunk from main to renderer */
export interface TtsAudioChunk {
  /** Base64-encoded audio data (WAV format) */
  audioBase64: string
  /** Audio format */
  format: 'wav' | 'mp3'
  /** Sample rate */
  sampleRate: number
}

/** UI language for the application interface */
export type UILanguage = 'zh' | 'en' | 'th'

/** Application settings (persisted) */
export interface AppSettings {
  // First-launch setup
  setupComplete: boolean

  // UI preferences
  uiLanguage: UILanguage

  // Language preferences
  languageA: LanguageCode
  languageB: LanguageCode
  directionMode: 'manual' | 'auto'

  // TTS voice preferences
  ttsVoices: {
    zh: string
    en: string
  }

  // Audio settings
  sampleRate: number
  vadThreshold: number
  playbackVolume: number

  // Relay server for cross-network connections
  relayServerUrl: string

  // Advanced
  bargeInEnabled: boolean
  showTranscripts: boolean
}

/** Model download status types */
export type ModelStatus = 'not_installed' | 'downloading' | 'installed' | 'error'

export interface ModelInfo {
  id: string
  name: string
  description: string
  size: string
  required: boolean
  category: 'asr' | 'tts' | 'translation'
  status: ModelStatus
}

export interface ModelProgress {
  modelId: string
  status: ModelStatus
  bytesDownloaded: number
  totalBytes: number
  error?: string
}

/** IPC channel names */
export const IPC_CHANNELS = {
  // Renderer → Main
  SEND_AUDIO_CHUNK: 'audio:send-chunk',
  START_SESSION: 'session:start',
  STOP_SESSION: 'session:stop',
  SET_DIRECTION: 'session:set-direction',
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  GET_MODELS: 'models:get',
  DOWNLOAD_MODEL: 'models:download',
  DOWNLOAD_ALL_MODELS: 'models:download-all',
  CANCEL_DOWNLOAD: 'models:cancel',
  PREVIEW_VOICE: 'voice:preview',

  // Main → Renderer
  TTS_AUDIO_CHUNK: 'tts:audio-chunk',
  TRANSCRIPT_UPDATE: 'transcript:update',
  TRANSLATION_UPDATE: 'translation:update',
  STATUS_CHANGE: 'status:change',
  DIRECTION_CHANGE: 'direction:change',
  MODEL_PROGRESS: 'models:progress',
  ERROR: 'error'
} as const
