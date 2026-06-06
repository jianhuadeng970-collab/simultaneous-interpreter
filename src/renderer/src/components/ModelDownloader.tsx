import { useState, useEffect, useCallback } from 'react'
import { getElectronAPI } from '../lib/ipc-client'
import { useI18n } from '../i18n/context'
import type { ModelInfo, ModelProgress } from '@preload/types'

interface ModelDownloaderProps {
  onClose: () => void
}

/** Localized model names mapped by model ID */
const MODEL_I18N_KEYS: Record<string, { nameKey: string; descKey: string }> = {
  'asr-sensevoice': { nameKey: 'asrModelName', descKey: 'asrModelDesc' },
  'tts-zh-vits': { nameKey: 'ttsZhModelName', descKey: 'ttsZhModelDesc' },
  'tts-en-piper': { nameKey: 'ttsEnModelName', descKey: 'ttsEnModelDesc' },
}

export function ModelDownloader({ onClose }: ModelDownloaderProps) {
  const { t } = useI18n()
  const [models, setModels] = useState<ModelInfo[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, ModelProgress>>(new Map())
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load model list on mount
  useEffect(() => {
    const load = async () => {
      try {
        const list = await getElectronAPI().getModels()
        setModels(list)
      } catch (err) {
        setError(`Failed to load model list: ${err}`)
      }
    }
    load()
  }, [])

  // Listen to progress events
  useEffect(() => {
    const unsubscribe = getElectronAPI().onModelProgress((progress: ModelProgress) => {
      setProgressMap((prev) => {
        const next = new Map(prev)
        next.set(progress.modelId, progress)
        return next
      })
      // Refresh model list when a download completes or errors
      if (progress.status === 'installed' || progress.status === 'error') {
        getElectronAPI().getModels().then(setModels).catch(console.error)
      }
    })
    return unsubscribe
  }, [])

  const allInstalled = models
    .filter((m) => m.required)
    .every((m) => m.status === 'installed')

  const anyDownloading = [...progressMap.values()].some(
    (p) => p.status === 'downloading'
  )

  const handleDownloadAll = useCallback(async () => {
    setDownloading(true)
    setError(null)
    try {
      await getElectronAPI().downloadAllModels()
    } catch (err) {
      setError(`Download failed: ${err}`)
    } finally {
      setDownloading(false)
    }
  }, [])

  const handleRetry = useCallback(async (modelId: string) => {
    setError(null)
    try {
      await getElectronAPI().downloadModel(modelId)
    } catch (err) {
      setError(`Download failed: ${err}`)
    }
  }, [])

  const totalRequired = models.filter((m) => m.required).length
  const installedRequired = models.filter(
    (m) => m.required && m.status === 'installed'
  ).length

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t.modelSetup}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t.modelSetupDesc}
            </p>
          </div>
          {allInstalled && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Progress summary */}
          {!allInstalled && (
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">
                  {t.progress}: {installedRequired}/{totalRequired} {t.modelsReady}
                </span>
                <span className="text-xs text-slate-500">
                  {t.totalSize}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${totalRequired > 0 ? (installedRequired / totalRequired) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Model list */}
          <div className="space-y-3">
            {models.map((model) => {
              const progress = progressMap.get(model.id)
              const isDownloading = progress?.status === 'downloading'
              const isInstalled = model.status === 'installed'
              const hasError = model.status === 'error' || progress?.status === 'error'

              return (
                <div
                  key={model.id}
                  className={`bg-slate-900 rounded-lg p-4 border transition-colors ${
                    isInstalled
                      ? 'border-green-700/50'
                      : hasError
                        ? 'border-red-700/50'
                        : isDownloading
                          ? 'border-blue-700/50'
                          : 'border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white truncate">
                          {model.name}
                        </h3>
                        {model.required && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 font-medium">
                            {t.required}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                      {model.description}
                    </p>
                      <p className="text-xs text-slate-500 mt-0.5">{model.size}</p>
                    </div>

                    <div className="flex items-center gap-2 ml-3">
                      {isInstalled ? (
                        <span className="text-green-400">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : isDownloading ? (
                        <span className="text-blue-400 text-xs font-medium">
                          {progress ? `${Math.round((progress.bytesDownloaded / progress.totalBytes) * 100)}%` : '...'}
                        </span>
                      ) : hasError ? (
                        <button
                          onClick={() => handleRetry(model.id)}
                          className="px-3 py-1.5 text-xs rounded bg-red-900/50 text-red-300
                                     hover:bg-red-800/50 border border-red-700/50 transition-colors"
                        >
                          {t.retry}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRetry(model.id)}
                          className="px-3 py-1.5 text-xs rounded bg-slate-700 text-slate-300
                                     hover:bg-slate-600 transition-colors"
                        >
                          {t.download}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar while downloading */}
                  {isDownloading && progress && (
                    <div className="mt-3 w-full bg-slate-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            (progress.bytesDownloaded / Math.max(1, progress.totalBytes)) * 100
                          )}%`
                        }}
                      />
                    </div>
                  )}

                  {/* Error message */}
                  {hasError && progress?.error && (
                    <p className="mt-2 text-xs text-red-400">{progress.error}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {allInstalled ? (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-500
                           transition-colors text-sm font-medium"
              >
                {t.allModelsReady}
              </button>
            ) : (
              <>
                <button
                  onClick={handleDownloadAll}
                  disabled={downloading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500
                             transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {downloading
                    ? anyDownloading
                      ? t.downloading
                      : t.preparing
                    : t.downloadAll}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600
                             transition-colors text-sm"
                >
                  {t.skipForNow}
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-slate-500 text-center">
            {t.modelsStoredLocally}
          </p>
        </div>
      </div>
    </div>
  )
}
