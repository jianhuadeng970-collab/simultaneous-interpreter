import { useRef, useEffect } from 'react'
import { useAppStore, getLanguageFlag } from '../stores/app-store'
import { useI18n } from '../i18n/context'

export function TranscriptPanel() {
  const transcripts = useAppStore((s) => s.transcripts)
  const isActive = useAppStore((s) => s.isSessionActive)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  // Auto-scroll to bottom on new transcripts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcripts.length])

  if (!isActive && transcripts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-sm">{t.noTranscript}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-2 space-y-3"
    >
      {transcripts.map((entry) => (
        <div
          key={entry.id}
          className="animate-fade-in bg-slate-800/50 rounded-lg p-3 border border-slate-700/50"
        >
          {/* Original text */}
          <div className="flex items-start gap-2">
            <span className="text-xs mt-0.5">
              {getLanguageFlag(entry.sourceLanguage)}
            </span>
            <p className="text-sm text-slate-300 leading-relaxed">
              {entry.original}
            </p>
          </div>

          {/* Divider */}
          <div className="my-1.5 border-t border-slate-700/50" />

          {/* Translated text */}
          <div className="flex items-start gap-2">
            <span className="text-xs mt-0.5">
              {getLanguageFlag(entry.targetLanguage)}
            </span>
            <p className="text-sm text-blue-300 leading-relaxed font-medium">
              {entry.translated || '...'}
            </p>
          </div>
        </div>
      ))}

      {/* Empty space at bottom so content doesn't get hidden behind controls */}
      <div className="h-2" />
    </div>
  )
}
