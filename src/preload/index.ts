import { contextBridge, ipcRenderer } from 'electron'
import {
  PipelineStatus,
  TranscriptUpdate,
  Direction,
  AppSettings,
  TtsAudioChunk,
  ModelProgress,
  IPC_CHANNELS
} from '../shared/types'

/**
 * Preload script — exposes a minimal, typed API to the renderer process.
 * Uses contextBridge for security (contextIsolation enabled).
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ---- Session control ----

  startSession: () => ipcRenderer.invoke(IPC_CHANNELS.START_SESSION),
  stopSession: () => ipcRenderer.invoke(IPC_CHANNELS.STOP_SESSION),
  setDirection: (direction: Direction) =>
    ipcRenderer.send(IPC_CHANNELS.SET_DIRECTION, direction),

  // ---- Audio streaming (renderer → main) ----

  sendAudioChunk: (pcmData: ArrayBuffer) =>
    ipcRenderer.send(IPC_CHANNELS.SEND_AUDIO_CHUNK, pcmData),

  // ---- Settings ----

  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  updateSettings: (partial: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, partial),

  // ---- Model management ----

  getModels: () => ipcRenderer.invoke(IPC_CHANNELS.GET_MODELS),
  downloadModel: (modelId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_MODEL, modelId),
  downloadAllModels: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_ALL_MODELS),
  cancelDownload: (modelId: string) =>
    ipcRenderer.send(IPC_CHANNELS.CANCEL_DOWNLOAD, modelId),

  // ---- Voice preview ----

  previewVoice: (language: string, voice: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_VOICE, language, voice),

  // ---- Event listeners (main → renderer) ----

  onStatusChange: (callback: (status: PipelineStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: PipelineStatus) =>
      callback(status)
    ipcRenderer.on(IPC_CHANNELS.STATUS_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.STATUS_CHANGE, handler)
  },

  onTranscriptUpdate: (callback: (update: TranscriptUpdate) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      update: TranscriptUpdate
    ) => callback(update)
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPT_UPDATE, handler)
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPT_UPDATE, handler)
  },

  onTtsAudioChunk: (callback: (chunk: TtsAudioChunk) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: TtsAudioChunk) =>
      callback(chunk)
    ipcRenderer.on(IPC_CHANNELS.TTS_AUDIO_CHUNK, handler)
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.TTS_AUDIO_CHUNK, handler)
  },

  onModelProgress: (callback: (progress: ModelProgress) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: ModelProgress
    ) => callback(progress)
    ipcRenderer.on(IPC_CHANNELS.MODEL_PROGRESS, handler)
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.MODEL_PROGRESS, handler)
  },

  onError: (
    callback: (error: { message: string; code?: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      error: { message: string; code?: string }
    ) => callback(error)
    ipcRenderer.on(IPC_CHANNELS.ERROR, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ERROR, handler)
  }
})
