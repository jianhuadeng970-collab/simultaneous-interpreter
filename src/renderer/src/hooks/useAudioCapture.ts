import { useRef, useCallback, useEffect } from 'react'
import { audioEngine } from '../audio/audio-engine'
import { getElectronAPI } from '../lib/ipc-client'
import { useAppStore } from '../stores/app-store'

/**
 * Hook for managing audio capture.
 * Connects the AudioEngine to the main process session manager via IPC.
 */
export function useAudioCapture() {
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const onAudioChunkRef = useRef<((pcmData: Float32Array) => void) | null>(null)

  useEffect(() => {
    // Set up the audio chunk callback — sends PCM data to main process
    onAudioChunkRef.current = (pcmData: Float32Array) => {
      if (isSessionActive) {
        const api = getElectronAPI()
        // Transfer the ArrayBuffer for zero-copy IPC
        api.sendAudioChunk(pcmData.buffer as ArrayBuffer)
      }
    }
  }, [isSessionActive])

  const startCapture = useCallback(async () => {
    try {
      await audioEngine.initialize((pcmData) => {
        onAudioChunkRef.current?.(pcmData)
      })
      await audioEngine.startCapture()
      console.log('[useAudioCapture] Audio capture started')
      return true
    } catch (error) {
      console.error('[useAudioCapture] Failed to start capture:', error)
      useAppStore.getState().setError(
        `麦克风访问失败: ${error instanceof Error ? error.message : '未知错误'}`
      )
      return false
    }
  }, [])

  const stopCapture = useCallback(async () => {
    await audioEngine.stop()
    console.log('[useAudioCapture] Audio capture stopped')
  }, [])

  return { startCapture, stopCapture }
}
