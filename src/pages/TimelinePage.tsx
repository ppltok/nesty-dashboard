import { usePregnancyTimeline } from '@/hooks/useDashboardData'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { formatNumber } from '@/lib/formatters'
import { Calendar, Baby } from 'lucide-react'

export default function TimelinePage() {
  const { data, isLoading, error } = usePregnancyTimeline()

  if (isLoading) return <PageSkeleton />
  if (error)
    return <div className="p-6 text-red-600">Failed to load timeline: {error.message}</div>

  const timeline = data!

  // Filter to sane range (0-42 weeks) — SQL should do this but some edge cases leak through
  const itemsByWeek = (timeline.items_by_week ?? [])
    .filter((w) => w.weeks_before_due >= 0 && w.weeks_before_due <= 42)
    .sort((a, b) => b.weeks_before_due - a.weeks_before_due)
    .map((w) => ({
      name: `${w.weeks_before_due}w`,
      value: w.items_added,
    }))

  const giftsByWeek = (timeline.gifts_by_week ?? [])
    .filter((w) => w.weeks_before_due >= 0 && w.weeks_before_due <= 42)
    .sort((a, b) => b.weeks_before_due - a.weeks_before_due)
    .map((w) => ({
      name: `${w.weeks_before_due}w`,
      value: w.gifts_received,
    }))

  const dueDateDist = (timeline.due_date_distribution ?? []).map((d) => ({
    name: d.month,
    value: d.user_count,
  }))

  // Clamp avg_first_item_week to sane range
  const avgWeek = timeline.avg_first_item_week != null && timeline.avg_first_item_week >= 0 && timeline.avg_first_item_week <= 42
    ? timeline.avg_first_item_week
    : null

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard
          title="Avg First Item Week"
          value={avgWeek != null ? `${avgWeek.toFixed(0)} weeks before due` : 'N/A'}
          icon={<Calendar className="h-5 w-5 text-indigo-500" />}
          tooltip="Average number of weeks before the due date when parents add their first registry item."
        />
        <KPICard
          title="Users with Due Date"
          value={formatNumber(
            (timeline.due_date_distribution ?? []).reduce((s, d) => s + d.user_count, 0)
          )}
          icon={<Baby className="h-5 w-5 text-pink-500" />}
          tooltip="Number of users who have set a due date in their profile."
        />
      </div>

      {/* Items by Week */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Items Added by Weeks Before Due</h2>
        {itemsByWeek.length > 0 ? (
          <BarChartComponent data={itemsByWeek} height={300} bars={[{ key: 'value', color: '#6366f1', label: 'Items Added' }]} />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Due Date Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Due Date Distribution</h2>
          {dueDateDist.length > 0 ? (
            <BarChartComponent data={dueDateDist} height={280} bars={[{ key: 'value', color: '#f59e0b', label: 'Users' }]} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>

        {/* Gifts by Week */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Gifts by Weeks Before Due</h2>
          {giftsByWeek.length > 0 ? (
            <BarChartComponent data={giftsByWeek} height={280} bars={[{ key: 'value', color: '#ec4899', label: 'Gifts Received' }]} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>
      </div>
    </div>
  )
}
