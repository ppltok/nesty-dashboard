import { useOverview, useFunnel, useStores, useCategories, useDailySignups, useDailyActiveRegistries } from '@/hooks/useDashboardData'
import { useDateRange } from '@/contexts/DateRangeContext'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { TrendChart } from '@/components/charts/TrendChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/formatters'
// BarChartComponent removed — unused on this page
import {
  Gift,
  Users,
  UserPlus,
  ClipboardList,
  DollarSign,
  BarChart3,
  Package,
  CheckCircle,
  Puzzle,
  Handshake,
} from 'lucide-react'

/** Compute % change and formatted label */
function trend(current: number, previous: number): { change?: string; changePositive?: boolean } {
  if (previous === 0 && current === 0) return {}
  if (previous === 0) return { change: 'New', changePositive: true }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) return {}
  return {
    change: `${Math.abs(Math.round(pct))}%`,
    changePositive: pct > 0,
  }
}

export default function OverviewPage() {
  const { dateRange } = useDateRange()
  const overview = useOverview(dateRange.start, dateRange.end)
  const funnel = useFunnel()
  const stores = useStores()
  const categories = useCategories()
  const signups = useDailySignups()
  const dailyActive = useDailyActiveRegistries()

  if (overview.isLoading) return <PageSkeleton />
  if (overview.error) return <div className="p-6 text-red-600">Failed to load overview: {overview.error.message}</div>

  const data = overview.data!

  const extensionAdoption =
    data.total_users_with_items > 0
      ? (data.extension_users / data.total_users_with_items) * 100
      : 0

  // Trend calculations
  const newUsersTrend = trend(data.new_users, data.prev_new_users ?? 0)
  const registriesTrend = trend(data.active_registries, data.prev_active_registries ?? data.active_registries)
  const gmvTrend = trend(data.platform_gmv, data.prev_platform_gmv ?? data.platform_gmv)

  // Active-registry rate: of the new signups this period, how many have an
  // active registry? Literal ratio `active_registries / new_users` — can
  // exceed 100% when existing users are active too (we surface that as-is;
  // it's informative signal that older cohorts stay engaged).
  const activeRate = data.new_users > 0 ? (data.active_registries / data.new_users) * 100 : 0
  const prevActiveRate =
    (data.prev_new_users ?? 0) > 0
      ? ((data.prev_active_registries ?? 0) / (data.prev_new_users ?? 1)) * 100
      : 0
  const activeRateTrend = trend(activeRate, prevActiveRate)

  const CATEGORY_LABELS: Record<string, string> = {
    strollers: 'Strollers', car_safety: 'Car Safety', furniture: 'Furniture',
    safety: 'Safety', feeding: 'Feeding', nursing: 'Nursing',
    bath: 'Bath', clothing: 'Clothing', bedding: 'Bedding', toys: 'Toys',
  }

  const funnelData = funnel.data ?? []
  const topStores = (stores.data ?? []).slice(0, 5)
  const categoryData = (categories.data ?? []).map((c) => ({
    name: CATEGORY_LABELS[c.category] ?? c.category,
    value: c.item_count,
  }))

  return (
    <div className="space-y-6">
      {/* KPI Row 1 — period-filtered headline metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="North Star (Gifted 30d)"
          value={formatNumber(data.north_star_30d)}
          icon={<Gift className="h-5 w-5 text-pink-500" />}
          tooltip="Registries that received at least one confirmed gift in the last 30 days. This is our primary success metric."
        />
        <KPICard
          title="New Signups (period)"
          value={formatNumber(data.new_users)}
          icon={<UserPlus className="h-5 w-5 text-blue-500" />}
          tooltip="Users who signed up during the selected date range. Updates with the date filter."
          change={newUsersTrend.change}
          changePositive={newUsersTrend.changePositive}
          subtitle="vs prev period"
        />
        <KPICard
          title="Active Registries"
          value={formatNumber(data.active_registries)}
          icon={<ClipboardList className="h-5 w-5 text-green-500" />}
          tooltip="Registries that had at least one item added during the selected period."
          change={registriesTrend.change}
          changePositive={registriesTrend.changePositive}
          subtitle="vs prev period"
        />
        <KPICard
          title="Platform GMV"
          value={formatCurrency(data.platform_gmv)}
          icon={<DollarSign className="h-5 w-5 text-yellow-500" />}
          tooltip="Gross Merchandise Value — total wishlist value (price x quantity) across all registries."
          change={gmvTrend.change}
          changePositive={gmvTrend.changePositive}
          subtitle="vs prev period"
        />
      </div>

      {/* KPI Row 2 — all-time / structural metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Total Users"
          value={formatNumber(data.total_users)}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          tooltip="All signed-up users across all time (cumulative, not filtered by date range)."
          subtitle="all-time"
        />
        <KPICard
          title="Co-parents"
          value={formatNumber(data.co_parents_count)}
          icon={<Handshake className="h-5 w-5 text-rose-500" />}
          tooltip="Registries with an accepted co-parent invitation. Counts distinct registries with a linked partner."
          subtitle="registries w/ partner"
        />
        <KPICard
          title="Avg Registry Value"
          value={formatCurrency(data.avg_registry_value)}
          icon={<BarChart3 className="h-5 w-5 text-indigo-500" />}
          tooltip="Average total wishlist value (price x quantity) per registry."
        />
        <KPICard
          title="Avg Items/Registry"
          value={formatNumber(data.avg_items_per_registry)}
          icon={<Package className="h-5 w-5 text-teal-500" />}
          tooltip="Average number of items added per active registry."
        />
        <KPICard
          title="Active Registry Rate"
          value={formatPercent(activeRate)}
          icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
          tooltip="Active registries ÷ new signups (this period). Can exceed 100% when older cohorts stay active alongside fresh signups."
          change={activeRateTrend.change}
          changePositive={activeRateTrend.changePositive}
          subtitle="vs prev period"
        />
        <KPICard
          title="Extension Adoption"
          value={formatPercent(extensionAdoption)}
          icon={<Puzzle className="h-5 w-5 text-purple-500" />}
          tooltip="Percentage of users with items who added at least one item via the Chrome extension (vs manual entry)."
        />
      </div>

      {/* Signups Trend + Active Registries overlay */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Daily Signups &amp; Active Registries</h2>
        {(signups.isLoading || dailyActive.isLoading) ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
        ) : (
          <TrendChart
            data={(() => {
              // Merge the two series into one row-per-day so the chart can
              // render both lines on a shared x-axis. Days present in either
              // series become a row; missing values become 0 so the line
              // still draws across the range.
              const activeByDay = new Map<string, number>()
              for (const d of dailyActive.data ?? []) activeByDay.set(d.day, d.active_registries)
              const signupByDay = new Map<string, number>()
              for (const d of signups.data ?? []) signupByDay.set(d.day, d.signups)

              const allDays = new Set<string>([...activeByDay.keys(), ...signupByDay.keys()])
              return Array.from(allDays)
                .sort()
                .filter((day) => {
                  const date = new Date(day)
                  return date >= dateRange.start && date <= dateRange.end
                })
                .map((day) => ({
                  day,
                  signups: signupByDay.get(day) ?? 0,
                  active_registries: activeByDay.get(day) ?? 0,
                }))
            })()}
            lines={[
              { key: 'signups', color: '#6366f1', label: 'Signups' },
              { key: 'active_registries', color: '#10b981', label: 'Active Registries' },
            ]}
            height={280}
            xAxisLabel="Date"
            yAxisLabel="Count"
          />
        )}
      </div>

      {/* Bottom Grid: Funnel + Top Stores + Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mini Funnel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Funnel</h2>
          {funnel.isLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-3">
              {funnelData.map((stage) => {
                const maxCount = funnelData[0]?.count || 1
                const widthPct = (stage.count / maxCount) * 100
                return (
                  <div key={stage.stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 capitalize">{stage.stage.replace('_', ' ')}</span>
                      <span className="font-medium text-gray-900">{formatNumber(stage.count)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div
                        className="bg-indigo-500 h-3 rounded-full transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top 5 Stores */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top 5 Stores</h2>
          {stores.isLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-3">
              {topStores.map((store, i) => (
                <div key={store.store_domain} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-400 w-5">{i + 1}</span>
                    <span className="text-sm text-gray-900">{store.store_display_name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {formatNumber(store.item_count)} items
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Donut */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Categories</h2>
          {categories.isLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <DonutChart data={categoryData} height={240} />
          )}
        </div>
      </div>
    </div>
  )
}
