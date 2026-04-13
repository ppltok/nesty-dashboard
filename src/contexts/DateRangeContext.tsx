import { createContext, useContext, useState, type ReactNode } from 'react'
import type { DateRange } from '@/types/dashboard'

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function today(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

const presets: DateRange[] = [
  { label: 'Today', start: daysAgo(0), end: today() },
  { label: 'Yesterday', start: daysAgo(1), end: daysAgo(1) },
  { label: 'Last 7 days', start: daysAgo(7), end: today() },
  { label: 'Last 30 days', start: daysAgo(30), end: today() },
  { label: 'Last 90 days', start: daysAgo(90), end: today() },
  { label: 'All time', start: new Date('2025-01-01'), end: today() },
]

interface DateRangeContextValue {
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  presets: DateRange[]
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null)

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange>(presets[3]) // Last 30 days

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, presets }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be inside DateRangeProvider')
  return ctx
}
