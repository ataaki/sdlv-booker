interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5 border-[1.5px]',
  md: 'w-5 h-5 border-2',
  lg: 'w-8 h-8 border-[2.5px]',
}

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-slate-300 border-t-slate-900 ${sizeClasses[size]} ${className}`}
    />
  )
}
