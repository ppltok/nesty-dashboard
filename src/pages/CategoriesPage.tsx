import { useState, useMemo } from 'react'
import { useCategories } from '@/hooks/useDashboardData'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/formatters'
import { ArrowUpDown } from 'lucide-react'

type SortKey = 'item_count' | 'total_value' | 'avg_price' | 'purchase_rate'

const CATEGORY_LABELS: Record<string, string> = {
  strollers: 'Strollers',
  car_safety: 'Car Safety',
  furniture: 'Furniture',
  safety: 'Safety',
  feeding: 'Feeding',
  nursing: 'Nursing',
  bath: 'Bath',
  clothing: 'Clothing',
  bedding: 'Bedding',
  toys: 'Toys',
}

function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

export default function CategoriesPage() {
  const { data, isLoading, error } = useCategories()
  const [sortKey, setSortKey] = useState<SortKey>('item_count')
  const [sortAsc, setSortAsc] = useState(false)

  const categories = data ?? []

  const totalItems = useMemo(() => categories.reduce((s, c) => s + c.item_count, 0), [categories])

  const sorted = useMemo(() => {
    return [...categories].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      return sortAsc ? diff : -diff
    })
  }, [categories, sortKey, sortAsc])

  const countData = useMemo(
    () => categories.map((c) => ({ name: categoryLabel(c.category), value: c.item_count })),
    [categories]
  )

  const valueData = useMemo(
    () => categories.map((c) => ({ name: categoryLabel(c.category), value: c.total_value })),
    [categories]
  )

  if (isLoading) return <PageSkeleton />
  if (error) return <div className="p-6 text-red-600">Failed to load categories: {error.message}</div>

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
      className="px-6 py-3 font-medium text-gray-500 text-right cursor-pointer select-none hover:text-gray-700"
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
      {/* Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Distribution by Count</h2>
          {countData.length > 0 ? (
            <DonutChart data={countData} height={300} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Distribution by Value</h2>
          {valueData.length > 0 ? (
            <DonutChart data={valueData} height={300} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>
      </div>

      {/* Category Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Category Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-3 font-medium text-gray-500">Category</th>
                <SortHeader label="Items" field="item_count" />
                <th className="px-6 py-3 font-medium text-gray-500 text-right">% of Total</th>
                <SortHeader label="Total Value" field="total_value" />
                <SortHeader label="Avg Price" field="avg_price" />
                <SortHeader label="Purchase Rate" field="purchase_rate" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((cat) => (
                <tr key={cat.category} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {categoryLabel(cat.category)}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700">
                    {formatNumber(cat.item_count)}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700">
                    {totalItems > 0 ? formatPercent((cat.item_count / totalItems) * 100) : '0%'}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700">
                    {formatCurrency(cat.total_value)}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700">
                    {formatCurrency(cat.avg_price)}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700">
                    {formatPercent(cat.purchase_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
