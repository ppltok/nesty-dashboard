import { useEconomics, useCategories } from '@/hooks/useDashboardData'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/formatters'
import { DollarSign, BarChart3, TrendingUp, Gift, Heart, ShoppingBag } from 'lucide-react'

export default function EconomicsPage() {
  const economics = useEconomics()
  const categories = useCategories()

  if (economics.isLoading) return <PageSkeleton />
  if (economics.error)
    return <div className="p-6 text-red-600">Failed to load economics: {economics.error.message}</div>

  const raw = economics.data!
  const eco = {
    total_gmv: raw.total_gmv ?? 0,
    avg_registry_value: raw.avg_registry_value ?? 0,
    median_registry_value: raw.median_registry_value ?? 0,
    avg_gift_value: raw.avg_gift_value ?? 0,
    avg_items_per_registry: raw.avg_items_per_registry ?? 0,
    avg_gifts_per_registry: raw.avg_gifts_per_registry ?? 0,
    completion_rate: raw.completion_rate ?? 0,
    total_registries_with_items: raw.total_registries_with_items ?? 0,
    total_gifts_given: raw.total_gifts_given ?? 0,
    unique_gift_givers: raw.unique_gift_givers ?? 0,
    value_distribution: raw.value_distribution ?? [],
  }

  const valueDistribution = eco.value_distribution.map((d) => ({
    name: d.bucket,
    value: d.registry_count,
  }))

  const categoryPurchaseRate = (categories.data ?? []).map((c) => ({
    name: c.category,
    value: Number((c.purchase_rate ?? 0).toFixed(1)),
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Total GMV"
          value={formatCurrency(eco.total_gmv)}
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          tooltip="Total Gross Merchandise Value — sum of all item prices across all registries on the platform."
        />
        <KPICard
          title="Avg Registry Value"
          value={formatCurrency(eco.avg_registry_value)}
          icon={<BarChart3 className="h-5 w-5 text-indigo-500" />}
          tooltip="Average total value of items per registry. Only includes registries with at least one item."
        />
        <KPICard
          title="Median Registry Value"
          value={formatCurrency(eco.median_registry_value)}
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          tooltip="The middle value when all registry totals are sorted. Less affected by outliers than average."
        />
        <KPICard
          title="Avg Gift Value"
          value={formatCurrency(eco.avg_gift_value)}
          icon={<Gift className="h-5 w-5 text-pink-500" />}
          tooltip="Average price of items that have been purchased/gifted by gift givers."
        />
        <KPICard
          title="Total Gifts Given"
          value={formatNumber(eco.total_gifts_given)}
          icon={<Heart className="h-5 w-5 text-red-500" />}
          tooltip="Total number of confirmed gift purchases across the entire platform."
        />
        <KPICard
          title="Avg Gifts/Registry"
          value={formatNumber(eco.avg_gifts_per_registry)}
          icon={<ShoppingBag className="h-5 w-5 text-teal-500" />}
          tooltip="Average number of gifts received per registry that has at least one gift."
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registry Value Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Registry Value Distribution</h2>
          {valueDistribution.length > 0 ? (
            <BarChartComponent data={valueDistribution} height={300} bars={[{ key: 'value', color: '#6366f1', label: 'Registries' }]} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>

        {/* Completion Rate by Category */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Purchase Rate by Category</h2>
          {categories.isLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
          ) : categoryPurchaseRate.length > 0 ? (
            <BarChartComponent data={categoryPurchaseRate} height={300} bars={[{ key: 'value', color: '#10b981', label: 'Purchase Rate %' }]} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>
      </div>

      {/* Affiliate Pitch Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Affiliate Pitch</h2>
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-5 text-gray-700 leading-relaxed">
          <p>
            Nesty's platform processes a total GMV of{' '}
            <strong>{formatCurrency(eco.total_gmv)}</strong> across{' '}
            <strong>{formatNumber(eco.total_registries_with_items)}</strong> active registries. The
            average registry is valued at{' '}
            <strong>{formatCurrency(eco.avg_registry_value)}</strong>, with a median of{' '}
            <strong>{formatCurrency(eco.median_registry_value)}</strong>. Each registry receives an
            average of <strong>{formatNumber(eco.avg_gifts_per_registry)}</strong> gifts with an
            average gift value of <strong>{formatCurrency(eco.avg_gift_value)}</strong>. The overall
            completion rate stands at <strong>{formatPercent(eco.completion_rate)}</strong>, with{' '}
            <strong>{formatNumber(eco.unique_gift_givers)}</strong> unique gift givers driving{' '}
            <strong>{formatNumber(eco.total_gifts_given)}</strong> total gifts.
          </p>
        </div>
      </div>
    </div>
  )
}
