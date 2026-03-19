import { useEmailMetrics } from '@/hooks/useDashboardData'
import { useDateRange } from '@/contexts/DateRangeContext'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { TrendChart } from '@/components/charts/TrendChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatNumber, formatPercent } from '@/lib/formatters'
import {
  Mail, Send, Eye, MousePointerClick, AlertTriangle, Users,
  Bell, Megaphone,
} from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  confirmation: 'Gift Confirmation',
  nudge_onboarding: 'Onboarding Nudge',
  nudge_first_item: 'First Item Nudge',
  nudge_share_registry: 'Share Nudge',
  nudge_incomplete: 'Incomplete Nudge',
  welcome: 'Welcome Email',
  weekly_digest: 'Weekly Digest',
  gift_notification: 'Gift Notification',
  marketing: 'Marketing',
  price_alert: 'Price Alert',
}

const TYPE_COLORS: Record<string, string> = {
  confirmation: '#3b82f6',
  nudge_onboarding: '#f59e0b',
  nudge_first_item: '#8b5cf6',
  nudge_share_registry: '#ec4899',
  nudge_incomplete: '#f97316',
  welcome: '#10b981',
  weekly_digest: '#06b6d4',
  gift_notification: '#6366f1',
  marketing: '#ef4444',
  price_alert: '#14b8a6',
}

export default function EmailPage() {
  const { dateRange } = useDateRange()
  const metrics = useEmailMetrics(dateRange.start, dateRange.end)

  if (metrics.isLoading) return <PageSkeleton />
  if (metrics.error)
    return <div className="p-6 text-red-600">Failed to load email metrics: {metrics.error.message}</div>

  const e = metrics.data!

  const trendData = (e.daily_sends ?? []).map((d) => ({
    day: d.day,
    sent: d.sent,
    opened: d.opened,
    clicked: d.clicked,
  }))

  const typeData = (e.by_type ?? []).map((t) => ({
    name: TYPE_LABELS[t.type] ?? t.type,
    value: t.count,
  }))

  const nudges = e.nudge_stats ?? []

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

      {/* Daily Email Trend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Daily Email Volume</h2>
        {trendData.length > 0 ? (
          <TrendChart
            data={trendData}
            height={300}
            lines={[
              { key: 'sent', color: '#3b82f6', label: 'Sent' },
              { key: 'opened', color: '#10b981', label: 'Opened' },
              { key: 'clicked', color: '#8b5cf6', label: 'Clicked' },
            ]}
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">
            No email data yet. Emails will appear here as they are sent.
          </div>
        )}
      </div>

      {/* Email Type Breakdown + Nudge Effectiveness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {/* Nudge Effectiveness */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Nudge Effectiveness</h2>
          {nudges.length > 0 ? (
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
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm text-center px-4">
              No nudge emails sent yet. Nudge campaigns will track onboarding reminders,
              first-item prompts, and share reminders.
            </div>
          )}
        </div>
      </div>

      {/* Email Strategy Roadmap */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Email Automation Roadmap</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              type: 'Welcome Email',
              trigger: 'On signup',
              status: 'planned',
              description: 'Welcome new users, guide to first steps',
            },
            {
              type: 'Onboarding Nudge',
              trigger: '24h after signup, no onboarding',
              status: 'planned',
              description: 'Remind users to set due date and create registry',
            },
            {
              type: 'First Item Nudge',
              trigger: '48h after onboarding, no items',
              status: 'planned',
              description: 'Encourage adding first item, highlight extension',
            },
            {
              type: 'Share Registry Nudge',
              trigger: '5+ items, registry not shared',
              status: 'planned',
              description: 'Prompt users to share their registry with family',
            },
            {
              type: 'Weekly Digest',
              trigger: 'Every Monday',
              status: 'planned',
              description: 'Summary of registry views, gifts received, new items',
            },
            {
              type: 'Gift Confirmation',
              trigger: 'On purchase claim',
              status: 'active',
              description: 'Email gift giver to confirm purchase',
            },
          ].map((item) => (
            <div
              key={item.type}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 text-sm">{item.type}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  item.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {item.status === 'active' ? 'Active' : 'Planned'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                <span className="font-medium">Trigger:</span> {item.trigger}
              </p>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
