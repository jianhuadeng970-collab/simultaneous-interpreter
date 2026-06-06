import { useState } from 'react'
import { useI18n } from '../i18n/context'
import type { UILanguage } from '../i18n/translations'
import { getElectronAPI } from '../lib/ipc-client'

interface LanguageSelectorProps {
  onComplete: () => void
}

const LANGUAGE_DISPLAY: Record<UILanguage, { name: string; sub: string; flag: string }> = {
  zh: { name: '中文', sub: 'Chinese', flag: '🇨🇳' },
  en: { name: 'English', sub: 'English', flag: '🇺🇸' },
  th: { name: 'ภาษาไทย', sub: 'Thai', flag: '🇹🇭' },
}

export function LanguageSelector({ onComplete }: LanguageSelectorProps) {
  const { t, setLang } = useI18n()
  const [selected, setSelected] = useState<UILanguage | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = (code: UILanguage) => {
    setSelected(code)
    setError(null)
  }

  const handleConfirm = async () => {
    if (!selected) return
    setConfirming(true)
    setError(null)

    // Update language synchronously so UI switches immediately
    setLang(selected)

    try {
      await getElectronAPI().updateSettings({ setupComplete: true })
    } catch (err) {
      setError(String(err))
      setConfirming(false)
      return
    }

    setConfirming(false)
    onComplete()
  }

  const langs: UILanguage[] = ['zh', 'en', 'th']

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center z-50">
      <div className="max-w-lg w-full px-6 py-12 text-center">
        {/* App Icon */}
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500
                          flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Simultaneous Interpreter
        </h1>
        <p className="text-sm text-slate-400 mb-3">同声传译</p>

        <p className="text-base text-slate-300 mb-2">
          {t.selectLanguage}
        </p>
        <p className="text-xs text-slate-500 mb-8">
          {t.selectLanguageDesc}
        </p>

        {/* Language Options */}
        <div className="space-y-3 mb-6">
          {langs.map((code) => {
            const display = LANGUAGE_DISPLAY[code]
            const isSelected = selected === code
            return (
              <button
                key={code}
                onClick={() => handleSelect(code)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2
                  transition-all duration-200 text-left
                  ${isSelected
                    ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                  }`}
              >
                <span className="text-3xl">{display.flag}</span>
                <div>
                  <div className={`font-semibold text-lg ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                    {display.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {display.sub}
                  </div>
                </div>
                {isSelected && (
                  <div className="ml-auto">
                    <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={!selected || confirming}
          className={`w-full py-3 rounded-xl text-base font-semibold transition-all duration-200
            ${selected
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/25'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }
            disabled:opacity-60`}
        >
          {confirming ? '...' : t.confirmLanguage}
        </button>

        {/* Footer */}
        <p className="text-xs text-slate-600 mt-6">
          You can change the language later in Settings.
        </p>
      </div>
    </div>
  )
}
