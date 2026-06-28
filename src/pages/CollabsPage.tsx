import { useState } from 'react'
import { useCollabMetrics, useCollabUsers } from '@/hooks/useDashboardData'
import { useDateRange } from '@/contexts/DateRangeContext'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { downloadCSV } from '@/lib/csv'
import type { CollabSummary, CollabDaily, CollabUserRow } from '@/types/dashboard'
import {
  Send, MousePointerClick, Eye, Copy, ExternalLink, Users, Handshake,
  ChevronDown, ChevronRight, Download,
} from 'lucide-react'

const COLLAB_LABELS: Record<string, string> = {
  supherb: 'Supherb',
}

function rate(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0
}

function Num({ v }: { v: number }) {
  return v > 0
    ? <span className="text-gray-900 font-medium">{formatNumber(v)}</span>
    : <span className="text-gray-300">—</span>
}

function UserTable({ users, collab }: { users: CollabUserRow[]; collab: string }) {
  if (users.length === 0) {
    return <div className="text-sm text-gray-400 py-8 text-center">No user activity in this period yet.</div>
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700">Per-user activity <span className="text-gray-400 font-normal">({users.length})</span></h4>
        <button
          onClick={() =>
            downloadCSV(
              users.map((u) => ({
                Email: u.email,
                Name: u.first_name ?? '',
                Emailed: u.emailed,
                'Email Clicks': u.email_clicks,
                'In-app Views': u.views,
                'Code Copies': u.copies,
                'Redeem Clicks': u.redeem_clicks,
                'Last Activity': new Date(u.last_at).toLocaleString(),
              })),
              `collab-${collab}-users`,
            )
          }
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-md border border-gray-200 transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>
      <div className="overflow-x-auto border border-gray-100 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-3 py-2.5 font-medium text-center" title="Gift email sent">Emailed</th>
              <th className="px-3 py-2.5 font-medium text-center" title="Clicked the email CTA">Email Click</th>
              <th className="px-3 py-2.5 font-medium text-center" title="Saw the in-app popup / card">Viewed</th>
              <th className="px-3 py-2.5 font-medium text-center" title="Copied the NESTY15 code">Copied</th>
              <th className="px-3 py-2.5 font-medium text-center" title="Clicked a redeem CTA (any surface)">Redeem</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.email} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <div className="text-gray-900 max-w-[220px] truncate" title={u.email}>{u.email}</div>
                  {u.first_name && <div className="text-xs text-gray-400">{u.first_name}</div>}
                </td>
                <td className="px-3 py-2.5 text-center"><Num v={u.emailed} /></td>
                <td className="px-3 py-2.5 text-center"><Num v={u.email_clicks} /></td>
                <td className="px-3 py-2.5 text-center"><Num v={u.views} /></td>
                <td className="px-3 py-2.5 text-center"><Num v={u.copies} /></td>
                <td className="px-3 py-2.5 text-center">
                  {u.redeem_clicks > 0
                    ? <span className="text-emerald-700 font-semibold">{formatNumber(u.redeem_clicks)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                  {new Date(u.last_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                  <span className="text-gray-400">{new Date(u.last_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CollabBody({ summary, daily, users }: { summary: CollabSummary; daily: CollabDaily[]; users: CollabUserRow[] }) {
  const funnel = [
    { name: 'Email Sent', value: summary.emails_sent },
    { name: 'Email Click', value: summary.email_clicks },
    { name: 'Gift Viewed', value: summary.total_views },
    { name: 'Code Copied', value: summary.total_copies },
    { name: 'Redeem Click', value: summary.total_redeem_clicks },
  ].filter((d) => d.value > 0)

  const trend = daily
    .filter((d) => d.collab === summary.collab)
    .map((d) => ({
      day: d.day,
      'Email Click': d.email_clicks,
      Views: d.views,
      Copies: d.copies,
      'Redeem Click': d.redeem_clicks,
    }))

  return (
    <div className="space-y-6 p-5 sm:p-6 border-t border-gray-100">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Emails Sent" value={formatNumber(summary.emails_sent)} icon={<Send className="h-5 w-5 text-blue-500" />} />
        <KPICard
          title="Email Click Rate"
          value={formatPercent(rate(summary.email_clicks, summary.emails_sent))}
          subtitle={`${formatNumber(summary.email_clicks)} clicks`}
          icon={<MousePointerClick className="h-5 w-5 text-purple-500" />}
        />
        <KPICard
          title="Gift Views"
          value={formatNumber(summary.total_views)}
          subtitle={`popup ${formatNumber(summary.popup_views)} · card ${formatNumber(summary.card_views)}`}
          icon={<Eye className="h-5 w-5 text-emerald-500" />}
        />
        <KPICard title="Code Copies" value={formatNumber(summary.total_copies)} icon={<Copy className="h-5 w-5 text-amber-500" />} />
        <KPICard title="Redeem Clicks" value={formatNumber(summary.total_redeem_clicks)} icon={<ExternalLink className="h-5 w-5 text-indigo-500" />} />
        <KPICard title="Unique Users" value={formatNumber(summary.unique_users)} icon={<Users className="h-5 w-5 text-slate-500" />} />
        <KPICard
          title="View → Redeem"
          value={formatPercent(rate(summary.total_redeem_clicks, summary.total_views + summary.emails_sent))}
          icon={<MousePointerClick className="h-5 w-5 text-green-600" />}
        />
      </div>

      {/* Funnel + daily */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Conversion Funnel</h4>
          {funnel.length > 0 ? (
            <BarChartComponent data={funnel} bars={[{ key: 'value', color: '#8b5cf6', label: 'Count' }]} height={280} layout="vertical" />
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400">No interactions yet</div>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Daily Activity</h4>
          {trend.length > 0 ? (
            <BarChartComponent
              data={trend}
              xKey="day"
              bars={[
                { key: 'Email Click', color: '#3b82f6', label: 'Email Click', stackId: 'a' },
                { key: 'Views', color: '#10b981', label: 'Views', stackId: 'a' },
                { key: 'Copies', color: '#f59e0b', label: 'Copies', stackId: 'a' },
                { key: 'Redeem Click', color: '#6366f1', label: 'Redeem Click', stackId: 'a' },
              ]}
              height={280}
              xTickAngle={-45}
              xTickFormatter={(val: string) => new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            />
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400">No activity yet</div>
          )}
        </div>
      </div>

      {/* Per-user table */}
      <UserTable users={users} collab={summary.collab} />
    </div>
  )
}

function CollabCard({ summary, daily, users, open, onToggle }: {
  summary: CollabSummary; daily: CollabDaily[]; users: CollabUserRow[]; open: boolean; onToggle: () => void
}) {
  const label = COLLAB_LABELS[summary.collab] ?? summary.collab
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
        {open ? <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" /> : <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />}
        <Handshake className="h-5 w-5 text-purple-500 shrink-0" />
        <span className="font-semibold text-gray-900">{label} <span className="text-gray-400 font-normal">× Nesty</span></span>
        {/* inline summary chips */}
        <div className="ml-auto hidden sm:flex items-center gap-2 text-xs">
          <span className="bg-blue-50 text-blue-700 rounded-full px-2.5 py-1">{formatNumber(summary.emails_sent)} sent</span>
          <span className="bg-purple-50 text-purple-700 rounded-full px-2.5 py-1">{formatNumber(summary.email_clicks)} email clicks</span>
          <span className="bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1">{formatNumber(summary.total_redeem_clicks)} redeem</span>
          <span className="bg-slate-100 text-slate-700 rounded-full px-2.5 py-1">{formatNumber(summary.unique_users)} users</span>
        </div>
      </button>
      {open && <CollabBody summary={summary} daily={daily} users={users} />}
    </div>
  )
}

export default function CollabsPage() {
  const { dateRange } = useDateRange()
  const metrics = useCollabMetrics(dateRange.start, dateRange.end)
  const usersQ = useCollabUsers(dateRange.start, dateRange.end)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})

  if (metrics.isLoading) return <PageSkeleton />
  if (metrics.error)
    return <div className="p-6 text-red-600">Failed to load collab metrics: {metrics.error.message}</div>

  const data = metrics.data!
  const allUsers = usersQ.data ?? []

  if (data.collabs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-10 text-center">
        <Handshake className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No collab activity yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Each partner perk (Supherb and future collabs) gets its own card here once its campaign is live.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        One collapsible card per partner collab. Each shows the funnel, daily activity, and a per-user breakdown of who was emailed and what they did.
      </p>
      {data.collabs.map((c, i) => {
        const open = openMap[c.collab] ?? i === 0 // first collab expanded by default
        return (
          <CollabCard
            key={c.collab}
            summary={c}
            daily={data.daily}
            users={allUsers.filter((u) => u.collab === c.collab)}
            open={open}
            onToggle={() => setOpenMap((m) => ({ ...m, [c.collab]: !open }))}
          />
        )
      })}
    </div>
  )
}
