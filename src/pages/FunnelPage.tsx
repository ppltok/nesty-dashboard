import { useFunnel, useUserJourneyTiming, useTierFunnel } from '@/hooks/useDashboardData'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { FunnelChart } from '@/components/charts/FunnelChart'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { KPICard } from '@/components/shared/KPICard'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { Download, Clock, CalendarCheck, Baby, Gift, ClipboardList, ArrowRight, Users, Handshake, Share2, Heart, ShoppingBag, PackageCheck } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'
import type { TierName } from '@/types/dashboard'

// Tier display config. Mirrors Nesty-Obsidian/Product/User-Tiers.md.
const TIER_META: Record<TierName, { label: string; description: string; color: string }> = {
  user:     { label: 'User',       description: 'Signed up, no items',                  color: '#94a3b8' },
  started:  { label: 'Started',    description: '≥1 item',                              color: '#60a5fa' },
  active:   { label: 'Active',     description: '≥2 items (real return signal)',        color: '#34d399' },
  super:    { label: 'Super user', description: '≥5 items (power user)',                color: '#fbbf24' },
  champion: { label: 'Champion',   description: '≥1 received from anyone (outcome)',    color: '#f472b6' },
}

const FLAG_META = {
  has_coparent:    { label: 'Co-parent',       icon: Handshake,    color: 'text-rose-500' },
  sharer:          { label: 'Sharer',          icon: Share2,       color: 'text-blue-500' },
  network_reached: { label: 'Network-reached', icon: Heart,        color: 'text-pink-500' },
  self_fulfiller:  { label: 'Self-fulfiller',  icon: ShoppingBag,  color: 'text-amber-500' },
  gift_received:   { label: 'Gift-received',   icon: PackageCheck, color: 'text-emerald-500' },
} as const
type FlagKey = keyof typeof FLAG_META

const STAGE_LABELS: Record<string, string> = {
  signups: 'Signed Up',
  onboarded: 'Onboarded',
  first_item: 'First Item',
  five_items: '5+ Items',
  shared: 'Shared',
  viewed: 'Viewed',
  gifted: 'Gifted',
}

export default function FunnelPage() {
  const { data, isLoading, error } = useFunnel()
  const journey = useUserJourneyTiming()
  const tierFunnel = useTierFunnel()

  if (isLoading) return <PageSkeleton />
  if (error) return <div className="p-6 text-red-600">Failed to load funnel: {error.message}</div>

  const stages = data ?? []
  const signupCount = stages[0]?.count || 1

  const j = journey.data
  const t = j?.timing

  // Tier funnel + flag matrix data
  const tf = tierFunnel.data
  const totalTierUsers = tf?.total_users ?? 0
  const tierRows = (tf?.tiers ?? []).map((row) => ({
    ...row,
    meta: TIER_META[row.tier],
    pct: totalTierUsers > 0 ? (row.users / totalTierUsers) * 100 : 0,
  }))
  const maxTierUsers = Math.max(1, ...tierRows.map((r) => r.users))

  return (
    <div className="space-y-6">
      {/* === User Tier Funnel (User-Tiers.md) ============================= */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-indigo-500" />
            User Tier Funnel
          </h2>
          <span className="text-xs text-gray-400">{formatNumber(totalTierUsers)} users · tests excluded</span>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          Engagement depth, strictly nested. Each user sits in exactly one tier. See <code className="px-1 bg-gray-100 rounded">User-Tiers.md</code> for definitions.
        </p>

        {tierFunnel.isLoading ? (
          <div className="text-gray-400 py-12 text-center">Loading tiers...</div>
        ) : tierFunnel.error ? (
          <div className="text-red-600 py-4 text-sm">Failed to load tier funnel: {tierFunnel.error.message}</div>
        ) : (
          <div className="space-y-2.5">
            {tierRows.map((row) => (
              <div key={row.tier} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <div className="text-sm font-medium text-gray-900">{row.meta.label}</div>
                  <div className="text-xs text-gray-400">{row.meta.description}</div>
                </div>
                <div className="flex-1">
                  <div className="h-9 bg-gray-50 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pe-3"
                      style={{
                        width: `${(row.users / maxTierUsers) * 100}%`,
                        backgroundColor: row.meta.color,
                        minWidth: row.users > 0 ? '36px' : '0',
                      }}
                    >
                      <span className="text-xs font-semibold text-white drop-shadow">
                        {formatNumber(row.users)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-14 text-right text-xs font-medium text-gray-500">
                  {row.pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === Behavioral Flag Matrix (orthogonal to tier) ================== */}
      {tf && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Flag × Tier Matrix</h2>
          <p className="text-xs text-gray-500 mb-5">
            Five orthogonal behavioral flags. A user can carry any combination — these don't replace the funnel, they cross with it. Cell shows users with that flag in that tier (and % of the tier).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs">
                  <th className="px-3 py-2 font-medium text-gray-500">Tier</th>
                  <th className="px-3 py-2 font-medium text-gray-500 text-right">Users</th>
                  {(Object.keys(FLAG_META) as FlagKey[]).map((key) => {
                    const F = FLAG_META[key]
                    const Icon = F.icon
                    return (
                      <th key={key} className="px-3 py-2 font-medium text-gray-500 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Icon size={12} className={F.color} />
                          {F.label}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tf.flag_by_tier.map((row) => {
                  const meta = TIER_META[row.tier as TierName]
                  return (
                    <tr key={row.tier}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                          <span className="font-medium text-gray-900">{meta.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-700">{formatNumber(row.users)}</td>
                      {(Object.keys(FLAG_META) as FlagKey[]).map((key) => {
                        const count = row[key]
                        const pct = row.users > 0 ? (count / row.users) * 100 : 0
                        return (
                          <td key={key} className="px-3 py-2.5 text-right">
                            <span className={count > 0 ? 'text-gray-900 font-medium' : 'text-gray-300'}>
                              {formatNumber(count)}
                            </span>
                            {count > 0 && (
                              <span className="text-gray-400 text-xs ms-1">({pct.toFixed(0)}%)</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-medium">
                  <td className="px-3 py-2.5 text-gray-700">Total</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{formatNumber(tf.total_users)}</td>
                  {(Object.keys(FLAG_META) as FlagKey[]).map((key) => {
                    const total = tf.flags_overall[key]
                    const pct = tf.total_users > 0 ? (total / tf.total_users) * 100 : 0
                    return (
                      <td key={key} className="px-3 py-2.5 text-right text-gray-700">
                        {formatNumber(total)}
                        {total > 0 && <span className="text-gray-400 text-xs ms-1">({pct.toFixed(1)}%)</span>}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Note: <code className="px-1 bg-gray-50 rounded">sharer</code> is UTM-inferred only until <code className="px-1 bg-gray-50 rounded">share_events</code> table is wired. <code className="px-1 bg-gray-50 rounded">network_reached</code> / <code className="px-1 bg-gray-50 rounded">self_fulfiller</code> / <code className="px-1 bg-gray-50 rounded">gift_received</code> depend on the <code className="px-1 bg-gray-50 rounded">purchases</code> table being populated; expect low numbers today.
          </p>
        </div>
      )}

      {/* === Legacy 7-stage funnel (kept until tier funnel proves out) ==== */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-1">Legacy Funnel (7-stage)</h2>
        <p className="text-xs text-gray-500 mb-4">
          Original event-based funnel from <code className="px-1 bg-gray-100 rounded">mv_funnel_snapshot</code>. Kept for continuity while the tier funnel above proves out.
        </p>
        <FunnelChart
          data={stages.map((s) => ({
            stage: STAGE_LABELS[s.stage] ?? s.stage,
            count: s.count,
          }))}
        />
      </div>

      {/* Conversion Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Conversion Details</h2>
          <button
            onClick={() => downloadCSV(stages.map((s, i) => {
              const prevCount = i > 0 ? stages[i - 1].count : s.count
              const fromPrevious = prevCount > 0 ? ((s.count / prevCount) * 100).toFixed(1) + '%' : '0%'
              const fromSignup = signupCount > 0 ? ((s.count / signupCount) * 100).toFixed(1) + '%' : '0%'
              return {
                stage: STAGE_LABELS[s.stage] ?? s.stage,
                count: s.count,
                conversion_from_previous: i === 0 ? '-' : fromPrevious,
                conversion_from_signup: fromSignup,
              }
            }), 'funnel')}
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
                <th className="px-6 py-3 font-medium text-gray-500">Stage</th>
                <th className="px-6 py-3 font-medium text-gray-500 text-right">Count</th>
                <th className="px-6 py-3 font-medium text-gray-500 text-right">From Previous</th>
                <th className="px-6 py-3 font-medium text-gray-500 text-right">From Signup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stages.map((stage, i) => {
                const prevCount = i > 0 ? stages[i - 1].count : stage.count
                const fromPrevious = prevCount > 0 ? (stage.count / prevCount) * 100 : 0
                const fromSignup = signupCount > 0 ? (stage.count / signupCount) * 100 : 0

                return (
                  <tr key={stage.stage} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {STAGE_LABELS[stage.stage] ?? stage.stage}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-700">
                      {formatNumber(stage.count)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-700">
                      {i === 0 ? '-' : formatPercent(fromPrevious)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-700">
                      {formatPercent(fromSignup)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== USER JOURNEY TIMING ===== */}
      {journey.isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="h-32 flex items-center justify-center text-gray-400">Loading journey timing...</div>
        </div>
      ) : j && t ? (
        <>
          {/* Section Header */}
          <div className="pt-2">
            <h2 className="text-xl font-semibold text-gray-900">User Journey Timing</h2>
            <p className="text-sm text-gray-500 mt-1">How long does each step take? Based on {formatNumber(t.total_users)} users (excluding test accounts).</p>
          </div>

          {/* Journey Flow KPIs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Average Time Between Milestones</h3>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Signup */}
              <div className="flex flex-col items-center px-4 py-3 bg-blue-50 rounded-xl min-w-[120px]">
                <CalendarCheck className="h-6 w-6 text-blue-500 mb-1" />
                <span className="text-xs font-medium text-blue-600">Signup</span>
                <span className="text-xs text-blue-400 mt-0.5">{formatNumber(t.total_users)} users</span>
              </div>

              <div className="flex flex-col items-center">
                <ArrowRight className="h-5 w-5 text-gray-300" />
                <span className="text-xs font-bold text-indigo-600 mt-0.5">
                  {t.median_days_signup_to_checklist != null ? `${t.median_days_signup_to_checklist}d` : 'N/A'}
                </span>
                <span className="text-[10px] text-gray-400">median</span>
              </div>

              {/* Checklist */}
              <div className="flex flex-col items-center px-4 py-3 bg-purple-50 rounded-xl min-w-[120px]">
                <ClipboardList className="h-6 w-6 text-purple-500 mb-1" />
                <span className="text-xs font-medium text-purple-600">Checklist</span>
                <span className="text-xs text-purple-400 mt-0.5">{formatNumber(t.users_with_checklist)} users</span>
              </div>

              <div className="flex flex-col items-center">
                <ArrowRight className="h-5 w-5 text-gray-300" />
                <span className="text-xs font-bold text-indigo-600 mt-0.5">
                  {t.median_days_checklist_to_first_item != null ? `${t.median_days_checklist_to_first_item}d` : 'N/A'}
                </span>
                <span className="text-[10px] text-gray-400">median</span>
              </div>

              {/* First Item */}
              <div className="flex flex-col items-center px-4 py-3 bg-green-50 rounded-xl min-w-[120px]">
                <Baby className="h-6 w-6 text-green-500 mb-1" />
                <span className="text-xs font-medium text-green-600">First Item</span>
                <span className="text-xs text-green-400 mt-0.5">{formatNumber(t.users_with_items)} users</span>
              </div>

              {/* Signup → First Item (total) */}
              <div className="ml-4 px-4 py-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <div className="text-center">
                  <span className="text-[10px] text-gray-400 block">Signup → First Item</span>
                  <span className="text-sm font-bold text-gray-700">
                    {t.median_days_signup_to_first_item != null ? `${t.median_days_signup_to_first_item} days` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    avg {t.avg_days_signup_to_first_item != null ? `${t.avg_days_signup_to_first_item}d` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timing Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Signup → Checklist Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-1">Signup → First Checklist Use</h3>
              <p className="text-sm text-gray-500 mb-4">How quickly do users open the checklist after signing up?</p>
              {j.signup_to_checklist_distribution.length > 0 ? (
                <BarChartComponent
                  data={j.signup_to_checklist_distribution.map(d => ({ name: d.bucket, users: d.users }))}
                  bars={[{ key: 'users', color: '#8b5cf6', label: 'Users' }]}
                  height={280}
                  xAxisLabel="Time After Signup"
                  yAxisLabel="Users"
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">No checklist data yet</div>
              )}
            </div>

            {/* Signup → First Item Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-1">Signup → First Item Added</h3>
              <p className="text-sm text-gray-500 mb-4">How quickly do users add their first registry item?</p>
              {j.signup_to_item_distribution.length > 0 ? (
                <BarChartComponent
                  data={j.signup_to_item_distribution.map(d => ({ name: d.bucket, users: d.users }))}
                  bars={[{ key: 'users', color: '#10b981', label: 'Users' }]}
                  height={280}
                  xAxisLabel="Time After Signup"
                  yAxisLabel="Users"
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">No item data yet</div>
              )}
            </div>
          </div>

          {/* Pregnancy Week Charts */}
          <div className="pt-2">
            <h2 className="text-xl font-semibold text-gray-900">By Pregnancy Week</h2>
            <p className="text-sm text-gray-500 mt-1">When in their pregnancy do users share the registry and receive gifts?</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Share by Pregnancy Week */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-1">When Users Share Their Registry</h3>
              <p className="text-sm text-gray-500 mb-4">Distribution of registry sharing by pregnancy week. Week 40 = due date.</p>
              {j.share_by_pregnancy_week.length > 0 ? (
                <BarChartComponent
                  data={j.share_by_pregnancy_week.map(d => ({ name: `W${Math.round(d.pregnancy_week)}`, users: d.users }))}
                  bars={[{ key: 'users', color: '#3b82f6', label: 'Users Shared' }]}
                  height={280}
                  xAxisLabel="Pregnancy Week"
                  yAxisLabel="Users"
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">No sharing data yet (users need due dates)</div>
              )}
            </div>

            {/* Gift by Pregnancy Week */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-1">When Users Receive First Gift</h3>
              <p className="text-sm text-gray-500 mb-4">When in pregnancy do gifts start arriving? Week 40 = due date.</p>
              {j.gift_by_pregnancy_week.length > 0 ? (
                <BarChartComponent
                  data={j.gift_by_pregnancy_week.map(d => ({ name: `W${Math.round(d.pregnancy_week)}`, users: d.users }))}
                  bars={[{ key: 'users', color: '#f59e0b', label: 'Users Gifted' }]}
                  height={280}
                  xAxisLabel="Pregnancy Week"
                  yAxisLabel="Users"
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">No gift data yet (users need due dates)</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
