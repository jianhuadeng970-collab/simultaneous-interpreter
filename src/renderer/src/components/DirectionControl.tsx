import type { Direction, LanguageCode } from '@shared/types'
import { LANGUAGE_INFO } from '../lib/constants'
import { useI18n } from '../i18n/context'

interface DirectionControlProps {
  direction: Direction
  isActive: boolean
  languageA: LanguageCode
  languageB: LanguageCode
  onToggle: () => void
  onSetDirection: (dir: Direction) => void
}

export function DirectionControl({
  direction,
  isActive,
  languageA,
  languageB,
  onToggle,
  onSetDirection
}: DirectionControlProps) {
  const { t } = useI18n()

  return (
    <div className="flex-shrink-0 px-4 py-3 border-t border-slate-800">
      <div className="flex items-center justify-center gap-4">
        {/* A → B button */}
        <button
          onClick={() => onSetDirection('A->B')}
          disabled={!isActive}
          className={`
            flex-1 max-w-[200px] py-3 px-4 rounded-xl text-center
            transition-all duration-200
            ${direction === 'A->B'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }
            ${!isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="text-sm font-medium">
            {LANGUAGE_INFO[languageA].flag} {LANGUAGE_INFO[languageA].name}
          </div>
          <div className="text-xs mt-1 opacity-70">
            → {LANGUAGE_INFO[languageB].flag} {LANGUAGE_INFO[languageB].name}
          </div>
        </button>

        {/* Swap button */}
        <button
          onClick={onToggle}
          disabled={!isActive}
          className={`
            p-2 rounded-full transition-colors
            ${isActive
              ? 'hover:bg-slate-700 cursor-pointer text-slate-400 hover:text-white'
              : 'text-slate-600 cursor-not-allowed'
            }
          `}
          title={t.switchDirection}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>

        {/* B → A button */}
        <button
          onClick={() => onSetDirection('B->A')}
          disabled={!isActive}
          className={`
            flex-1 max-w-[200px] py-3 px-4 rounded-xl text-center
            transition-all duration-200
            ${direction === 'B->A'
              ? 'bg-green-600 text-white shadow-lg shadow-green-600/30 scale-105'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }
            ${!isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="text-sm font-medium">
            {LANGUAGE_INFO[languageB].flag} {LANGUAGE_INFO[languageB].name}
          </div>
          <div className="text-xs mt-1 opacity-70">
            → {LANGUAGE_INFO[languageA].flag} {LANGUAGE_INFO[languageA].name}
          </div>
        </button>
      </div>
    </div>
  )
}
