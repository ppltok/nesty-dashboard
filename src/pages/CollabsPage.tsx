import { useCollabMetrics } from '@/hooks/useDashboardData'
import { useDateRange } from '@/contexts/DateRangeContext'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { formatNumber, formatPercent } from '@/lib/formatters'
import type { CollabSummary, CollabDaily } from '@/types/dashboard'
import { Send, MousePointerClick, Eye, Gift, Copy, ExternalLink, Users, Handshake } from 'lucide-react'

const COLLAB_LABELS: Record<string, string> = {
  supherb: 'Supherb',
}

function rate(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0
}

function CollabSection({ summary, daily }: { summary: CollabSummary; daily: CollabDaily[] }) {
  const label = COLLAB_LABELS[summary.collab] ?? summary.collab

  // Funnel: email sent → email click → gift viewed → revealed → code copied → redeem click
  const funnel = [
    { name: 'Email Sent', value: summary.emails_sent },
    { name: 'Email Click', value: summary.email_clicks },
    { name: 'Gift Viewed', value: summary.total_views },
    { name: 'Revealed', value: summary.total_reveals },
    { name: 'Code Copied', value: summary.total_copies },
    { name: 'Redeem Click', value: summary.total_redeem_clicks },
  ].filter((d) => d.value > 0)

  const surfaceData = [
    { name: 'Popup', views: summary.popup_views, copies: summary.popup_copies, redeem: summary.popup_cta_clicks },
    { name: 'Gifts Card', views: summary.card_views, copies: summary.card_copies, redeem: summary.card_cta_clicks },
    { name: 'Email', views: summary.emails_sent, copies: 0, redeem: summary.email_clicks },
  ]

  const trend = (daily ?? [])
    .filter((d) => d.collab === summary.collab)
    .map((d) => ({
      day: d.day,
      'Email Click': d.email_clicks,
      Views: d.views,
      Copies: d.copies,
      'Redeem Click': d.redeem_clicks,
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-purple-500" />
        <h2 className="text-xl font-semibold text-gray-900">{label} × Nesty</h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Emails Sent"
          value={formatNumber(summary.emails_sent)}
          icon={<Send className="h-5 w-5 text-blue-500" />}
          tooltip="Gift emails handed to Resend for this campaign in the selected period."
        />
        <KPICard
          title="Email Click Rate"
          value={formatPercent(rate(summary.email_clicks, summary.emails_sent))}
          subtitle={`${formatNumber(summary.email_clicks)} clicks`}
          icon={<MousePointerClick className="h-5 w-5 text-purple-500" />}
          tooltip="Share of sent emails whose CTA was clicked (tracked via the collab-redirect link)."
        />
        <KPICard
          title="Gift Views"
          value={formatNumber(summary.total_views)}
          subtitle={`popup ${formatNumber(summary.popup_views)} · card ${formatNumber(summary.card_views)}`}
          icon={<Eye className="h-5 w-5 text-emerald-500" />}
          tooltip="In-app views of the gift popup and gifts-page card."
        />
        <KPICard
          title="Gift Reveals"
          value={formatNumber(summary.total_reveals)}
          subtitle={`${formatPercent(rate(summary.total_reveals, summary.total_views))} of views`}
          icon={<Gift className="h-5 w-5 text-pink-500" />}
          tooltip="Taps on the 'reveal gift' button — the strongest in-app intent signal."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Code Copies"
          value={formatNumber(summary.total_copies)}
          icon={<Copy className="h-5 w-5 text-amber-500" />}
          tooltip="Times the NESTY15 coupon code was copied from the popup or gifts card."
        />
        <KPICard
          title="Redeem Clicks"
          value={formatNumber(summary.total_redeem_clicks)}
          icon={<ExternalLink className="h-5 w-5 text-indigo-500" />}
          tooltip="Clicks on a redeem CTA across all surfaces (popup + card + email) — visits to the partner link."
        />
        <KPICard
          title="Unique Users"
          value={formatNumber(summary.unique_users)}
          icon={<Users className="h-5 w-5 text-slate-500" />}
          tooltip="Distinct users with at least one tracked interaction with this campaign."
        />
        <KPICard
          title="View → Redeem"
          value={formatPercent(rate(summary.total_redeem_clicks, summary.total_views + summary.emails_sent))}
          icon={<MousePointerClick className="h-5 w-5 text-green-600" />}
          tooltip="Redeem clicks as a share of all gift impressions (in-app views + emails sent)."
        />
      </div>

      {/* Funnel + Surfaces */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Conversion Funnel</h3>
          {funnel.length > 0 ? (
            <BarChartComponent
              data={funnel}
              bars={[{ key: 'value', color: '#8b5cf6', label: 'Count' }]}
              height={300}
              layout="vertical"
              xAxisLabel="Stage"
              yAxisLabel="Count"
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No interactions yet</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">By Surface</h3>
          <BarChartComponent
            data={surfaceData}
            xKey="name"
            bars={[
              { key: 'views', color: '#10b981', label: 'Views / Sent' },
              { key: 'copies', color: '#f59e0b', label: 'Code Copies' },
              { key: 'redeem', color: '#6366f1', label: 'Redeem Clicks' },
            ]}
            height={300}
            xAxisLabel="Surface"
            yAxisLabel="Count"
          />
        </div>
      </div>

      {/* Daily trend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Activity</h3>
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
            height={320}
            xTickAngle={-45}
            xTickFormatter={(val: string) => {
              const d = new Date(val)
              return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
            }}
            xAxisLabel="Date"
            yAxisLabel="Events"
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">No activity in this period yet</div>
        )}
      </div>
    </div>
  )
}

export default function CollabsPage() {
  const { dateRange } = useDateRange()
  const metrics = useCollabMetrics(dateRange.start, dateRange.end)

  if (metrics.isLoading) return <PageSkeleton />
  if (metrics.error)
    return <div className="p-6 text-red-600">Failed to load collab metrics: {metrics.error.message}</div>

  const data = metrics.data!

  if (data.collabs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-10 text-center">
        <Handshake className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No collab activity yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Partner-perk interactions (Supherb gift popup, gifts card, and email clicks) will appear here once the campaign goes out.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {data.collabs.map((c) => (
        <CollabSection key={c.collab} summary={c} daily={data.daily} />
      ))}
    </div>
  )
}
