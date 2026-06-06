import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getElectronAPI } from '../lib/ipc-client'
import { TRANSLATIONS, type UILanguage, type TranslationDict } from './translations'

interface I18nContextType {
  lang: UILanguage
  t: TranslationDict
  setLang: (lang: UILanguage) => void
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UILanguage>('zh')

  useEffect(() => {
    // Load saved UI language from settings
    let cancelled = false
    const load = async () => {
      try {
        const settings = await getElectronAPI().getSettings()
        if (cancelled) return
        if (settings.uiLanguage && ['zh', 'en', 'th'].includes(settings.uiLanguage)) {
          setLangState(settings.uiLanguage as UILanguage)
        }
      } catch {
        // Not set yet — will use default 'zh'
      }
    }
    const timer = setTimeout(load, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const setLang = (newLang: UILanguage) => {
    setLangState(newLang)
    // Persist async (fire-and-forget) — state update is synchronous so UI switches immediately
    getElectronAPI().updateSettings({ uiLanguage: newLang }).catch(() => {})
  }

  return (
    <I18nContext.Provider value={{ lang, t: TRANSLATIONS[lang], setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
