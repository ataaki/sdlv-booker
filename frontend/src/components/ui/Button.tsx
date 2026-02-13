import { type ButtonHTMLAttributes, forwardRef } from 'react'
import Spinner from './Spinner'

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'icon'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:border-slate-300',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600',
  ghost: 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
  icon: 'text-slate-500 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, disabled, className = '', ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold transition-all cursor-pointer
        disabled:opacity-60 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

export default Button
