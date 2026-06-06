import { ipcMain, BrowserWindow } from 'electron'
import { sessionManager } from './pipeline/session-manager'
import { getSettings, updateSettings } from './config/store'
import { ModelManager } from './services/model-manager'
import { IPC_CHANNELS, Direction, AppSettings } from '../shared/types'

// Singleton model manager
let modelManager: ModelManager | null = null

function getModelManager(): ModelManager {
  if (!modelManager) {
    modelManager = new ModelManager()
    // Forward model progress events to renderer
    modelManager.on('progress', (progress) => {
      sendToRenderer(IPC_CHANNELS.MODEL_PROGRESS, progress)
    })
  }
  return modelManager
}

/**
 * Register all IPC handlers.
 * This connects the renderer process to the main process pipeline.
 */
export function registerIpcHandlers(): void {
  // ---- Session control ----

  ipcMain.handle(IPC_CHANNELS.START_SESSION, async () => {
    try {
      await sessionManager.start()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.STOP_SESSION, async () => {
    try {
      await sessionManager.stop()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.on(IPC_CHANNELS.SET_DIRECTION, (_event, direction: Direction) => {
    sessionManager.setDirection(direction)
  })

  // ---- Audio streaming ----

  ipcMain.on(IPC_CHANNELS.SEND_AUDIO_CHUNK, (_event, pcmData: ArrayBuffer) => {
    const float32Data = new Float32Array(pcmData)
    sessionManager.processAudioChunk(float32Data)
  })

  // ---- Settings ----

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
    return getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, (_event, partial: Partial<AppSettings>) => {
    return updateSettings(partial)
  })

  // ---- Model management ----

  ipcMain.handle(IPC_CHANNELS.GET_MODELS, () => {
    return getModelManager().getModelList()
  })

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_MODEL, async (_event, modelId: string) => {
    await getModelManager().downloadModel(modelId)
  })

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_ALL_MODELS, async () => {
    await getModelManager().downloadAllRequired()
  })

  ipcMain.on(IPC_CHANNELS.CANCEL_DOWNLOAD, (_event, modelId: string) => {
    getModelManager().cancelDownload(modelId)
  })

  // ---- Voice preview ----

  ipcMain.handle(IPC_CHANNELS.PREVIEW_VOICE, async (_event, language: string, voice: string) => {
    try {
      const sampleText = language === 'zh'
        ? '欢迎使用同声传译软件。我是中文语音合成引擎，你可以通过试听来选择你喜欢的发音人声音。'
        : 'Hello, this is a sample voice for testing.'

      // Extract speaker ID from voice name (e.g., "VITS Speaker 3" → 3)
      const speakerId = voice.includes('Speaker')
        ? parseInt(voice.match(/Speaker\s*(\d+)/)?.[1] || '0', 10)
        : 0

      const result = await sessionManager.previewTts(sampleText, language as 'zh' | 'en', speakerId)
      return {
        success: true,
        audioBase64: result.audioBuffer.toString('base64'),
        format: result.format,
        sampleRate: result.sampleRate
      }
    } catch (error) {
      console.error('[VoicePreview] Error:', error)
      return { success: false, error: String(error) }
    }
  })

  // ---- Event forwarding (Main → Renderer) ----

  sessionManager.registerEvents({
    onStatusChange: (status) => {
      sendToRenderer(IPC_CHANNELS.STATUS_CHANGE, status)
    },
    onTranscriptUpdate: (update) => {
      sendToRenderer(IPC_CHANNELS.TRANSCRIPT_UPDATE, update)
    },
    onTtsAudioChunk: (audioBase64, format, sampleRate) => {
      sendToRenderer(IPC_CHANNELS.TTS_AUDIO_CHUNK, {
        audioBase64,
        format,
        sampleRate
      })
    },
    onError: (message, code) => {
      sendToRenderer(IPC_CHANNELS.ERROR, { message, code })
    }
  })
}

function sendToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }
}
