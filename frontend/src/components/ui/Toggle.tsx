import { Switch } from '@headlessui/react'

interface ToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  label?: string
}

export default function Toggle({ enabled, onChange, label }: ToggleProps) {
  return (
    <Switch
      checked={enabled}
      onChange={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200
        ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      {label && <span className="sr-only">{label}</span>}
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200
          ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </Switch>
  )
}
