import { useState } from 'react'
import Button from '../ui/Button'

interface SlotSearchProps {
  loading: boolean
  onSearch: (params: { date: string; from: string; to: string; duration?: number }) => void
}

export default function SlotSearch({ loading, onSearch }: SlotSearchProps) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().split('T')[0]

  const [date, setDate] = useState(defaultDate)
  const [from, setFrom] = useState('19:00')
  const [to, setTo] = useState('22:00')
  const [duration, setDuration] = useState<string>('')

  function handleSearch() {
    if (!date) return
    onSearch({ date, from, to, duration: duration ? Number(duration) : undefined })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col gap-3.5">
        <div className="max-w-[280px] max-sm:max-w-none">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 max-sm:text-base max-sm:min-h-12"
          />
        </div>
        <div className="grid grid-cols-2 gap-3.5 max-w-[400px] max-sm:max-w-none">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">De</label>
            <input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 max-sm:text-base max-sm:min-h-12"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">À</label>
            <input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 max-sm:text-base max-sm:min-h-12"
            />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3.5 items-end max-w-[400px] max-sm:max-w-none max-sm:grid-cols-1">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Durée</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 max-sm:text-base max-sm:min-h-12"
            >
              <option value="">Toutes</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">120 min</option>
            </select>
          </div>
          <Button variant="primary" onClick={handleSearch} loading={loading} className="max-sm:w-full">
            Rechercher
          </Button>
        </div>
      </div>
    </div>
  )
}
