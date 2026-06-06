import { useCallback, useEffect } from 'react'
import { getElectronAPI } from '../lib/ipc-client'
import { useAppStore, createTranscriptEntry } from '../stores/app-store'
import { useAudioCapture } from './useAudioCapture'
import type { TranscriptUpdate, PipelineStatus } from '@shared/types'

/**
 * Primary hook for managing the interpretation session.
 * Coordinates audio capture, IPC events, and app state.
 */
export function useSession() {
  const {
    isSessionActive,
    direction,
    setSessionActive,
    setPipelineStatus,
    addTranscript,
    setError,
    clearTranscripts
  } = useAppStore()

  const { startCapture, stopCapture } = useAudioCapture()

  // Register IPC event listeners
  useEffect(() => {
    const api = getElectronAPI()

    const unsubStatus = api.onStatusChange((status: PipelineStatus) => {
      setPipelineStatus(status)
    })

    const unsubTranscript = api.onTranscriptUpdate((update: TranscriptUpdate) => {
      if (!update.isInterim && update.translated) {
        const entry = createTranscriptEntry(
          update.original,
          update.translated,
          update.sourceLanguage,
          update.targetLanguage
        )
        addTranscript(entry)
      }
    })

    const unsubError = api.onError((error: { message: string; code?: string }) => {
      setError(error.message)
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000)
    })

    return () => {
      unsubStatus()
      unsubTranscript()
      unsubError()
    }
  }, [addTranscript, setPipelineStatus, setError])

  // Start session
  const startSession = useCallback(async () => {
    const api = getElectronAPI()

    // Start capture first (needs user gesture to resume AudioContext)
    const started = await startCapture()
    if (!started) return

    const result = await api.startSession()
    if (result.success) {
      setSessionActive(true)
      clearTranscripts()
      console.log('[useSession] Session started')
    } else {
      await stopCapture()
      setError(result.error || 'Failed to start session')
    }
  }, [startCapture, stopCapture, setSessionActive, clearTranscripts, setError])

  // Stop session
  const stopSession = useCallback(async () => {
    const api = getElectronAPI()
    await api.stopSession()
    await stopCapture()
    setSessionActive(false)
    setPipelineStatus('idle')
    console.log('[useSession] Session stopped')
  }, [stopCapture, setSessionActive, setPipelineStatus])

  // Toggle direction
  const toggleDirection = useCallback(() => {
    const api = getElectronAPI()
    const newDirection = direction === 'A->B' ? 'B->A' : 'A->B'
    api.setDirection(newDirection)
    useAppStore.getState().setDirection(newDirection)
  }, [direction])

  // Set specific direction
  const setDirection = useCallback((dir: 'A->B' | 'B->A') => {
    const api = getElectronAPI()
    api.setDirection(dir)
    useAppStore.getState().setDirection(dir)
  }, [])

  return {
    isSessionActive,
    startSession,
    stopSession,
    toggleDirection,
    setDirection
  }
}
