import { useDateRange } from '@/contexts/DateRangeContext'
import { useAuth } from '@/contexts/AuthContext'
import { CalendarDays, LogOut } from 'lucide-react'
import { cn } from '@/lib/cn'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const { dateRange, setDateRange, presets } = useDateRange()
  const { access, user, signOut } = useAuth()

  return (
    <header className="flex items-center justify-between h-15 px-6 bg-white border-b border-gray-200">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-4">
        <div className="relative flex items-center gap-2">
          <CalendarDays size={16} className="text-gray-400" />
          <select
            value={dateRange.label}
            onChange={(e) => {
              const preset = presets.find((p) => p.label === e.target.value)
              if (preset) setDateRange(preset)
            }}
            className={cn(
              'appearance-none bg-gray-50 border border-gray-200 rounded-lg',
              'px-3 py-1.5 pr-8 text-sm text-gray-700',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              'cursor-pointer'
            )}
          >
            {presets.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <span className="text-sm text-gray-600">
            {access?.display_name || user?.email}
          </span>
          <button
            onClick={signOut}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
