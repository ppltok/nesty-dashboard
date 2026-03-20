import { useOverview, usePreviousOverview, useFunnel, useStores, useCategories, useDailySignups } from '@/hooks/useDashboardData'
import { useDateRange } from '@/contexts/DateRangeContext'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { TrendChart } from '@/components/charts/TrendChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { formatNumber, formatCurrency, formatPercent, formatChange } from '@/lib/formatters'
import {
  Gift,
  Users,
  ClipboardList,
  DollarSign,
  BarChart3,
  Package,
  CheckCircle,
  Puzzle,
} from 'lucide-react'

export default function OverviewPage() {
  const { dateRange } = useDateRange()
  const overview = useOverview(dateRange.start, dateRange.end)
  const prev = usePreviousOverview(dateRange.start, dateRange.end)
  const funnel = useFunnel()
  const stores = useStores()
  const categories = useCategories()
  const signups = useDailySignups()

  if (overview.isLoading) return <PageSkeleton />
  if (overview.error) return <div className="p-6 text-red-600">Failed to load overview: {overview.error.message}</div>

  const data = overview.data!
  const prevData = prev.data

  function trend(current: number, previous: number | undefined) {
    if (previous == null) return {}
    const { value, positive } = formatChange(current, previous)
    return { change: value, changePositive: positive, subtitle: 'vs prev period' }
  }

  const extensionAdoption =
    data.total_users_with_items > 0
      ? (data.extension_users / data.total_users_with_items) * 100
      : 0

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
      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="North Star (Gifted 30d)"
          value={formatNumber(data.north_star_30d)}
          icon={<Gift className="h-5 w-5 text-pink-500" />}
          tooltip="Registries that received at least one confirmed gift in the last 30 days. This is our primary success metric."
          {...trend(data.north_star_30d, prevData?.north_star_30d)}
        />
        <KPICard
          title="Total Users"
          value={formatNumber(data.total_users)}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          tooltip="Total number of signed-up users across all time, including those who haven't completed onboarding."
          {...trend(data.total_users, prevData?.total_users)}
        />
        <KPICard
          title="Active Registries"
          value={formatNumber(data.active_registries)}
          icon={<ClipboardList className="h-5 w-5 text-green-500" />}
          tooltip="Registries that have at least one item added. Indicates users who moved past onboarding."
          {...trend(data.active_registries, prevData?.active_registries)}
        />
        <KPICard
          title="Platform GMV"
          value={formatCurrency(data.platform_gmv)}
          icon={<DollarSign className="h-5 w-5 text-yellow-500" />}
          tooltip="Gross Merchandise Value — total price of all items across all registries. Represents the platform's total addressable gift value."
          {...trend(data.platform_gmv, prevData?.platform_gmv)}
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Avg Registry Value"
          value={formatCurrency(data.avg_registry_value)}
          icon={<BarChart3 className="h-5 w-5 text-indigo-500" />}
          tooltip="Average total value (sum of item prices) per registry that has at least one item."
          {...trend(data.avg_registry_value, prevData?.avg_registry_value)}
        />
        <KPICard
          title="Avg Items/Registry"
          value={formatNumber(data.avg_items_per_registry)}
          icon={<Package className="h-5 w-5 text-teal-500" />}
          tooltip="Average number of items added per active registry. Higher means more engaged users."
          {...trend(data.avg_items_per_registry, prevData?.avg_items_per_registry)}
        />
        <KPICard
          title="Completion Rate"
          value={formatPercent(data.completion_rate)}
          icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
          tooltip="Percentage of wanted items that have been purchased (quantity_received / quantity). Measures how well registries convert to actual gifts."
          {...trend(data.completion_rate, prevData?.completion_rate)}
        />
        <KPICard
          title="Extension Adoption"
          value={formatPercent(extensionAdoption)}
          icon={<Puzzle className="h-5 w-5 text-purple-500" />}
          tooltip="Percentage of users with items who added at least one item via the Chrome extension (vs manual entry)."
          {...trend(extensionAdoption, prevData ? (prevData.total_users_with_items > 0 ? (prevData.extension_users / prevData.total_users_with_items) * 100 : 0) : undefined)}
        />
      </div>

      {/* Signups Trend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Daily Signups</h2>
        {signups.isLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
        ) : (
          <TrendChart
            data={(signups.data ?? []).filter(d => {
              const date = new Date(d.day)
              return date >= dateRange.start && date <= dateRange.end
            }).map((d) => ({ day: d.day, signups: d.signups }))}
            lines={[{ key: 'signups', color: '#6366f1', label: 'Signups' }]}
            height={280}
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
