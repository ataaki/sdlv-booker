import { DAY_NAMES_SHORT } from '../../lib/constants'
import { formatDate } from '../../lib/format'
import type { Rule } from '../../types'
import Button from '../ui/Button'
import Toggle from '../ui/Toggle'

interface RuleCardProps {
  rule: Rule
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onToggle: (id: number, enabled: boolean) => void
  onBookNow: (id: number, date: string) => void
  bookingLoading?: boolean
}

export default function RuleCard({ rule, onEdit, onDelete, onToggle, onBookNow, bookingLoading }: RuleCardProps) {
  const pgLabel = rule.playground_order?.length ? rule.playground_order.join(', ') : 'Aucune préférence'

  const j45 = rule.j45
  let j45Label = ''
  if (j45.days_until_attempt === 0) {
    j45Label = `Réservation auto aujourd'hui à 00:00 pour le ${formatDate(j45.target_date)}`
  } else if (j45.days_until_attempt === 1) {
    j45Label = `Réservation auto demain à 00:00 pour le ${formatDate(j45.target_date)}`
  } else {
    j45Label = `Réservation auto le ${formatDate(j45.attempt_date)} à 00:00 pour le ${formatDate(j45.target_date)} (dans ${j45.days_until_attempt}j)`
  }

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 transition-all shadow-sm hover:border-sky-500 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.15)]
        max-sm:flex-col max-sm:items-stretch max-sm:gap-2.5
        ${rule.enabled ? '' : 'opacity-45'}`}
    >
      <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2.5 text-center min-w-14 font-bold text-sm tracking-wide max-sm:self-start max-sm:px-3 max-sm:py-1.5 max-sm:text-xs">
        {DAY_NAMES_SHORT[rule.day_of_week]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xl font-bold text-slate-900 tracking-tight max-sm:text-lg">{rule.target_time}</div>
        <div className="text-sm text-slate-500 mt-0.5">Football 5v5 - {rule.duration_label} - Tarif variable selon horaire</div>
        <div className="text-xs text-slate-400 mt-0.5">Terrains : {pgLabel}</div>
        <div className="text-xs text-sky-600 font-medium mt-1">{j45Label}</div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 max-sm:w-full max-sm:justify-between max-sm:flex-wrap max-sm:gap-2">
        <Button variant="success" size="sm" onClick={() => onBookNow(rule.id, j45.target_date)} loading={bookingLoading}>
          ⚡ Réserver
        </Button>
        <Button variant="icon" size="sm" onClick={() => onEdit(rule.id)}>✏</Button>
        <Toggle enabled={rule.enabled} onChange={(v) => onToggle(rule.id, v)} label={rule.enabled ? 'Désactiver' : 'Activer'} />
        <Button variant="icon" size="sm" onClick={() => onDelete(rule.id)}>🗑</Button>
      </div>
    </div>
  )
}
