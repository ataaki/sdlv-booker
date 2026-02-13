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

  const label = theme === 'system' ? 'Auto' : theme === 'light' ? 'Clair' : 'Sombre'

  const icon = resolvedTheme === 'dark' ? (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  )

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
            aria-label={`Changer le theme, actuellement : ${label}`}
            title={`Theme: ${label}`}
          >
            {icon}
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
