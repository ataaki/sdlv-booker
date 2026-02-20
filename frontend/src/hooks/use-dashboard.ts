import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'
import type { DashboardData } from '../types'

const NORMAL_INTERVAL = 60_000
const FAST_INTERVAL = 10_000

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentIntervalMs = useRef(NORMAL_INTERVAL)

  const refresh = useCallback(async () => {
    try {
      const result = await api.get<DashboardData>('/dashboard')
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  // Adjust polling interval based on active retries
  useEffect(() => {
    const hasActiveRetries = data?.active_retries?.some(
      r => r.status === 'active' || r.status === 'processing'
    )
    const targetInterval = hasActiveRetries ? FAST_INTERVAL : NORMAL_INTERVAL

    if (targetInterval !== currentIntervalMs.current) {
      currentIntervalMs.current = targetInterval
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(refresh, targetInterval)
    }
  }, [data, refresh])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, NORMAL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  return { data, loading, error, refresh }
}
