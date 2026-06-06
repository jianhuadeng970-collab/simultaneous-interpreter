import { useAppStore } from './stores/app-store'
import { useSession } from './hooks/useSession'
import { DirectionControl } from './components/DirectionControl'
import { StatusBar } from './components/StatusBar'
import { TranscriptPanel } from './components/TranscriptPanel'
import { WaveformVisualizer } from './components/WaveformVisualizer'
import { SettingsDialog } from './components/SettingsDialog'
import { RoomPanel } from './components/RoomPanel'
import { ModelDownloader } from './components/ModelDownloader'
import { LanguageSelector } from './components/LanguageSelector'
import { useI18n } from './i18n/context'
import { useEffect, useState } from 'react'
import { getElectronAPI } from './lib/ipc-client'

export default function App() {
  const {
    isSessionActive,
    pipelineStatus,
    direction,
    languageA,
    languageB,
    showSettings,
    setLanguages,
    setShowSettings
  } = useAppStore()

  const { startSession, stopSession, toggleDirection, setDirection } = useSession()
  const { t } = useI18n()

  const [setupPhase, setSetupPhase] = useState<'language' | 'ready'>('language')
  const [showModelDownloader, setShowModelDownloader] = useState(false)

  // Check setup state on mount
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const settings = await getElectronAPI().getSettings()
        setLanguages(settings.languageA, settings.languageB)

        // If setup already done, skip language selector
        if (settings.setupComplete) {
          setSetupPhase('ready')
          // Check models in background
          checkModels()
        }
      } catch {
        // First launch — stay on language selector
      }
    }
    // Small delay for preload readiness
    const timer = setTimeout(checkSetup, 200)
    return () => clearTimeout(timer)
  }, [setLanguages])

  const checkModels = async () => {
    try {
      const models = await Promise.race([
        getElectronAPI().getModels(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ])
      if (models.some((m) => m.required && m.status !== 'installed')) {
        setShowModelDownloader(true)
      }
    } catch {
      setShowModelDownloader(true)
    }
  }

  // After language selection
  const handleLanguageComplete = () => {
    setSetupPhase('ready')
    checkModels()
  }

  const handleMicClick = () => {
    if (isSessionActive) {
      stopSession()
    } else {
      startSession()
    }
  }

  return (
    <>
      {/* First-launch: Language Selector */}
      {setupPhase === 'language' && (
        <LanguageSelector onComplete={handleLanguageComplete} />
      )}

      {/* Main App */}
      {setupPhase === 'ready' && (
        <div className="h-screen flex flex-col bg-slate-900">
          {/* Header */}
          <header className="flex-shrink-0 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-white">{t.appTitle}</h1>
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {languageA.toUpperCase()} ↔ {languageB.toUpperCase()}
              </span>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title={t.settings}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </header>

          {/* Main Content */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Status Bar */}
            <StatusBar status={pipelineStatus} isActive={isSessionActive} />

            {/* Waveform Visualizer */}
            {isSessionActive && pipelineStatus === 'listening' && (
              <WaveformVisualizer isActive={true} />
            )}

            {/* Transcript Panel */}
            <TranscriptPanel />

            {/* Room Panel (network) */}
            <RoomPanel />

            {/* Direction Control */}
            <DirectionControl
              direction={direction}
              isActive={isSessionActive}
              languageA={languageA}
              languageB={languageB}
              onToggle={toggleDirection}
              onSetDirection={setDirection}
            />
          </main>

          {/* Mic Button (fixed at bottom center) */}
          <footer className="flex-shrink-0 py-4 flex justify-center border-t border-slate-800">
            <button
              onClick={handleMicClick}
              className={`
                w-16 h-16 rounded-full flex items-center justify-center
                transition-all duration-300 shadow-lg
                ${isSessionActive
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse-glow shadow-red-500/50'
                  : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30'
                }
              `}
              title={isSessionActive ? t.stopTranslation : t.startTranslation}
            >
              {isSessionActive ? (
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </button>
          </footer>

          {/* Settings Dialog */}
          {showSettings && (
            <SettingsDialog onClose={() => setShowSettings(false)} />
          )}

          {/* Model Downloader */}
          {showModelDownloader && (
            <ModelDownloader onClose={() => setShowModelDownloader(false)} />
          )}
        </div>
      )}
    </>
  )
}
