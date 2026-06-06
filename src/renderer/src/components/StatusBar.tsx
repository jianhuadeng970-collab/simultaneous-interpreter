import type { PipelineStatus } from '@shared/types'
import { useI18n } from '../i18n/context'

interface StatusBarProps {
  status: PipelineStatus
  isActive: boolean
}

export function StatusBar({ status, isActive }: StatusBarProps) {
  const { t } = useI18n()

  const STATUS_CONFIG: Record<PipelineStatus, { label: string; color: string; bg: string }> = {
    idle: { label: t.statusIdle, color: 'text-slate-400', bg: 'bg-slate-700' },
    listening: { label: t.statusListening, color: 'text-green-400', bg: 'bg-green-600' },
    processing: { label: t.statusProcessing, color: 'text-yellow-400', bg: 'bg-yellow-600' },
    playing: { label: t.statusPlaying, color: 'text-blue-400', bg: 'bg-blue-600' }
  }

  const config = STATUS_CONFIG[status]

  if (!isActive && status === 'idle') {
    return (
      <div className="flex-shrink-0 px-4 py-3 text-center">
        <p className="text-slate-500 text-sm">
          {t.startTranslation}
        </p>
        <p className="text-slate-600 text-xs mt-1">
          {t.directionAToB}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 px-4 py-3">
      <div className="flex items-center justify-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${config.bg} ${
          status === 'listening' ? 'animate-pulse' : ''
        }`} />
        <span className={`text-sm font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>

      {status === 'processing' && (
        <div className="flex justify-center gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
