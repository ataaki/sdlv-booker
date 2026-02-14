export interface Rule {
  id: number
  day_of_week: number
  target_time: string
  trigger_time: string
  duration: number
  activity: string
  playground_order: string[] | null
  enabled: boolean
  created_at: string
  day_name: string
  duration_label: string
  j45: J45Info
}

export interface J45Info {
  target_date: string
  attempt_date: string
  days_until_attempt: number
}

export interface DashboardData {
  rules: Rule[]
  recent_logs: Log[]
  credentials_configured: boolean
  config: DashboardConfig
}

export interface DashboardConfig {
  advance_days: number
  timezone: string
  playgrounds: Record<string, string>
  playground_names: string[]
  durations: number[]
  day_names: string[]
}

export interface Booking {
  id: string
  date: string
  startAt: string
  endAt: string
  playground: string
  pricePerParticipant: number
  confirmed: boolean
  canceled: boolean
}

export interface BookingsResponse {
  bookings: Booking[]
  total: number
  totalPages: number
  hasMore: boolean
}

export interface Log {
  id: number
  rule_id: number | null
  target_date: string
  target_time: string
  booked_time: string | null
  playground: string | null
  status: string
  booking_id: string | null
  error_message: string | null
  created_at: string
}

export interface Slot {
  playground: { id: string; name: string }
  startAt: string
  priceId: string
  price: number
  duration: number
  participantCount: number
}

export interface BookResult {
  status: 'success' | 'skipped' | 'no_slots' | 'failed'
  target_date?: string
  booked_time?: string
  playground?: string
  booking_id?: string
  price?: number
  error?: string
  error_message?: string
}

export type ToastType = 'success' | 'error' | 'warning' | 'info'
