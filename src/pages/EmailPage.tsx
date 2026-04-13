import { useState, useMemo } from 'react'
import { useEmailMetrics, useEmailLogs } from '@/hooks/useDashboardData'
import { useDateRange } from '@/contexts/DateRangeContext'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { DonutChart } from '@/components/charts/DonutChart'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { downloadCSV } from '@/lib/csv'
import {
  Mail, Send, Eye, MousePointerClick, AlertTriangle, Users,
  Bell, Megaphone, Download, ChevronDown, ChevronUp,
  ArrowUpDown,
} from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  confirmation: 'Gift Confirmation',
  welcome: 'Welcome',
  weekly_update: 'Weekly Pregnancy Update',
  postpartum_weekly: 'Postpartum Weekly',
  week40_celebration: 'Week 40 Celebration',
  nudge_checklist: 'Checklist Nudge',
  nudge_share: 'Share Registry Nudge',
  purchase_notification: 'Gift Notification',
  thank_you: 'Thank You to Giver',
  admin_new_user: 'Admin: New User',
  contact: 'Contact Form',
  marketing: 'Marketing',
  price_alert: 'Price Alert',
}

const TYPE_COLORS: Record<string, string> = {
  confirmation: '#8b5cf6',
  welcome: '#3b82f6',
  weekly_update: '#10b981',
  postpartum_weekly: '#06b6d4',
  week40_celebration: '#f59e0b',
  nudge_checklist: '#f97316',
  nudge_share: '#ec4899',
  purchase_notification: '#6366f1',
  thank_you: '#14b8a6',
  admin_new_user: '#64748b',
  contact: '#a855f7',
  marketing: '#ef4444',
}

const TYPE_COLOR_FALLBACK = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  queued: { bg: 'bg-gray-100', text: 'text-gray-600' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700' },
  delivered: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  opened: { bg: 'bg-green-100', text: 'text-green-700' },
  clicked: { bg: 'bg-purple-100', text: 'text-purple-700' },
  bounced: { bg: 'bg-red-100', text: 'text-red-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' },
  unsubscribed: { bg: 'bg-amber-100', text: 'text-amber-700' },
}

type SortField = 'sent_at' | 'recipient_email' | 'email_type' | 'status'

export default function EmailPage() {
  const { dateRange } = useDateRange()
  const metrics = useEmailMetrics(dateRange.start, dateRange.end)
  const logs = useEmailLogs(dateRange.start, dateRange.end)

  const [sortField, setSortField] = useState<SortField>('sent_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const sortedLogs = useMemo(() => {
    const rows = logs.data ?? []
    let filtered = rows
    if (filterType !== 'all') filtered = filtered.filter(r => r.email_type === filterType)
    if (filterStatus !== 'all') filtered = filtered.filter(r => r.status === filterStatus)

    return [...filtered].sort((a, b) => {
      const va = a[sortField] ?? ''
      const vb = b[sortField] ?? ''
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortAsc ? cmp : -cmp
    })
  }, [logs.data, sortField, sortAsc, filterType, filterStatus])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  // Build daily volume by email type from raw logs (must be before early returns)
  const dailyByType = useMemo(() => {
    const rows = logs.data ?? []
    const dayMap: Record<string, Record<string, number>> = {}
    const allTypes = new Set<string>()

    for (const row of rows) {
      const day = row.sent_at.slice(0, 10) // YYYY-MM-DD
      allTypes.add(row.email_type)
      if (!dayMap[day]) dayMap[day] = {}
      dayMap[day][row.email_type] = (dayMap[day][row.email_type] || 0) + 1
    }

    const days = Object.keys(dayMap).sort()
    return {
      data: days.map(day => ({ day, ...dayMap[day] })),
      types: [...allTypes].sort(),
    }
  }, [logs.data])

  // Delivery funnel from real log data (must be before early returns — hooks can't be conditional)
  const funnelFromLogs = useMemo(() => {
    const rows = logs.data ?? []
    const total = rows.length
    const delivered = rows.filter(r => ['delivered', 'opened', 'clicked'].includes(r.status)).length
    const opened = rows.filter(r => ['opened', 'clicked'].includes(r.status)).length
    const clicked = rows.filter(r => r.status === 'clicked').length
    return [
      { name: 'Sent', value: total },
      { name: 'Delivered', value: delivered },
      { name: 'Opened', value: opened },
      { name: 'Clicked', value: clicked },
    ].filter(d => d.value > 0)
  }, [logs.data])

  const SortIcon = ({ field }: { field: SortField }) => (
    sortField === field
      ? (sortAsc ? <ChevronUp className="inline h-3 w-3 ml-1" /> : <ChevronDown className="inline h-3 w-3 ml-1" />)
      : <ArrowUpDown className="inline h-3 w-3 ml-1 text-gray-300" />
  )

  if (metrics.isLoading) return <PageSkeleton />
  if (metrics.error)
    return <div className="p-6 text-red-600">Failed to load email metrics: {metrics.error.message}</div>

  const e = metrics.data!

  const typeData = (e.by_type ?? []).map((t) => ({
    name: TYPE_LABELS[t.type] ?? t.type,
    value: t.count,
  }))

  const nudges = e.nudge_stats ?? []

  // Unique email types and statuses for filters
  const allTypes = [...new Set((logs.data ?? []).map(r => r.email_type))].sort()
  const allStatuses = [...new Set((logs.data ?? []).map(r => r.status))].sort()

  return (
    <div className="space-y-6">
      {/* Row 1: Volume KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Emails Sent"
          value={formatNumber(e.total_sent)}
          icon={<Send className="h-5 w-5 text-blue-500" />}
          tooltip="Total outbound emails sent in the selected period, including confirmations, nudges, and marketing."
        />
        <KPICard
          title="Unique Recipients"
          value={formatNumber(e.unique_recipients)}
          icon={<Users className="h-5 w-5 text-indigo-500" />}
          tooltip="Number of distinct email addresses that received at least one email in this period."
        />
        <KPICard
          title="Open Rate"
          value={formatPercent(e.open_rate)}
          icon={<Eye className="h-5 w-5 text-green-500" />}
          tooltip="Percentage of delivered emails that were opened by recipients."
        />
        <KPICard
          title="Click Rate"
          value={formatPercent(e.click_rate)}
          icon={<MousePointerClick className="h-5 w-5 text-purple-500" />}
          tooltip="Percentage of opened emails where recipients clicked a link (e.g., confirm purchase, view registry)."
        />
      </div>

      {/* Row 2: Delivery & Opt-in */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Delivered"
          value={formatNumber(e.delivered)}
          icon={<Mail className="h-5 w-5 text-emerald-500" />}
          tooltip="Emails successfully delivered to the recipient's inbox."
        />
        <KPICard
          title="Bounce Rate"
          value={formatPercent(e.bounce_rate)}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          tooltip="Percentage of emails that bounced (invalid address, full mailbox, etc.)."
        />
        <KPICard
          title="Notification Opt-in"
          value={formatPercent(e.notification_opt_in)}
          icon={<Bell className="h-5 w-5 text-amber-500" />}
          tooltip="Percentage of all users who have email notifications enabled in their profile settings."
        />
        <KPICard
          title="Marketing Opt-in"
          value={formatPercent(e.marketing_opt_in)}
          icon={<Megaphone className="h-5 w-5 text-pink-500" />}
          tooltip="Percentage of all users who have opted in to receive marketing emails."
        />
      </div>

      {/* Daily Email Volume by Type — Stacked Bar Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Daily Email Volume by Type</h2>
        {dailyByType.data.length > 0 ? (
          <BarChartComponent
            data={dailyByType.data}
            xKey="day"
            bars={dailyByType.types.map((t, i) => ({
              key: t,
              color: TYPE_COLORS[t] ?? TYPE_COLOR_FALLBACK[i % TYPE_COLOR_FALLBACK.length],
              label: TYPE_LABELS[t] ?? t,
              stackId: 'emails',
            }))}
            height={340}
            xTickAngle={-45}
            xTickFormatter={(val: string) => {
              const d = new Date(val)
              return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
            }}
            xAxisLabel="Date"
            yAxisLabel="Emails"
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">
            No email data yet. Emails will appear here as they are sent.
          </div>
        )}
      </div>

      {/* Delivery Funnel + Email Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Funnel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Delivery Funnel</h2>
          {funnelFromLogs.length > 0 ? (
            <BarChartComponent
              data={funnelFromLogs}
              bars={[{ key: 'value', color: '#3b82f6', label: 'Emails' }]}
              height={280}
              layout="vertical"
              xAxisLabel="Status"
              yAxisLabel="Count"
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No data yet
            </div>
          )}
        </div>

        {/* Type Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Email Type Distribution</h2>
          {typeData.length > 0 ? (
            <DonutChart data={typeData} height={280} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Nudge Effectiveness */}
      {nudges.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Nudge Effectiveness</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Nudge Type</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Sent</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Acted</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Response Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nudges.map((n) => (
                  <tr key={n.type} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {TYPE_LABELS[n.type] ?? n.type}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatNumber(n.sent)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatNumber(n.acted)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={n.sent > 0 && n.acted / n.sent > 0.1 ? 'text-green-600 font-medium' : 'text-gray-700'}>
                        {n.sent > 0 ? formatPercent((n.acted / n.sent) * 100) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Email Log Table - Real data */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Email Log</h2>
          <div className="flex items-center gap-3">
            {/* Type filter */}
            <select
              value={filterType}
              onChange={(ev) => setFilterType(ev.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All types</option>
              {allTypes.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(ev) => setFilterStatus(ev.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All statuses</option>
              {allStatuses.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>

            <button
              onClick={() =>
                downloadCSV(
                  sortedLogs.map(r => ({
                    Date: new Date(r.sent_at).toLocaleString(),
                    Recipient: r.recipient_email,
                    Type: TYPE_LABELS[r.email_type] ?? r.email_type,
                    Subject: r.subject ?? '',
                    Status: r.status,
                    'Opened At': r.opened_at ? new Date(r.opened_at).toLocaleString() : '',
                    'Clicked At': r.clicked_at ? new Date(r.clicked_at).toLocaleString() : '',
                    'Click URL': r.click_url ?? '',
                  })),
                  'email-log'
                )
              }
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-md border border-gray-200 transition-colors"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          </div>
        </div>

        {logs.isLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Loading email logs...</div>
        ) : sortedLogs.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400">
            No emails found for the selected period and filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th
                    className="px-4 py-3 font-medium text-gray-500 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('sent_at')}
                  >
                    Date <SortIcon field="sent_at" />
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-gray-500 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('recipient_email')}
                  >
                    Recipient <SortIcon field="recipient_email" />
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-gray-500 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('email_type')}
                  >
                    Type <SortIcon field="email_type" />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500">Subject</th>
                  <th
                    className="px-4 py-3 font-medium text-gray-500 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('status')}
                  >
                    Status <SortIcon field="status" />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500">Opened</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Clicked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedLogs.map((row) => {
                  const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.sent
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {new Date(row.sent_at).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}{' '}
                        <span className="text-gray-400">
                          {new Date(row.sent_at).toLocaleTimeString('en-GB', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate" title={row.recipient_email}>
                        {row.recipient_email}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {TYPE_LABELS[row.email_type] ?? row.email_type}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={row.subject ?? ''}>
                        {row.subject ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {row.opened_at
                          ? new Date(row.opened_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {row.clicked_at
                          ? new Date(row.clicked_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {sortedLogs.length >= 500 && (
              <p className="text-xs text-gray-400 text-center mt-3">Showing most recent 500 emails. Use filters or export CSV for full data.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
