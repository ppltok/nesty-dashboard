import { useGrowthMetrics, useDailySignups } from '@/hooks/useDashboardData'
import { useDateRange } from '@/contexts/DateRangeContext'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { TrendChart } from '@/components/charts/TrendChart'
import { formatNumber, formatPercent } from '@/lib/formatters'
import {
  UserPlus, UserCheck, Zap, Share2, Puzzle, RotateCcw, Clock,
} from 'lucide-react'

export default function GrowthPage() {
  const { dateRange } = useDateRange()
  const growth = useGrowthMetrics(dateRange.start, dateRange.end)
  const signups = useDailySignups()

  if (growth.isLoading) return <PageSkeleton />
  if (growth.error)
    return <div className="p-6 text-red-600">Failed to load growth data: {growth.error.message}</div>

  const g = growth.data!
  const onboardingRate = g.total_signups_period > 0
    ? (g.onboarded_period / g.total_signups_period) * 100
    : 0

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
      {/* Row 1: Core signup metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="New Signups"
          value={formatNumber(g.total_signups_period)}
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
          title="Activation Rate"
          value={formatPercent(g.activation_rate)}
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          tooltip="Percentage of users who added their first item within 7 days of signing up. A key early engagement signal."
        />
        <KPICard
          title="Avg Time to First Item"
          value={`${(g.avg_hours_to_first_item ?? 0).toFixed(0)}h`}
          icon={<Clock className="h-5 w-5 text-cyan-500" />}
          tooltip="Average hours between signup and adding the first item to a registry."
        />
      </div>

      {/* Row 2: Engagement & retention */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="7-Day Retention"
          value={formatPercent(g.retention_7d)}
          icon={<RotateCcw className="h-5 w-5 text-purple-500" />}
          tooltip="Percentage of users who added an item 7+ days after signup. Only includes users who signed up at least 7 days ago."
        />
        <KPICard
          title="Extension Adoption"
          value={formatPercent(g.extension_install_rate)}
          icon={<Puzzle className="h-5 w-5 text-indigo-500" />}
          tooltip="Percentage of users (in this period) who used the Chrome extension to add at least one item."
        />
        <KPICard
          title="Share Rate"
          value={formatPercent(g.share_rate)}
          icon={<Share2 className="h-5 w-5 text-pink-500" />}
          tooltip="Percentage of users who completed onboarding and received a shareable registry link."
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
