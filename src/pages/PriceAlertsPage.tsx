import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { DonutChart } from '@/components/charts/DonutChart'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { formatNumber } from '@/lib/formatters'
import { downloadCSV } from '@/lib/csv'
import {
  TrendingDown, Bell, Wallet, ShoppingBag, Download,
  ArrowUpDown, CheckCircle, Clock, AlertTriangle,
} from 'lucide-react'

interface PriceAlert {
  id: string
  item_id: string
  original_price: number
  found_price: number
  found_url: string
  found_store: string
  savings_amount: number
  savings_percent: number
  is_read: boolean
  is_dismissed: boolean
  notified_at: string | null
  created_at: string
}

interface PriceCheckLog {
  id: string
  item_id: string
  status: string
  extracted_price: number | null
  extracted_currency: string | null
  error_message: string | null
  checked_at: string
  item_name?: string
  stored_price?: number
}

function usePriceAlerts() {
  return useQuery<PriceAlert[]>({
    queryKey: ['price-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data || []
    },
  })
}

function usePriceCheckLogs() {
  return useQuery<PriceCheckLog[]>({
    queryKey: ['price-check-logs'],
    queryFn: async () => {
      // Fetch logs with item names via join
      const { data: logs, error } = await supabase
        .from('price_check_logs')
        .select('*, items!inner(name, price)')
        .order('checked_at', { ascending: false })
        .limit(1000)
      if (error) {
        // Fallback without join if items relation fails
        const { data: fallback } = await supabase
          .from('price_check_logs')
          .select('*')
          .order('checked_at', { ascending: false })
          .limit(1000)
        return (fallback || []) as PriceCheckLog[]
      }
      return (logs || []).map((log: any) => ({
        ...log,
        item_name: log.items?.name || undefined,
        stored_price: log.items?.price || log.stored_price || undefined,
      })) as PriceCheckLog[]
    },
  })
}

const STATUS_LABELS: Record<string, string> = {
  no_change: 'No Change',
  price_drop: 'Price Drop',
  price_increase: 'Price Increase',
  fetch_error: 'Fetch Error',
  parse_error: 'Parse Error',
  cooldown_skip: 'Cooldown Skip',
  currency_mismatch: 'Currency Mismatch',
  failure_skip: 'Failure Skip',
}

const STATUS_COLORS: Record<string, string> = {
  no_change: '#10b981',
  price_drop: '#3b82f6',
  price_increase: '#f59e0b',
  fetch_error: '#ef4444',
  parse_error: '#f97316',
  cooldown_skip: '#6b7280',
  currency_mismatch: '#8b5cf6',
}

export default function PriceAlertsPage() {
  const alerts = usePriceAlerts()
  const logs = usePriceCheckLogs()

  const alertData = alerts.data ?? []
  const logData = logs.data ?? []

  // KPIs
  const totalAlerts = alertData.length
  const totalSavings = alertData.reduce((sum, a) => sum + (a.savings_amount || (a.original_price - a.found_price)), 0)
  const avgSavingsPercent = alertData.length > 0
    ? alertData.reduce((sum, a) => sum + (a.savings_percent || ((a.original_price - a.found_price) / a.original_price * 100)), 0) / alertData.length
    : 0
  const notifiedCount = alertData.filter(a => a.notified_at).length
  const totalChecks = logData.length
  const successRate = logData.length > 0
    ? logData.filter(l => !['fetch_error', 'parse_error'].includes(l.status)).length / logData.length
    : 0

  // Log status distribution
  const logsByStatus = useMemo(() => {
    const counts: Record<string, number> = {}
    logData.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({
      name: STATUS_LABELS[name] || name,
      value,
      color: STATUS_COLORS[name],
    }))
  }, [logData])

  // Savings by store
  const savingsByStore = useMemo(() => {
    const stores: Record<string, number> = {}
    alertData.forEach(a => {
      const store = a.found_store || 'Unknown'
      stores[store] = (stores[store] || 0) + (a.savings_amount || (a.original_price - a.found_price))
    })
    return Object.entries(stores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
  }, [alertData])

  if (alerts.isLoading || logs.isLoading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">Price monitoring agent: daily checks, drops detected, savings for users</p>
        </div>
        <button
          onClick={() => downloadCSV(alertData as unknown as Record<string, unknown>[], 'price-alerts')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download size={16} />
          Export
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Price Drops Found"
          value={formatNumber(totalAlerts)}
          icon={<TrendingDown size={20} />}
        />
        <KPICard
          title="Total Savings (ILS)"
          value={`₪${formatNumber(Math.round(totalSavings))}`}
          subtitle="Cumulative savings found for users"
          icon={<Wallet size={20} />}
        />
        <KPICard
          title="Avg Savings"
          value={`${Math.round(avgSavingsPercent)}%`}
          subtitle={`${formatNumber(notifiedCount)} emails sent`}
          icon={<Bell size={20} />}
        />
        <KPICard
          title="Check Success Rate"
          value={`${Math.round(successRate * 100)}%`}
          subtitle={`${formatNumber(totalChecks)} total checks`}
          icon={<CheckCircle size={20} />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Check Results Distribution</h3>
          {logsByStatus.length > 0 ? (
            <DonutChart data={logsByStatus} />
          ) : (
            <p className="text-center text-gray-400 py-8">No price checks yet</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Savings by Store (ILS)</h3>
          {savingsByStore.length > 0 ? (
            <BarChartComponent
              data={savingsByStore}
              bars={[{ key: 'value', color: '#10b981', label: 'Savings (ILS)' }]}
              xAxisLabel="Store"
              yAxisLabel="Savings (ILS)"
            />
          ) : (
            <p className="text-center text-gray-400 py-8">No price drops found yet</p>
          )}
        </div>
      </div>

      {/* Price Alerts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Recent Price Drops</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Store</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Original</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">New Price</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Savings</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Notified</th>
              </tr>
            </thead>
            <tbody>
              {alertData.slice(0, 50).map(alert => {
                const savings = alert.savings_amount || (alert.original_price - alert.found_price)
                const pct = alert.savings_percent || (alert.original_price > 0 ? (savings / alert.original_price * 100) : 0)
                return (
                  <tr key={alert.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(alert.created_at).toLocaleDateString('en-IL')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{alert.found_store}</td>
                    <td className="px-4 py-3 text-gray-500 line-through">₪{alert.original_price}</td>
                    <td className="px-4 py-3 font-bold text-green-600">₪{alert.found_price}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                        -{Math.round(pct)}% (₪{Math.round(savings)})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a href={alert.found_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs truncate block max-w-[180px]">
                        {alert.found_url}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {alert.notified_at ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <Clock size={16} className="text-gray-300" />
                      )}
                    </td>
                  </tr>
                )
              })}
              {alertData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No price drops detected yet — the agent runs daily
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Check Logs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Recent Price Check Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Stored</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Found</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Currency</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Error</th>
              </tr>
            </thead>
            <tbody>
              {logData.slice(0, 50).map(log => (
                <tr key={log.id} className={`border-b last:border-0 hover:bg-gray-50 ${log.status === 'price_drop' ? 'bg-green-50' : ''}`}>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(log.checked_at).toLocaleString('en-IL')}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                    {log.item_name || <span className="text-gray-400 text-xs">{log.item_id?.slice(0, 8)}...</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full`}
                      style={{ backgroundColor: (STATUS_COLORS[log.status] || '#6b7280') + '20', color: STATUS_COLORS[log.status] || '#6b7280' }}>
                      {STATUS_LABELS[log.status] || log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{log.stored_price ? `₪${log.stored_price}` : '-'}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{log.extracted_price ? `${log.extracted_price}` : '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{log.extracted_currency || '-'}</td>
                  <td className="px-4 py-3 text-xs text-red-500 truncate max-w-[200px]">{log.error_message || '-'}</td>
                </tr>
              ))}
              {logData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No price checks run yet — agent runs daily at 10:00 IST
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
