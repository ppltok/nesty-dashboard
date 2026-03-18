import { useExtensionMetrics, useDailyItems } from '@/hooks/useDashboardData'
import { useDateRange } from '@/contexts/DateRangeContext'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { TrendChart } from '@/components/charts/TrendChart'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { Puzzle, TrendingUp, Package, GitCompare } from 'lucide-react'

export default function ExtensionPage() {
  const { dateRange } = useDateRange()
  const metrics = useExtensionMetrics()
  const dailyItems = useDailyItems()

  if (metrics.isLoading) return <PageSkeleton />
  if (metrics.error)
    return <div className="p-6 text-red-600">Failed to load extension metrics: {metrics.error.message}</div>

  const ext = metrics.data!

  const totalItems = ext.items_via_extension + ext.items_manual
  const adoptionRate =
    ext.extension_users + ext.non_extension_users > 0
      ? (ext.extension_users / (ext.extension_users + ext.non_extension_users)) * 100
      : 0
  const ratio =
    ext.items_manual > 0 ? `${(ext.items_via_extension / ext.items_manual).toFixed(1)}:1` : 'N/A'

  const itemsData = (dailyItems.data ?? []).filter(d => {
    const date = new Date(d.day)
    return date >= dateRange.start && date <= dateRange.end
  }).map((d) => ({
    day: d.day,
    extension: d.via_extension,
    manual: d.via_manual,
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Extension Users"
          value={formatNumber(ext.extension_users)}
          icon={<Puzzle className="h-5 w-5 text-purple-500" />}
          tooltip="Users who added at least one item via the Nesty Chrome extension."
        />
        <KPICard
          title="Adoption Rate"
          value={formatPercent(adoptionRate)}
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          tooltip="Percentage of users with items who used the Chrome extension at least once."
        />
        <KPICard
          title="Items via Extension"
          value={formatNumber(ext.items_via_extension)}
          icon={<Package className="h-5 w-5 text-indigo-500" />}
          tooltip="Total items added through the Chrome extension (vs manual entry)."
        />
        <KPICard
          title="Extension vs Manual"
          value={ratio}
          icon={<GitCompare className="h-5 w-5 text-blue-500" />}
          tooltip="Ratio of extension-added items to manually-added items."
        />
      </div>

      {/* Uplift Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Extension Uplift Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-3 font-medium text-gray-500">Metric</th>
                <th className="px-6 py-3 font-medium text-gray-500 text-right">Extension Users</th>
                <th className="px-6 py-3 font-medium text-gray-500 text-right">Non-Extension Users</th>
                <th className="px-6 py-3 font-medium text-gray-500 text-right">Uplift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                {
                  metric: 'Avg Items',
                  ext: ext.ext_avg_items,
                  nonExt: ext.non_ext_avg_items,
                  format: formatNumber,
                },
                {
                  metric: 'Avg Registry Value',
                  ext: ext.ext_avg_value,
                  nonExt: ext.non_ext_avg_value,
                  format: (n: number) => `₪${n.toLocaleString('en-IL', { maximumFractionDigits: 0 })}`,
                },
                {
                  metric: 'Completion Rate',
                  ext: ext.ext_completion_rate,
                  nonExt: ext.non_ext_completion_rate,
                  format: formatPercent,
                },
              ].map((row) => {
                const uplift =
                  row.nonExt > 0 ? ((row.ext - row.nonExt) / row.nonExt) * 100 : 0
                return (
                  <tr key={row.metric} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{row.metric}</td>
                    <td className="px-6 py-3 text-right text-gray-700">{row.format(row.ext)}</td>
                    <td className="px-6 py-3 text-right text-gray-700">{row.format(row.nonExt)}</td>
                    <td className="px-6 py-3 text-right">
                      <span
                        className={
                          uplift >= 0
                            ? 'text-green-600 font-medium'
                            : 'text-red-600 font-medium'
                        }
                      >
                        {uplift >= 0 ? '+' : ''}
                        {uplift.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Over Time */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Items Added Over Time</h2>
        {dailyItems.isLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
        ) : itemsData.length > 0 ? (
          <TrendChart
            data={itemsData}
            height={300}
            lines={[
              { key: 'extension', color: '#8b5cf6', label: 'Via Extension' },
              { key: 'manual', color: '#d1d5db', label: 'Manual' },
            ]}
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
        )}
      </div>
    </div>
  )
}
