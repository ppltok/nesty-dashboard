import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LogOut, Menu, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DateRangePicker } from './DateRangePicker'

interface HeaderProps {
  title: string
  onMenuClick: () => void
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const { access, user, signOut } = useAuth()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await supabase.rpc('refresh_dashboard_views')
      await queryClient.invalidateQueries()
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <header className="flex items-center justify-between h-15 px-3 sm:px-6 bg-white border-b border-gray-200">
      <div className="flex items-center min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg mr-2 shrink-0"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Refresh button — icon only on mobile */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            'flex items-center gap-1.5 text-sm px-2 sm:px-3 py-1.5 rounded-lg border transition-colors',
            refreshing
              ? 'text-blue-500 border-blue-200 bg-blue-50 cursor-not-allowed'
              : 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:text-gray-900'
          )}
          title="Refresh materialized views and reload all data"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>

        {/* Date range picker */}
        <DateRangePicker />

        {/* User info — hidden on small mobile, show on sm+ */}
        <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-200">
          <span className="text-sm text-gray-600 truncate max-w-[120px]">
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
        {/* Logout icon only on tiny mobile */}
        <button
          onClick={signOut}
          className="sm:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
