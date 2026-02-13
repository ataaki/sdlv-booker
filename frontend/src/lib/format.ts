export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateTime(dtStr: string | null | undefined): string {
  if (!dtStr) return '-'
  const d = new Date(dtStr + 'Z')
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '-'
  return new Date(isoStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return '-'
  return `${(cents / 100).toFixed(2)} EUR`
}
