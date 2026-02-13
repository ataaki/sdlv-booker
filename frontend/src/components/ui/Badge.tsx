type BadgeVariant = 'success' | 'failed' | 'payment_failed' | 'no_slots' | 'pending' | 'skipped' | 'cancelled' | 'auto' | 'manual' | 'error'

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  payment_failed: 'bg-red-50 text-red-700',
  no_slots: 'bg-amber-50 text-amber-700',
  pending: 'bg-blue-50 text-blue-700',
  skipped: 'bg-violet-50 text-violet-700',
  cancelled: 'bg-stone-100 text-stone-600',
  auto: 'bg-sky-50 text-sky-700',
  manual: 'bg-fuchsia-50 text-purple-700',
  error: 'bg-red-50 text-red-700 border border-red-200',
}

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  title?: string
  className?: string
}

export default function Badge({ variant, children, title, className = '' }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${variantClasses[variant]} ${title ? 'cursor-help border-b border-dashed border-current' : ''} ${className}`}
    >
      {children}
    </span>
  )
}
