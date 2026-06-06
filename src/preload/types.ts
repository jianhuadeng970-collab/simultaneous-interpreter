import {
  PipelineStatus,
  TranscriptUpdate,
  Direction,
  AppSettings,
  TtsAudioChunk,
  ModelInfo,
  ModelProgress
} from '../shared/types'

// Re-export for renderer use
export type { TtsAudioChunk, ModelInfo, ModelProgress }

/**
 * Typed API exposed to the renderer via contextBridge.
 */
export interface ElectronAPI {
  // Session control
  startSession: () => Promise<{ success: boolean; error?: string }>
  stopSession: () => Promise<{ success: boolean; error?: string }>
  setDirection: (direction: Direction) => void

  // Audio streaming (renderer → main)
  sendAudioChunk: (pcmData: ArrayBuffer) => void

  // Settings
  getSettings: () => Promise<AppSettings>
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>

  // Model management
  getModels: () => Promise<ModelInfo[]>
  downloadModel: (modelId: string) => Promise<void>
  downloadAllModels: () => Promise<void>
  cancelDownload: (modelId: string) => void

  // Voice preview
  previewVoice: (language: string, voice: string) => Promise<{
    success: boolean
    audioBase64?: string
    format?: string
    sampleRate?: number
    error?: string
  }>

  // Event listeners (main → renderer)
  onStatusChange: (callback: (status: PipelineStatus) => void) => () => void
  onTranscriptUpdate: (callback: (update: TranscriptUpdate) => void) => () => void
  onTtsAudioChunk: (callback: (chunk: TtsAudioChunk) => void) => () => void
  onModelProgress: (callback: (progress: ModelProgress) => void) => () => void
  onError: (callback: (error: { message: string; code?: string }) => void) => () => void
}
