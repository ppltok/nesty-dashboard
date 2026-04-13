import { useMemo } from 'react'
import { usePregnancyTimeline } from '@/hooks/useDashboardData'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { formatNumber } from '@/lib/formatters'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import { Calendar, Baby, UserPlus, Gift, Share2, ShoppingBag } from 'lucide-react'

export default function TimelinePage() {
  const { data, isLoading, error } = usePregnancyTimeline()

  // Merge all weekly data into one array for a combined chart
  const combinedWeekly = useMemo(() => {
    if (!data) return []
    const map = new Map<number, { week: number; signups: number; items: number; gifts: number }>()

    // Handle both data shapes: pregnancy_week (old) and weeks_before_due (new)
    for (const w of (data as any).signups_by_week ?? []) {
      const week = (w as any).pregnancy_week ?? (40 - ((w as any).weeks_before_due ?? 0))
      const entry = map.get(week) ?? { week, signups: 0, items: 0, gifts: 0 }
      entry.signups = (w as any).signups ?? 0
      map.set(week, entry)
    }
    for (const w of data.items_by_week ?? []) {
      const week = (w as any).pregnancy_week ?? (40 - ((w as any).weeks_before_due ?? 0))
      const entry = map.get(week) ?? { week, signups: 0, items: 0, gifts: 0 }
      entry.items = (w as any).items_added ?? 0
      map.set(week, entry)
    }
    for (const w of data.gifts_by_week ?? []) {
      const week = (w as any).pregnancy_week ?? (40 - ((w as any).weeks_before_due ?? 0))
      const entry = map.get(week) ?? { week, signups: 0, items: 0, gifts: 0 }
      entry.gifts = (w as any).gifts_received ?? 0
      map.set(week, entry)
    }

    return Array.from(map.values()).sort((a, b) => a.week - b.week)
  }, [data])

  if (isLoading) return <PageSkeleton />
  if (error)
    return <div className="p-6 text-red-600">Failed to load timeline: {error.message}</div>

  const t = data!
  // Handle both nested milestones (old) and flat structure (new)
  const m = (t as any).milestones ?? {
    users_with_due_date: (t as any).users_with_due_date ?? 0,
    avg_signup_week: (t as any).avg_signup_week ?? null,
    avg_first_item_week: (t as any).avg_first_item_week ?? null,
    avg_first_gift_week: (t as any).avg_first_gift_week ?? null,
    recommended_share_week: (t as any).recommended_share_week ?? ((t as any).avg_first_gift_week != null ? Math.round((t as any).avg_first_gift_week) - 2 : null),
  }

  const dueDateDist = (t.due_date_distribution ?? []).map((d) => ({
    name: d.month,
    value: d.user_count,
  }))

  return (
    <div className="space-y-6">
      {/* Milestone KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Users with Due Date"
          value={formatNumber(m.users_with_due_date)}
          icon={<Baby className="h-5 w-5 text-pink-500" />}
          tooltip="Users who set a due date in their profile."
        />
        <KPICard
          title="Avg Signup Week"
          value={m.avg_signup_week != null ? `Week ${Math.round(m.avg_signup_week)}` : 'N/A'}
          icon={<UserPlus className="h-5 w-5 text-blue-500" />}
          tooltip="Average pregnancy week when users sign up to Nesty."
        />
        <KPICard
          title="Avg First Item Week"
          value={m.avg_first_item_week != null ? `Week ${Math.round(m.avg_first_item_week)}` : 'N/A'}
          icon={<ShoppingBag className="h-5 w-5 text-indigo-500" />}
          tooltip="Average pregnancy week when users add their first registry item."
        />
        <KPICard
          title="Avg First Gift Week"
          value={m.avg_first_gift_week != null ? `Week ${Math.round(m.avg_first_gift_week)}` : 'N/A'}
          icon={<Gift className="h-5 w-5 text-emerald-500" />}
          tooltip="Average pregnancy week when the first gift is received."
        />
        <KPICard
          title="Recommended Share Week"
          value={m.recommended_share_week != null ? `Week ${m.recommended_share_week}` : 'N/A'}
          icon={<Share2 className="h-5 w-5 text-amber-500" />}
          tooltip="Recommended week to share registry — 2 weeks before gifts typically start arriving."
        />
      </div>

      {/* Main Combined Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-1">User Journey by Pregnancy Week</h2>
        <p className="text-sm text-gray-500 mb-4">When do users sign up, add items, and receive gifts relative to their due date?</p>
        {combinedWeekly.length > 0 ? (
          <div className="relative">
            {/* Y-axis label */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateX(4px)' }}
            >
              <span className="text-xs font-semibold text-gray-500 tracking-wide">Count</span>
            </div>
            <div className="ml-5">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={combinedWeekly} margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={true} vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}`}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      fontSize: 13,
                    }}
                    labelFormatter={(v) => `Week ${v}`}
                    formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />

                  {/* Milestone reference lines */}
                  {m.avg_signup_week != null && (
                    <ReferenceLine
                      x={Math.round(m.avg_signup_week)}
                      stroke="#3b82f6"
                      strokeDasharray="4 4"
                      label={{ value: 'Avg Signup', position: 'top', fontSize: 10, fill: '#3b82f6' }}
                    />
                  )}
                  {m.avg_first_item_week != null && (
                    <ReferenceLine
                      x={Math.round(m.avg_first_item_week)}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      label={{ value: 'Avg 1st Item', position: 'top', fontSize: 10, fill: '#6366f1' }}
                    />
                  )}
                  {m.avg_first_gift_week != null && (
                    <ReferenceLine
                      x={Math.round(m.avg_first_gift_week)}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{ value: 'Avg 1st Gift', position: 'top', fontSize: 10, fill: '#10b981' }}
                    />
                  )}
                  <ReferenceLine
                    x={40}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{ value: 'Due Date', position: 'top', fontSize: 10, fill: '#ef4444' }}
                  />

                  <Bar dataKey="signups" name="Signups" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="items" name="Items Added" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gifts" name="Gifts Received" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {/* X-axis label */}
              <div className="text-center -mt-1 mb-1">
                <span className="text-xs font-semibold text-gray-500 tracking-wide">Pregnancy Week</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">
            No data — users need a due date set to appear here
          </div>
        )}
      </div>

      {/* Due Date Distribution */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-1">Due Date Distribution</h2>
        <p className="text-sm text-gray-500 mb-4">When are your users due? Helps plan seasonal campaigns.</p>
        {dueDateDist.length > 0 ? (
          <div className="relative">
            {/* Y-axis label */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateX(4px)' }}
            >
              <span className="text-xs font-semibold text-gray-500 tracking-wide">Users</span>
            </div>
            <div className="ml-5">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dueDateDist} margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      fontSize: 13,
                    }}
                    formatter={(value: number) => [value.toLocaleString(), 'Users']}
                  />
                  <Bar dataKey="value" name="Users" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {/* X-axis label */}
              <div className="text-center -mt-1 mb-1">
                <span className="text-xs font-semibold text-gray-500 tracking-wide">Month</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
        )}
      </div>
    </div>
  )
}
