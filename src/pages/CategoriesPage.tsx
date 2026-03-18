import { useState, useMemo } from 'react'
import { useCategories, useCategoryItems } from '@/hooks/useDashboardData'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/formatters'
import { ArrowUpDown, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categoryItems = useCategoryItems(selectedCategory)

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Category Breakdown</h2>
          <button
            onClick={() => downloadCSV(sorted.map(c => ({
              category: categoryLabel(c.category),
              item_count: c.item_count,
              total_value: c.total_value,
              avg_price: c.avg_price,
              purchase_rate: c.purchase_rate,
            })), 'categories')}
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
                <>
                  <tr
                    key={cat.category}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      setSelectedCategory(
                        selectedCategory === cat.category ? null : cat.category
                      )
                    }
                  >
                    <td className="px-6 py-3 font-medium text-gray-900">
                      <span className="inline-flex items-center gap-1.5">
                        {selectedCategory === cat.category ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        {categoryLabel(cat.category)}
                      </span>
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
                  {selectedCategory === cat.category && (
                    <tr key={`${cat.category}-details`}>
                      <td colSpan={6} className="px-6 py-4 bg-gray-50">
                        <div className="text-sm font-medium text-gray-700 mb-3">
                          Top 5 items in {categoryLabel(cat.category)}
                        </div>
                        {categoryItems.isLoading ? (
                          <div className="text-gray-400 text-sm">Loading...</div>
                        ) : (categoryItems.data ?? []).length === 0 ? (
                          <div className="text-gray-400 text-sm">No items found</div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="pb-2 font-medium">Item</th>
                                <th className="pb-2 font-medium text-right">Price</th>
                                <th className="pb-2 font-medium text-right">Store</th>
                                <th className="pb-2 font-medium text-right">Qty Wanted</th>
                                <th className="pb-2 font-medium text-right">Qty Received</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {(categoryItems.data ?? []).map((item, i) => (
                                <tr key={i}>
                                  <td className="py-2 text-gray-900">{item.name}</td>
                                  <td className="py-2 text-right text-gray-700">
                                    {formatCurrency(item.price)}
                                  </td>
                                  <td className="py-2 text-right text-gray-500">
                                    {item.store_name}
                                  </td>
                                  <td className="py-2 text-right text-gray-700">
                                    {item.quantity}
                                  </td>
                                  <td className="py-2 text-right text-gray-700">
                                    {item.quantity_received}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
