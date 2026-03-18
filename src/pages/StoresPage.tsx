import { useState, useMemo } from 'react'
import { useStores } from '@/hooks/useDashboardData'
import type { StoreBreakdown } from '@/types/dashboard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/formatters'
import { ArrowUpDown, Download } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'

type SortKey = 'item_count' | 'total_value' | 'avg_price' | 'purchase_rate' | 'registry_count'

export default function StoresPage() {
  const { data, isLoading, error } = useStores()
  const [sortKey, setSortKey] = useState<SortKey>('item_count')
  const [sortAsc, setSortAsc] = useState(false)

  const stores = data ?? []

  // Merge duplicates that share the same store_domain but different display names
  const deduped = useMemo(() => {
    const map = new Map<string, StoreBreakdown>()
    for (const s of stores) {
      const existing = map.get(s.store_domain)
      if (existing) {
        existing.item_count += s.item_count
        existing.registry_count += s.registry_count
        existing.total_value += s.total_value
        existing.total_purchased += s.total_purchased
        existing.total_wanted += s.total_wanted
        existing.avg_price = existing.item_count > 0
          ? existing.total_value / existing.item_count
          : 0
        existing.purchase_rate = existing.total_wanted > 0
          ? Math.round((existing.total_purchased / existing.total_wanted) * 1000) / 10
          : 0
      } else {
        map.set(s.store_domain, { ...s })
      }
    }
    return Array.from(map.values())
  }, [stores])

  const sorted = useMemo(() => {
    return [...deduped].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      return sortAsc ? diff : -diff
    })
  }, [deduped, sortKey, sortAsc])

  const chartsData = useMemo(
    () => [...deduped].filter((s) => s.store_domain !== 'manual').sort((a, b) => b.item_count - a.item_count),
    [deduped]
  )

  const top10 = chartsData.slice(0, 10).map((s) => ({
    name: s.store_display_name,
    value: s.item_count,
  }))

  const marketShare = chartsData.slice(0, 10).map((s) => ({
    name: s.store_display_name,
    value: s.item_count,
  }))

  if (isLoading) return <PageSkeleton />
  if (error) return <div className="p-6 text-red-600">Failed to load stores: {error.message}</div>

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-4 py-3 font-medium text-gray-500 text-right cursor-pointer select-none hover:text-gray-700"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </th>
  )

  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top 10 Stores by Items</h2>
          {top10.length > 0 ? (
            <BarChartComponent data={top10} height={300} bars={[{ key: 'value', color: '#6366f1', label: 'Items' }]} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Market Share (by Item Count)</h2>
          {marketShare.length > 0 ? (
            <DonutChart data={marketShare} height={300} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>
      </div>

      {/* Store Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">All Stores</h2>
          <button
            onClick={() => downloadCSV(sorted.map(s => ({
              store_display_name: s.store_display_name,
              item_count: s.item_count,
              total_value: s.total_value,
              avg_price: s.avg_price,
              purchase_rate: s.purchase_rate,
              registry_count: s.registry_count,
            })), 'stores')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-500 w-12">#</th>
                <th className="px-4 py-3 font-medium text-gray-500">Store</th>
                <SortHeader label="Items" field="item_count" />
                <SortHeader label="Total Value" field="total_value" />
                <SortHeader label="Avg Price" field="avg_price" />
                <SortHeader label="Purchase Rate" field="purchase_rate" />
                <SortHeader label="Registries" field="registry_count" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((store, i) => (
                <tr key={store.store_domain} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{store.store_display_name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatNumber(store.item_count)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(store.total_value)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(store.avg_price)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatPercent(store.purchase_rate)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatNumber(store.registry_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
