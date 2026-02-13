import { useState } from 'react'
import type { Slot } from '../../types'
import { formatPrice } from '../../lib/format'
import Button from '../ui/Button'

interface SlotResultsProps {
  slots: Slot[]
  showDuration: boolean
  onBook: (slot: Slot) => Promise<void>
}

export default function SlotResults({ slots, showDuration, onBook }: SlotResultsProps) {
  const [bookingSlot, setBookingSlot] = useState<string | null>(null)

  if (slots.length === 0) return null

  async function handleBook(slot: Slot) {
    const key = `${slot.startAt}-${slot.playground.name}-${slot.duration}`
    setBookingSlot(key)
    try {
      await onBook(slot)
    } finally {
      setBookingSlot(null)
    }
  }

  return (
    <div className="mt-3.5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Heure</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Terrain</th>
            {showDuration && <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Durée</th>}
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Prix/pers</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => {
            const key = `${s.startAt}-${s.playground.name}-${s.duration}`
            return (
              <tr key={key} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-semibold text-slate-700">{s.startAt}</td>
                <td className="px-4 py-2.5 text-slate-500">{s.playground.name}</td>
                {showDuration && <td className="px-4 py-2.5 text-slate-500">{s.duration / 60} min</td>}
                <td className="px-4 py-2.5 text-slate-500">{formatPrice(s.price)}</td>
                <td className="px-4 py-2.5">
                  <Button variant="success" size="sm" onClick={() => handleBook(s)} loading={bookingSlot === key}>
                    Réserver
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
