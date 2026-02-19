import { useCallback } from 'react'
import { api } from '../api/client'
import type { BookResult, RetryStep } from '../types'

interface RuleInput {
  day_of_week: number
  target_time: string
  trigger_time: string
  duration: number
  playground_order: string[] | null
  retry_config: RetryStep[] | null
}

export function useRules() {
  const createRule = useCallback(async (rule: RuleInput) => {
    return api.post('/rules', rule)
  }, [])

  const updateRule = useCallback(async (id: number, updates: Partial<RuleInput & { enabled: boolean }>) => {
    return api.put(`/rules/${id}`, updates)
  }, [])

  const deleteRule = useCallback(async (id: number) => {
    return api.delete(`/rules/${id}`)
  }, [])

  const toggleRule = useCallback(async (id: number, enabled: boolean) => {
    return api.put(`/rules/${id}`, { enabled })
  }, [])

  const bookNow = useCallback(async (ruleId: number, date: string) => {
    return api.post<BookResult>('/book-now', { rule_id: ruleId, date })
  }, [])

  const cancelRetry = useCallback(async (retryId: number) => {
    return api.delete(`/retries/${retryId}`)
  }, [])

  return { createRule, updateRule, deleteRule, toggleRule, bookNow, cancelRetry }
}
