import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Filter,
  DollarSign,
  Store,
  Grid3X3,
  Puzzle,
  Gift,
  TrendingUp,
  Calendar,
  Mail,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/funnel', icon: Filter, label: 'Funnel' },
  { to: '/economics', icon: DollarSign, label: 'Economics' },
  { to: '/stores', icon: Store, label: 'Stores' },
  { to: '/categories', icon: Grid3X3, label: 'Categories' },
  { to: '/extension', icon: Puzzle, label: 'Extension' },
  { to: '/gifts', icon: Gift, label: 'Gifts' },
  { to: '/growth', icon: TrendingUp, label: 'Growth' },
  { to: '/timeline', icon: Calendar, label: 'Timeline' },
  { to: '/email', icon: Mail, label: 'Email' },
]

const bottomItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-200',
          // Desktop: static sidebar
          'lg:relative lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-60',
          // Mobile: fixed overlay
          'fixed inset-y-0 left-0 z-50',
          isOpen ? 'translate-x-0 w-60' : '-translate-x-full lg:translate-x-0',
        )}
      >
      {/* Logo */}
      <div className="flex items-center justify-between h-15 px-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            <img src="/Circle_logo.png" alt="Nesty" className="w-7 h-7 object-contain" />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-gray-900">Nesty</span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-100 text-gray-400"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            <item.icon size={18} className="shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Divider + Settings */}
      <div className="border-t border-gray-200 py-3 px-2">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            <item.icon size={18} className="shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </div>
      </aside>
    </>
  )
}
