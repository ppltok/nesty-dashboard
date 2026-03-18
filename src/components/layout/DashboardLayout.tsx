import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/funnel': 'Conversion Funnel',
  '/economics': 'Registry Economics',
  '/stores': 'Store Distribution',
  '/categories': 'Category Breakdown',
  '/extension': 'Chrome Extension',
  '/gifts': 'Gift Giver Insights',
  '/growth': 'Growth & Acquisition',
  '/timeline': 'Pregnancy Timeline',
  '/settings': 'Settings',
}

export function DashboardLayout() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || 'Dashboard'

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
