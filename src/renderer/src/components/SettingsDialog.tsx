import { useState, useEffect, FormEvent } from 'react'
import { getElectronAPI } from '../lib/ipc-client'
import { useAppStore } from '../stores/app-store'
import { useI18n } from '../i18n/context'
import { LANGUAGE_LABELS, type UILanguage } from '../i18n/translations'
import type { LanguageCode, AppSettings } from '@shared/types'

interface SettingsDialogProps {
  onClose: () => void
}

const AVAILABLE_LANGUAGES: { code: LanguageCode; name: string }[] = [
  { code: 'zh', name: '中文 Chinese' },
  { code: 'en', name: 'English' }
]

const VOICE_OPTIONS: Record<LanguageCode, string[]> = {
  zh: ['VITS Speaker 0', 'VITS Speaker 1', 'VITS Speaker 2', 'VITS Speaker 3', 'VITS Speaker 4'],
  en: ['Piper Lessac Medium']
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const { t, setLang } = useI18n()
  const { setLanguages } = useAppStore()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      const s = await getElectronAPI().getSettings()
      setSettings(s)
    }
    load()
  }, [])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!settings) return

    setSaving(true)
    setMessage(null)

    try {
      await getElectronAPI().updateSettings(settings)
      setLanguages(settings.languageA, settings.languageB)
      setMessage({ type: 'success', text: t.saved })
      setTimeout(() => {
        setMessage(null)
        onClose()
      }, 1000)
    } catch (error) {
      setMessage({ type: 'error', text: `Save failed: ${error}` })
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async (language: string, voice: string) => {
    const key = `${language}:${voice}`
    setPreviewing(key)
    try {
      const result = await getElectronAPI().previewVoice(language, voice)
      if (result.success && result.audioBase64) {
        // Decode base64 WAV → play
        const binary = atob(result.audioBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes.buffer], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => URL.revokeObjectURL(url)
        await audio.play()
      } else {
        setMessage({ type: 'error', text: result.error || 'Preview failed' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    } finally {
      setPreviewing(null)
    }
  }

  if (!settings) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-xl p-6 text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">{t.settingsTitle}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Model info */}
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">{t.allLocal}</p>
            <p className="text-xs text-slate-500 mt-1">
              ASR: SenseVoice (~229MB) · Translation: NLLB-200 (~350MB)
              · TTS: VITS (zh) + Piper (en) (~165MB)
            </p>
          </div>

          {/* UI Language */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-300 mb-3">
              {t.selectLanguage}
            </legend>
            <select
              value={settings.uiLanguage}
              onChange={(e) => {
                const lang = e.target.value as UILanguage
                setSettings({ ...settings, uiLanguage: lang })
                setLang(lang)
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
            >
              {(Object.keys(LANGUAGE_LABELS) as UILanguage[]).map((code) => (
                <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>
              ))}
            </select>
          </fieldset>

          {/* Language pair */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-300 mb-3">
              {t.languagePair}
            </legend>
            <div className="flex items-center gap-3">
              <select
                value={settings.languageA}
                onChange={(e) =>
                  setSettings({ ...settings, languageA: e.target.value as LanguageCode })
                }
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
              >
                {AVAILABLE_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
              <span className="text-slate-500">↔</span>
              <select
                value={settings.languageB}
                onChange={(e) =>
                  setSettings({ ...settings, languageB: e.target.value as LanguageCode })
                }
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
              >
                {AVAILABLE_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          </fieldset>

          {/* TTS Voice selection */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-300 mb-3">
              {t.ttsVoice}
            </legend>
            <div className="space-y-2">
              {(Object.keys(VOICE_OPTIONS) as LanguageCode[]).map((lang) => (
                <div key={lang} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-8">
                      {lang === 'zh' ? '中文' : 'EN'}
                    </span>
                    <select
                      value={settings.ttsVoices[lang]}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          ttsVoices: { ...settings.ttsVoices, [lang]: e.target.value }
                        })
                      }
                      className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs"
                    >
                      {VOICE_OPTIONS[lang].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handlePreview(lang, settings.ttsVoices[lang])}
                      disabled={previewing !== null}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50
                                 text-slate-300 hover:text-white transition-colors"
                      title="试听"
                    >
                      {previewing === `${lang}:${settings.ttsVoices[lang]}` ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Playback volume */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-300 mb-2">
              {t.volume}
            </legend>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.playbackVolume}
              onChange={(e) =>
                setSettings({ ...settings, playbackVolume: parseFloat(e.target.value) })
              }
              className="w-full accent-blue-500"
            />
            <div className="text-xs text-slate-400 text-right">
              {Math.round(settings.playbackVolume * 100)}%
            </div>
          </fieldset>

          {/* Relay Server URL */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-300 mb-2">
              {t.relayServerUrl}
            </legend>
            <input
              type="text"
              value={settings.relayServerUrl}
              onChange={(e) =>
                setSettings({ ...settings, relayServerUrl: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm
                         focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              {t.relayServerUrlDesc}
            </p>
          </fieldset>

          {/* Barge-in toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.bargeInEnabled}
              onChange={(e) =>
                setSettings({ ...settings, bargeInEnabled: e.target.checked })
              }
              className="w-4 h-4 rounded accent-blue-500"
            />
            <div>
              <span className="text-sm text-slate-300">{t.bargeIn}</span>
              <p className="text-xs text-slate-500">{t.bargeInDesc}</p>
            </div>
          </label>

          {/* Message */}
          {message && (
            <div
              className={`text-sm px-3 py-2 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-900/50 text-green-300 border border-green-700'
                  : 'bg-red-900/50 text-red-300 border border-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600
                         transition-colors text-sm"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500
                         transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving ? t.saving : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
