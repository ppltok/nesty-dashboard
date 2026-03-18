import { useGiftInsights } from '@/hooks/useDashboardData'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { Gift, Users, CheckCircle, Clock } from 'lucide-react'

export default function GiftsPage() {
  const { data, isLoading, error } = useGiftInsights()

  if (isLoading) return <PageSkeleton />
  if (error) return <div className="p-6 text-red-600">Failed to load gift insights: {error.message}</div>

  const gifts = data!

  const statusData = [
    { name: 'Confirmed', value: gifts.confirmed },
    { name: 'Pending', value: gifts.pending },
    { name: 'Cancelled', value: gifts.cancelled },
    { name: 'Expired', value: gifts.expired },
  ].filter((d) => d.value > 0)

  const categoryData = (gifts.gift_category_distribution ?? []).map((c) => ({
    name: c.category,
    value: c.gift_count,
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Gifts (Confirmed)"
          value={formatNumber(gifts.confirmed)}
          icon={<Gift className="h-5 w-5 text-pink-500" />}
          tooltip="Total purchase claims that were confirmed by the gift giver via email verification."
        />
        <KPICard
          title="Unique Givers"
          value={formatNumber(gifts.unique_givers)}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          tooltip="Number of distinct gift givers (by email) who confirmed at least one purchase."
        />
        <KPICard
          title="Confirmation Rate"
          value={formatPercent(gifts.confirmation_rate)}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          tooltip="Percentage of purchase claims that were confirmed. Low rates may indicate friction in the confirmation flow."
        />
        <KPICard
          title="Avg Time to Confirm"
          value={`${gifts.avg_hours_to_confirm.toFixed(1)}h`}
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          tooltip="Average hours between a gift giver claiming a purchase and confirming it via email."
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Purchase Status Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Purchase Status</h2>
          {statusData.length > 0 ? (
            <DonutChart data={statusData} height={280} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>

        {/* Gift Category Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Gift Category Distribution</h2>
          {categoryData.length > 0 ? (
            <DonutChart data={categoryData} height={280} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-center">
          <div className="text-sm text-gray-500 mb-1">Surprise Rate</div>
          <div className="text-2xl font-semibold text-gray-900">
            {formatPercent(gifts.surprise_rate)}
          </div>
          <div className="text-xs text-gray-400 mt-1">Gifts marked as surprise</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-center">
          <div className="text-sm text-gray-500 mb-1">Message Rate</div>
          <div className="text-2xl font-semibold text-gray-900">
            {formatPercent(gifts.message_rate)}
          </div>
          <div className="text-xs text-gray-400 mt-1">Gifts with a personal message</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-center">
          <div className="text-sm text-gray-500 mb-1">Avg Gifts per Giver</div>
          <div className="text-2xl font-semibold text-gray-900">
            {gifts.avg_gifts_per_giver.toFixed(1)}
          </div>
          <div className="text-xs text-gray-400 mt-1">Repeat giving behavior</div>
        </div>
      </div>
    </div>
  )
}
