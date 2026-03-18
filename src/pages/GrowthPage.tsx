import { useOverview, useDailySignups } from '@/hooks/useDashboardData'
import { useDateRange } from '@/contexts/DateRangeContext'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { TrendChart } from '@/components/charts/TrendChart'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { UserPlus, UserCheck, BarChart3 } from 'lucide-react'

export default function GrowthPage() {
  const { dateRange } = useDateRange()
  const overview = useOverview(dateRange.start, dateRange.end)
  const signups = useDailySignups()

  if (overview.isLoading) return <PageSkeleton />
  if (overview.error)
    return <div className="p-6 text-red-600">Failed to load growth data: {overview.error.message}</div>

  const data = overview.data!
  const onboardingRate = data.new_users > 0 ? (data.onboarded_users / data.new_users) * 100 : 0

  const trendData = (signups.data ?? []).filter(d => {
    const date = new Date(d.day)
    return date >= dateRange.start && date <= dateRange.end
  }).map((d) => ({
    day: d.day,
    signups: d.signups,
    onboarded: d.onboarded,
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="New Signups"
          value={formatNumber(data.new_users)}
          icon={<UserPlus className="h-5 w-5 text-blue-500" />}
          tooltip="Number of new user registrations in the selected time period."
        />
        <KPICard
          title="Onboarding Rate"
          value={formatPercent(onboardingRate)}
          icon={<UserCheck className="h-5 w-5 text-green-500" />}
          tooltip="Percentage of signed-up users who completed the onboarding flow (set due date, created registry)."
        />
        <KPICard
          title="Onboarded Users"
          value={formatNumber(data.onboarded_users)}
          icon={<BarChart3 className="h-5 w-5 text-indigo-500" />}
          tooltip="Total users who completed onboarding in the selected time period."
        />
      </div>

      {/* Daily Signups Trend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Daily Signups & Onboarded</h2>
        {signups.isLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
        ) : trendData.length > 0 ? (
          <TrendChart
            data={trendData}
            height={350}
            lines={[
              { key: 'signups', color: '#6366f1', label: 'Signups' },
              { key: 'onboarded', color: '#10b981', label: 'Onboarded' },
            ]}
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
        )}
      </div>

      {/* GA4 Link */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium text-gray-900">Google Analytics (GA4)</h2>
          <a
            href="https://analytics.google.com/analytics/web/#/p477498420/reports/intelligenthome"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Open GA4 Dashboard →
          </a>
        </div>
        <p className="text-sm text-gray-500">
          GA4 is tracking page views on dashboard.nestyil.com (ID: G-VFSHSL1MP9). For traffic sources, acquisition channels, and behavior analytics, view the full report in Google Analytics.
        </p>
      </div>
    </div>
  )
}
