import { useToast } from '../../hooks/use-toast'
import type { ToastType } from '../../types'

const icons: Record<ToastType, string> = {
  success: '\u2705',
  error: '\u274C',
  warning: '\u26A0\uFE0F',
  info: '\u2139\uFE0F',
}

const borderColors: Record<ToastType, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-sky-500',
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md pointer-events-none max-sm:top-auto max-sm:bottom-4 max-sm:left-3 max-sm:right-3 max-sm:max-w-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-lg border-l-4 ${borderColors[t.type]} animate-[slideIn_0.3s_ease-out]`}
        >
          <span className="text-lg shrink-0">{icons[t.type]}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{t.title}</div>
            {t.message && (
              <div className="text-xs text-slate-500 mt-0.5 break-words">{t.message}</div>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none shrink-0 cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
