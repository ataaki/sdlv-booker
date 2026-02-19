import { DAY_NAMES_SHORT } from '../../lib/constants'
import { formatDate, formatDuration } from '../../lib/format'
import type { Rule, RetryQueueEntry } from '../../types'
import Button from '../ui/Button'
import Toggle from '../ui/Toggle'

interface RuleCardProps {
  rule: Rule
  activeRetry?: RetryQueueEntry | null
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onToggle: (id: number, enabled: boolean) => void
  onBookNow: (id: number, date: string) => void
  onCancelRetry?: (retryId: number) => void
  bookingLoading?: boolean
}

export default function RuleCard({ rule, activeRetry, onEdit, onDelete, onToggle, onBookNow, onCancelRetry, bookingLoading }: RuleCardProps) {
  const pgLabel = rule.playground_order?.length ? rule.playground_order.join(', ') : 'Aucune préférence'

  const j45 = rule.j45
  const triggerTime = rule.trigger_time || '00:00'
  let j45Label = ''
  if (j45.days_until_attempt === 0) {
    j45Label = `Réservation auto aujourd'hui à ${triggerTime} pour le ${formatDate(j45.target_date)}`
  } else if (j45.days_until_attempt === 1) {
    j45Label = `Réservation auto demain à ${triggerTime} pour le ${formatDate(j45.target_date)}`
  } else {
    j45Label = `Réservation auto le ${formatDate(j45.attempt_date)} à ${triggerTime} pour le ${formatDate(j45.target_date)} (dans ${j45.days_until_attempt}j)`
  }

  return (
    <div
      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-all shadow-sm hover:shadow-md
        ${rule.enabled ? '' : 'opacity-45'}`}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
        {/* Day + time */}
        <div className="flex items-center gap-3 sm:flex-col sm:gap-0.5">
          <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg px-3.5 py-2 text-center min-w-16 font-bold text-sm tracking-wide">
            {DAY_NAMES_SHORT[rule.day_of_week]}
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight sm:text-2xl sm:mt-0.5">{rule.target_time}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Football 5v5</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span>{formatDuration(rule.duration)}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Terrains : {pgLabel}</div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 w-full border-t border-slate-100 dark:border-slate-700 pt-3 sm:flex-row sm:items-center sm:w-auto sm:border-t-0 sm:pt-0 sm:gap-2 sm:shrink-0">
          <div className="flex items-center justify-between sm:gap-2">
            <Toggle enabled={rule.enabled} onChange={(v) => onToggle(rule.id, v)} label={rule.enabled ? 'Désactiver' : 'Activer'} />
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => onEdit(rule.id)}>Modifier</Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(rule.id)} className="!text-red-500 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-500/15">Supprimer</Button>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => onBookNow(rule.id, j45.target_date)} loading={bookingLoading} className="w-full sm:w-auto">
            Déclencher
          </Button>
        </div>
      </div>

      {/* Next booking info bar */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 px-4 py-2 text-xs text-slate-500">
        {j45Label}
      </div>
      {activeRetry && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border-t border-amber-200 dark:border-amber-500/20 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            Retry en cours — tentative {activeRetry.total_attempts + 1}
            {activeRetry.retry_config[activeRetry.current_step]?.count > 0
              ? `/${activeRetry.retry_config[activeRetry.current_step].count}`
              : ''
            }
            {activeRetry.retry_config.length > 1
              ? ` (\u00e9tape ${activeRetry.current_step + 1}/${activeRetry.retry_config.length})`
              : ''
            }
          </span>
          {onCancelRetry && (
            <button
              onClick={() => onCancelRetry(activeRetry.id)}
              className="text-xs text-amber-600 dark:text-amber-400 hover:text-red-500 font-medium transition-colors"
            >
              Annuler
            </button>
          )}
        </div>
      )}
    </div>
  )
}
