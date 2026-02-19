import type { RetryStep } from '../../types'

interface RetryStepsEditorProps {
  steps: RetryStep[]
  onChange: (steps: RetryStep[]) => void
}

const UNIT_OPTIONS = [
  { value: 1, label: 'min' },
  { value: 60, label: 'h' },
]

function delayToUnitValue(delayMinutes: number): { value: number; unit: number } {
  if (delayMinutes >= 60 && delayMinutes % 60 === 0) {
    return { value: delayMinutes / 60, unit: 60 }
  }
  return { value: delayMinutes, unit: 1 }
}

function formatStepSummary(step: RetryStep): string {
  const { value, unit } = delayToUnitValue(step.delay_minutes)
  const unitLabel = unit === 60 ? 'h' : 'min'
  const countLabel = step.count === 0 ? 'retry ind\u00e9finiment' : `${step.count} tentative${step.count > 1 ? 's' : ''}`
  return `${countLabel} toutes les ${value} ${unitLabel}`
}

export default function RetryStepsEditor({ steps, onChange }: RetryStepsEditorProps) {
  function updateStep(index: number, field: 'count' | 'delay_minutes', value: number) {
    const updated = [...steps]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  function updateStepDelay(index: number, value: number, unit: number) {
    const updated = [...steps]
    updated[index] = { ...updated[index], delay_minutes: value * unit }
    onChange(updated)
  }

  function addStep() {
    onChange([...steps, { count: 5, delay_minutes: 5 }])
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const { value: delayValue, unit: delayUnit } = delayToUnitValue(step.delay_minutes)
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="number"
                min={0}
                value={step.count}
                onChange={(e) => updateStep(i, 'count', Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 px-2 py-1.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                title="Nombre de tentatives (0 = infini)"
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {step.count === 0 ? '(\u221e)' : '\u00d7'}
              </span>
              <span className="text-xs text-slate-500 whitespace-nowrap">toutes les</span>
              <input
                type="number"
                min={1}
                value={delayValue}
                onChange={(e) => updateStepDelay(i, Math.max(1, parseInt(e.target.value) || 1), delayUnit)}
                className="w-16 px-2 py-1.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
              <select
                value={delayUnit}
                onChange={(e) => updateStepDelay(i, delayValue, parseInt(e.target.value))}
                className="px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            {steps.length > 1 && (
              <button
                type="button"
                onClick={() => removeStep(i)}
                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                title="Supprimer cette \u00e9tape"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={addStep}
        className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium transition-colors"
      >
        + Ajouter une \u00e9tape
      </button>

      {steps.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
          {steps.map(formatStepSummary).join(', puis ')}
        </p>
      )}
    </div>
  )
}
