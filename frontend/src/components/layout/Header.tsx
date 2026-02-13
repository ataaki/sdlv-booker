import { useTheme } from '../../hooks/use-theme'
import Button from '../ui/Button'

interface HeaderProps {
  onOpenSettings: () => void
}

const THEME_CYCLE = ['system', 'light', 'dark'] as const

export default function Header({ onOpenSettings }: HeaderProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  function cycleTheme() {
    const idx = THEME_CYCLE.indexOf(theme)
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length])
  }

  const icon = resolvedTheme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'
  const label = theme === 'system' ? 'Auto' : theme === 'light' ? 'Clair' : 'Sombre'

  return (
    <header className="-mx-3 border-b border-slate-200 dark:border-slate-700 sm:-mx-5">
      <div className="max-w-5xl mx-auto px-3 py-4 flex items-center justify-between sm:px-5 sm:py-5">
        <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight sm:text-lg">Foot Du Lundi</h1>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Scheduler actif</span>
          </div>
          <button
            onClick={cycleTheme}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer sm:px-3 sm:py-1.5"
            title={`Theme: ${label}`}
          >
            <span>{icon}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
          <Button
            variant="icon"
            size="sm"
            onClick={onOpenSettings}
          >
            Parametres
          </Button>
        </div>
      </div>
    </header>
  )
}
