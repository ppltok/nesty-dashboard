import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DateRangeProvider } from '@/contexts/DateRangeContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import LoginPage from '@/pages/LoginPage'
import OverviewPage from '@/pages/OverviewPage'
import FunnelPage from '@/pages/FunnelPage'
import EconomicsPage from '@/pages/EconomicsPage'
import StoresPage from '@/pages/StoresPage'
import CategoriesPage from '@/pages/CategoriesPage'
import ExtensionPage from '@/pages/ExtensionPage'
import GiftsPage from '@/pages/GiftsPage'
import GrowthPage from '@/pages/GrowthPage'
import TimelinePage from '@/pages/TimelinePage'
import EmailPage from '@/pages/EmailPage'
import SettingsPage from '@/pages/SettingsPage'
import { Loader2 } from 'lucide-react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function AuthGate() {
  const { access, loading, user, error } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  // Not logged in or unauthorized
  if (!user || !access || error === 'unauthorized') {
    return <LoginPage />
  }

  return (
    <DateRangeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/funnel" element={<FunnelPage />} />
            <Route path="/economics" element={<EconomicsPage />} />
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/extension" element={<ExtensionPage />} />
            <Route path="/gifts" element={<GiftsPage />} />
            <Route path="/growth" element={<GrowthPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/email" element={<EmailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DateRangeProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  )
}
