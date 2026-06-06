import { useState, useEffect, useCallback, useRef } from 'react'
import { getElectronAPI } from '../lib/ipc-client'
import { useAppStore } from '../stores/app-store'
import { RelayManager, type ConnectionState } from '../network/relay-manager'
import { useI18n } from '../i18n/context'
import { audioEngine } from '../audio/audio-engine'
import type { TtsAudioChunk } from '@preload/types'

const STATE_I18N_KEYS: Record<ConnectionState, string> = {
  idle: 'statusIdle',
  creating: 'creatingRoom',
  'waiting-answer': 'waitingPeer',
  joining: 'joiningRoom',
  connecting: 'establishingConnection',
  connected: 'connected',
  disconnected: 'disconnected',
  error: 'relayError'
}

const STATE_COLORS: Record<ConnectionState, string> = {
  idle: 'bg-slate-500',
  creating: 'bg-yellow-500 animate-pulse',
  'waiting-answer': 'bg-yellow-500 animate-pulse',
  joining: 'bg-yellow-500 animate-pulse',
  connecting: 'bg-blue-500 animate-pulse',
  connected: 'bg-green-500',
  disconnected: 'bg-slate-500',
  error: 'bg-red-500'
}

export function RoomPanel() {
  const { languageA, languageB } = useAppStore()
  const { t } = useI18n()
  const wrmRef = useRef<RelayManager | null>(null)

  const [state, setState] = useState<ConnectionState>('idle')
  const [displayCode, setDisplayCode] = useState('')
  const [joinInput, setJoinInput] = useState('')
  const [error, setError] = useState('')
  const [copyLabel, setCopyLabel] = useState(t.copyCode)
  const [relayConfigured, setRelayConfigured] = useState(true)

  // ---- Load relay URL and create RelayManager ----
  useEffect(() => {
    getElectronAPI().getSettings().then((settings) => {
      const relayUrl = settings.relayServerUrl || 'https://dusty-turkey-78.jianhuadeng970-collab.deno.net'
      console.log('[RoomPanel] Relay URL:', relayUrl)
      setRelayConfigured(!!relayUrl)
      const wrm = new RelayManager(relayUrl)
      wrmRef.current = wrm

      wrm.onStateChange = (s) => {
        setState(s)
        useAppStore.getState().setConnectionState(s)
      }

      wrm.onTtsAudioReceived = (buffer: ArrayBuffer) => {
        audioEngine.playTtsAudio(buffer)
      }

      wrm.onError = (msg) => {
        setError(msg)
        useAppStore.getState().setConnectionError(msg)
      }
    })

    return () => {
      wrmRef.current?.disconnect()
    }
  }, [])

  // ---- TTS Audio routing ----
  useEffect(() => {
    const api = getElectronAPI()
    const unsub = api.onTtsAudioChunk((chunk: TtsAudioChunk) => {
      const binaryString = atob(chunk.audioBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      if (wrmRef.current?.isConnected()) {
        wrmRef.current.sendTtsAudio(bytes.buffer)
      } else {
        audioEngine.playTtsAudio(bytes.buffer)
      }
    })
    return unsub
  }, [])

  // ---- Actions ----

  const createRoom = useCallback(async () => {
    setError('')
    if (!wrmRef.current) return
    try {
      const code = await wrmRef.current.createRoom()
      setDisplayCode(code)
    } catch (err) {
      setError(String(err))
    }
  }, [])

  const joinRoom = useCallback(async () => {
    if (!joinInput.trim()) return
    setError('')
    if (!wrmRef.current) return
    try {
      await wrmRef.current.joinRoom(joinInput.trim().toUpperCase())
    } catch (err) {
      setError(String(err))
    }
  }, [joinInput])

  const pasteAndJoin = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && wrmRef.current) {
        const code = text.trim().toUpperCase()
        setJoinInput(code)
        await wrmRef.current.joinRoom(code)
      }
    } catch {
      setError(t.error)
    }
  }, [t])

  const disconnect = useCallback(() => {
    wrmRef.current?.disconnect()
    setDisplayCode('')
    setJoinInput('')
    setError('')
  }, [])

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyLabel(t.copied)
      setTimeout(() => setCopyLabel(t.copyCode), 2000)
    } catch {
      setError(t.copyCode + ' ' + t.saveFailed)
    }
  }, [t])

  const currentColor = STATE_COLORS[state]
  const currentLabel = t[STATE_I18N_KEYS[state] as keyof typeof t] || state

  return (
    <div className="flex-shrink-0 px-4 py-3 border-t border-slate-800 space-y-2">
      {/* ---- Status bar ---- */}
      <div className="flex items-center justify-center gap-2">
        <span className={`w-2 h-2 rounded-full ${currentColor}`} />
        <span className="text-sm text-slate-300">{currentLabel}</span>
        {displayCode && (state === 'waiting-answer' || state === 'connected') && (
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono tracking-widest">
            {displayCode}
          </span>
        )}
      </div>

      {/* ---- Relay not configured ---- */}
      {(state === 'idle' && !relayConfigured) && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 text-center space-y-2">
          <p className="text-xs text-amber-300">{t.relayNotConfigured}</p>
          <p className="text-xs text-amber-500/80">{t.relayNotConfiguredDesc}</p>
          <button
            onClick={() => useAppStore.getState().setShowSettings(true)}
            className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded text-xs"
          >
            {t.openSettings}
          </button>
        </div>
      )}

      {/* ---- Idle, disconnected, error: Create / Join ---- */}
      {(state === 'idle' || state === 'disconnected' || state === 'error') && relayConfigured && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={createRoom}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm"
            >
              🏠 {t.createRoom}
            </button>
            <button
              onClick={pasteAndJoin}
              className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm"
            >
              {t.pasteAndJoin}
            </button>
          </div>

          <div className="flex gap-1">
            <input
              type="text"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              placeholder={t.roomCodePlaceholder}
              maxLength={6}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm
                         font-mono tracking-widest text-center
                         focus:border-green-500 focus:outline-none placeholder:text-slate-600 placeholder:tracking-normal"
            />
            <button
              onClick={joinRoom}
              disabled={joinInput.length !== 6}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white rounded-lg text-xs"
            >
              {t.joinRoom}
            </button>
          </div>

          <p className="text-xs text-slate-600 text-center">{t.relaySubtitle}</p>
        </div>
      )}

      {/* ---- Creating, Joining, Connecting: spinner text ---- */}
      {(state === 'creating' || state === 'joining' || state === 'connecting') && (
        <p className="text-xs text-slate-500 text-center">{currentLabel}</p>
      )}

      {/* ---- Waiting for peer (Host side) ---- */}
      {state === 'waiting-answer' && displayCode && (
        <div className="space-y-2">
          <div className="bg-slate-900 border border-indigo-600/30 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-2 text-center">
              {t.shareCodeToPeer}
            </p>
            <div className="bg-slate-950 rounded p-3 text-center">
              <code className="text-3xl text-indigo-300 font-mono tracking-[0.5em] select-all">
                {displayCode}
              </code>
            </div>
            <button
              onClick={() => copyToClipboard(displayCode, 'Copy')}
              className="mt-2 w-full py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded text-xs"
            >
              {copyLabel}
            </button>
          </div>

          <button onClick={disconnect} className="w-full py-1 text-xs text-slate-500 hover:text-slate-300">
            {t.cancel}
          </button>
        </div>
      )}

      {/* ---- Connected ---- */}
      {state === 'connected' && (
        <div className="text-center space-y-2">
          <p className="text-xs text-green-400">{t.relayConnectedDesc}</p>
          <button
            onClick={disconnect}
            className="px-4 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg text-xs"
          >
            ↩ {t.disconnect}
          </button>
        </div>
      )}

      {/* ---- Error message ---- */}
      {error && (
        <p className="text-xs text-red-400 text-center whitespace-pre-line">{error}</p>
      )}
    </div>
  )
}
