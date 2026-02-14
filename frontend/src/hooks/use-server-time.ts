import { useState, useEffect, useRef } from 'react'

export function useServerTime() {
  const [time, setTime] = useState<string | null>(null)
  const offsetRef = useRef(0)
  const tzRef = useRef<string>('Europe/Paris')

  useEffect(() => {
    async function sync() {
      try {
        const before = Date.now()
        const res = await fetch('/api/time')
        const { time: serverTime, timezone } = await res.json()
        const rtt = Date.now() - before
        offsetRef.current = new Date(serverTime).getTime() + rtt / 2 - Date.now()
        if (timezone) tzRef.current = timezone
      } catch {
        // fallback: no offset, use client time
      }
    }

    function tick() {
      const now = new Date(Date.now() + offsetRef.current)
      setTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tzRef.current }))
    }

    sync().then(tick)
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  return time
}
