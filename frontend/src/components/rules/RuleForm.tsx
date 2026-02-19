import { useState, useEffect } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'
import { DAY_OPTIONS, DURATION_OPTIONS } from '../../lib/constants'
import type { Rule, DashboardConfig, RetryStep } from '../../types'
import Button from '../ui/Button'
import PlaygroundPrefs from './PlaygroundPrefs'
import RetryStepsEditor from './RetryStepsEditor'

interface RuleFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: {
    day_of_week: number; target_time: string; trigger_time: string; duration: number;
    playground_order: string[] | null; retry_config: RetryStep[] | null
  }) => Promise<void>
  rule: Rule | null
  config: DashboardConfig
}

export default function RuleForm({ open, onClose, onSave, rule, config }: RuleFormProps) {
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [targetTime, setTargetTime] = useState('19:00')
  const [triggerTime, setTriggerTime] = useState('00:00')
  const [duration, setDuration] = useState(60)
  const [playgroundOrder, setPlaygroundOrder] = useState<string[]>([])
  const [retryEnabled, setRetryEnabled] = useState(false)
  const [retrySteps, setRetrySteps] = useState<RetryStep[]>([{ count: 5, delay_minutes: 5 }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (rule) {
      setDayOfWeek(rule.day_of_week)
      setTargetTime(rule.target_time)
      setTriggerTime(rule.trigger_time || '00:00')
      setDuration(rule.duration)
      setPlaygroundOrder(rule.playground_order ?? [])
      if (rule.retry_config && rule.retry_config.length > 0) {
        setRetryEnabled(true)
        setRetrySteps(rule.retry_config)
      } else {
        setRetryEnabled(false)
        setRetrySteps([{ count: 5, delay_minutes: 5 }])
      }
    } else {
      setDayOfWeek(1)
      setTargetTime('19:00')
      setTriggerTime('00:00')
      setDuration(60)
      setPlaygroundOrder([])
      setRetryEnabled(false)
      setRetrySteps([{ count: 5, delay_minutes: 5 }])
    }
  }, [rule, open])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        day_of_week: dayOfWeek,
        target_time: targetTime,
        trigger_time: triggerTime,
        duration,
        playground_order: playgroundOrder.length > 0 ? playgroundOrder : null,
        retry_config: retryEnabled ? retrySteps : null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-[10000]">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center sm:p-5">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-250"
            enterFrom="opacity-0 translate-y-full sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-full sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl rounded-b-none sm:rounded-b-2xl p-7 shadow-xl">
              <DialogTitle className="text-lg font-bold mb-5">
                {rule ? 'Modifier la règle' : 'Ajouter une règle'}
              </DialogTitle>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Jour</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-base min-h-12 sm:text-sm sm:min-h-0 bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Heure cible</label>
                  <input
                    type="time"
                    value={targetTime}
                    onChange={(e) => setTargetTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-base min-h-12 sm:text-sm sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Déclenchement</label>
                  <input
                    type="time"
                    value={triggerTime}
                    onChange={(e) => setTriggerTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-base min-h-12 sm:text-sm sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Durée</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-base min-h-12 sm:text-sm sm:min-h-0 bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Préférence de terrains (glisser pour ordonner, décocher pour exclure)
                </label>
                <PlaygroundPrefs
                  allNames={config.playground_names}
                  selected={playgroundOrder}
                  onChange={setPlaygroundOrder}
                />
              </div>

              <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500">
                    Retry si aucun slot disponible
                  </label>
                  <button
                    type="button"
                    onClick={() => setRetryEnabled(!retryEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${retryEnabled ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${retryEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {retryEnabled && (
                  <RetryStepsEditor steps={retrySteps} onChange={setRetrySteps} />
                )}
              </div>

              <div className="flex flex-col-reverse gap-2.5 mt-6 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
                <Button variant="primary" onClick={handleSave} loading={saving}>Enregistrer</Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
