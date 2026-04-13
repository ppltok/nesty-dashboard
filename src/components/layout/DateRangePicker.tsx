import { useState, useRef, useEffect, useMemo } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useDateRange } from '@/contexts/DateRangeContext'

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: -1 },
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function isBetween(date: Date, start: Date, end: Date) {
  const d = date.getTime()
  return d >= start.getTime() && d <= end.getTime()
}

function formatShort(d: Date) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export function DateRangePicker() {
  const { dateRange, setDateRange, presets } = useDateRange()
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null)
  const [tempStart, setTempStart] = useState<Date>(dateRange.start)
  const [tempEnd, setTempEnd] = useState<Date>(dateRange.end)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const [leftMonth, setLeftMonth] = useState(() => {
    const d = new Date(dateRange.start)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const ref = useRef<HTMLDivElement>(null)

  const rightMonth = useMemo(() => {
    let m = leftMonth.month + 1
    let y = leftMonth.year
    if (m > 11) { m = 0; y++ }
    return { year: y, month: m }
  }, [leftMonth])

  // Close on outside click (desktop only)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Lock body scroll on mobile when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Sync temp dates when dateRange changes externally
  useEffect(() => {
    setTempStart(dateRange.start)
    setTempEnd(dateRange.end)
  }, [dateRange])

  const activePresetLabel = presets.find(
    p => isSameDay(p.start, dateRange.start) && isSameDay(p.end, dateRange.end)
  )?.label

  const handlePreset = (preset: typeof PRESETS[0]) => {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    let start: Date
    if (preset.days === -1) {
      start = new Date('2025-01-01')
    } else if (preset.days === 0) {
      start = new Date()
      start.setHours(0, 0, 0, 0)
    } else if (preset.days === 1) {
      start = daysAgo(1)
      const yesterday = daysAgo(1)
      yesterday.setHours(23, 59, 59, 999)
      setDateRange({ label: preset.label, start, end: yesterday })
      setTempStart(start)
      setTempEnd(yesterday)
      setOpen(false)
      return
    } else {
      start = daysAgo(preset.days)
    }
    setDateRange({ label: preset.label, start, end })
    setTempStart(start)
    setTempEnd(end)
    setOpen(false)
  }

  const handleDayClick = (date: Date) => {
    if (!selecting || selecting === 'start') {
      setTempStart(date)
      setTempEnd(date)
      setSelecting('end')
    } else {
      if (date < tempStart) {
        setTempEnd(tempStart)
        setTempStart(date)
      } else {
        setTempEnd(date)
      }
      setSelecting(null)
    }
  }

  const handleApply = () => {
    const start = new Date(tempStart)
    start.setHours(0, 0, 0, 0)
    const end = new Date(tempEnd)
    end.setHours(23, 59, 59, 999)
    setDateRange({
      label: `${formatShort(start)} – ${formatShort(end)}`,
      start,
      end,
    })
    setOpen(false)
    setSelecting(null)
  }

  const handleCancel = () => {
    setTempStart(dateRange.start)
    setTempEnd(dateRange.end)
    setOpen(false)
    setSelecting(null)
  }

  const navigateMonth = (dir: -1 | 1) => {
    setLeftMonth(prev => {
      let m = prev.month + dir
      let y = prev.year
      if (m < 0) { m = 11; y-- }
      if (m > 11) { m = 0; y++ }
      return { year: y, month: m }
    })
  }

  const displayLabel = activePresetLabel || `${formatShort(dateRange.start)} – ${formatShort(dateRange.end)}`

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(!open); setSelecting(null) }}
        className={cn(
          'flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 text-sm rounded-lg border transition-colors',
          open
            ? 'border-blue-500 ring-2 ring-blue-100 bg-white text-gray-900'
            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
        )}
      >
        <CalendarDays size={15} className="text-gray-400 shrink-0" />
        <span className="hidden sm:inline whitespace-nowrap">{displayLabel}</span>
        <span className="sm:hidden whitespace-nowrap text-xs">{activePresetLabel || 'Date'}</span>
      </button>

      {/* Mobile: full-screen overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/30" onClick={handleCancel} />
      )}

      {/* Dropdown / Mobile sheet */}
      {open && (
        <div className={cn(
          'z-50 bg-white overflow-hidden',
          // Mobile: bottom sheet style
          'fixed inset-x-0 bottom-0 top-auto rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto',
          // Desktop: absolute dropdown
          'md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 md:rounded-xl md:shadow-xl md:border md:border-gray-200 md:max-h-none md:overflow-visible',
          'md:flex',
        )}>
          {/* Mobile close header */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Select Date Range</span>
            <button onClick={handleCancel} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
              <X size={20} />
            </button>
          </div>

          {/* Presets — horizontal on mobile, sidebar on desktop */}
          <div className={cn(
            // Mobile: horizontal scrolling row
            'flex md:flex-col gap-1.5 px-4 py-3 md:py-2 md:px-0 overflow-x-auto md:overflow-x-visible',
            // Desktop: sidebar
            'md:w-40 md:border-r md:border-gray-100 md:bg-gray-50/50',
          )}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                className={cn(
                  'whitespace-nowrap text-sm transition-colors rounded-lg md:rounded-none',
                  // Mobile: pill buttons
                  'px-3 py-1.5 border md:border-0 md:w-full md:text-left md:px-4 md:py-2',
                  activePresetLabel === p.label
                    ? 'bg-blue-50 text-blue-600 font-medium border-blue-200 md:border-0'
                    : 'text-gray-600 hover:bg-blue-50 border-gray-200 md:border-0'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar area */}
          <div className="p-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                <ChevronLeft size={16} />
              </button>
              <div className="flex gap-4 md:gap-12">
                <span className="text-sm font-semibold text-gray-900">
                  {MONTH_NAMES[leftMonth.month]} {leftMonth.year}
                </span>
                {/* Second month header — hidden on mobile */}
                <span className="hidden md:inline text-sm font-semibold text-gray-900">
                  {MONTH_NAMES[rightMonth.month]} {rightMonth.year}
                </span>
              </div>
              <button onClick={() => navigateMonth(1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Calendars: single on mobile, two on desktop */}
            <div className="flex gap-6 justify-center">
              <MonthGrid
                year={leftMonth.year}
                month={leftMonth.month}
                tempStart={tempStart}
                tempEnd={tempEnd}
                selecting={selecting}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
              />
              {/* Second calendar — desktop only */}
              <div className="hidden md:block">
                <MonthGrid
                  year={rightMonth.year}
                  month={rightMonth.month}
                  tempStart={tempStart}
                  tempEnd={tempEnd}
                  selecting={selecting}
                  hoverDate={hoverDate}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDate}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                {formatShort(tempStart)} – {formatShort(tempEnd)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface MonthGridProps {
  year: number
  month: number
  tempStart: Date
  tempEnd: Date
  selecting: 'start' | 'end' | null
  hoverDate: Date | null
  onDayClick: (date: Date) => void
  onDayHover: (date: Date | null) => void
}

function MonthGrid({ year, month, tempStart, tempEnd, selecting, hoverDate, onDayClick, onDayHover }: MonthGridProps) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rangeEnd = selecting === 'end' && hoverDate ? hoverDate : tempEnd

  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d))
  }

  return (
    <div className="w-[224px]">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="h-8" />

          const isToday = isSameDay(date, today)
          const isStart = isSameDay(date, tempStart)
          const isEnd = isSameDay(date, rangeEnd)
          const inRange = tempStart && rangeEnd && isBetween(date, tempStart, rangeEnd)
          const isFuture = date > today

          return (
            <button
              key={date.toISOString()}
              onClick={() => !isFuture && onDayClick(date)}
              onMouseEnter={() => onDayHover(date)}
              onMouseLeave={() => onDayHover(null)}
              disabled={isFuture}
              className={cn(
                'h-8 w-8 text-xs rounded-full transition-colors relative flex items-center justify-center',
                isFuture && 'text-gray-300 cursor-not-allowed',
                !isFuture && !isStart && !isEnd && !inRange && 'text-gray-700 hover:bg-gray-100',
                inRange && !isStart && !isEnd && 'bg-blue-50 text-blue-700 rounded-none',
                (isStart || isEnd) && 'bg-blue-600 text-white font-medium',
                isStart && inRange && !isEnd && 'rounded-r-none',
                isEnd && inRange && !isStart && 'rounded-l-none',
                isToday && !isStart && !isEnd && 'ring-1 ring-blue-400',
              )}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
