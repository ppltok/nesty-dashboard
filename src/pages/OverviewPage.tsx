import { useOverview, useFunnel, useStores, useCategories, useDailySignups, useDailyActiveRegistries, useTierFunnel } from '@/hooks/useDashboardData'
import type { TierName } from '@/types/dashboard'
import { Link } from 'react-router-dom'
import { useDateRange } from '@/contexts/DateRangeContext'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { TrendChart } from '@/components/charts/TrendChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/formatters'
// BarChartComponent removed — unused on this page
import {
  Gift,
  Users,
  UserPlus,
  ClipboardList,
  DollarSign,
  BarChart3,
  Package,
  CheckCircle,
  Puzzle,
  Handshake,
  Heart,
  UserCircle,
} from 'lucide-react'

/** Compute % change and formatted label */
function trend(current: number, previous: number): { change?: string; changePositive?: boolean } {
  if (previous === 0 && current === 0) return {}
  if (previous === 0) return { change: 'New', changePositive: true }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) return {}
  return {
    change: `${Math.abs(Math.round(pct))}%`,
    changePositive: pct > 0,
  }
}

export default function OverviewPage() {
  const { dateRange } = useDateRange()
  const overview = useOverview(dateRange.start, dateRange.end)
  const funnel = useFunnel()
  const stores = useStores()
  const categories = useCategories()
  const signups = useDailySignups()
  const dailyActive = useDailyActiveRegistries()
  const tierFunnel = useTierFunnel(dateRange.start, dateRange.end)

  if (overview.isLoading) return <PageSkeleton />
  if (overview.error) return <div className="p-6 text-red-600">Failed to load overview: {overview.error.message}</div>

  const data = overview.data!

  const extensionAdoption =
    data.total_users_with_items > 0
      ? (data.extension_users / data.total_users_with_items) * 100
      : 0

  // Trend calculations
  const newUsersTrend = trend(data.new_users, data.prev_new_users ?? 0)
  const registriesTrend = trend(data.active_registries, data.prev_active_registries ?? data.active_registries)
  const gmvTrend = trend(data.platform_gmv, data.prev_platform_gmv ?? data.platform_gmv)

  // Active-registry rate: of the new signups this period, how many have an
  // active registry? Literal ratio `active_registries / new_users` — can
  // exceed 100% when existing users are active too (we surface that as-is;
  // it's informative signal that older cohorts stay engaged).
  const activeRate = data.new_users > 0 ? (data.active_registries / data.new_users) * 100 : 0
  const prevActiveRate =
    (data.prev_new_users ?? 0) > 0
      ? ((data.prev_active_registries ?? 0) / (data.prev_new_users ?? 1)) * 100
      : 0
  const activeRateTrend = trend(activeRate, prevActiveRate)

  // Owner-side vs external gifts (period). Friends & family share = external ÷ (owner + external).
  const giftsByOwner = data.gifts_by_owner ?? 0
  const giftsByExternal = data.gifts_by_external ?? 0
  const giftsTotalSplit = giftsByOwner + giftsByExternal
  const externalShare = giftsTotalSplit > 0 ? (giftsByExternal / giftsTotalSplit) * 100 : 0
  const prevGiftsByOwner = data.prev_gifts_by_owner ?? 0
  const prevGiftsByExternal = data.prev_gifts_by_external ?? 0
  const ownerGiftsTrend = trend(giftsByOwner, prevGiftsByOwner)
  const externalGiftsTrend = trend(giftsByExternal, prevGiftsByExternal)

  const CATEGORY_LABELS: Record<string, string> = {
    strollers: 'Strollers', car_safety: 'Car Safety', furniture: 'Furniture',
    safety: 'Safety', feeding: 'Feeding', nursing: 'Nursing',
    bath: 'Bath', clothing: 'Clothing', bedding: 'Bedding', toys: 'Toys',
  }

  const funnelData = funnel.data ?? []
  const topStores = (stores.data ?? []).slice(0, 5)
  const categoryData = (categories.data ?? []).map((c) => ({
    name: CATEGORY_LABELS[c.category] ?? c.category,
    value: c.item_count,
  }))

  return (
    <div className="space-y-6">
      {/* KPI Row 1 — period-filtered headline metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="North Star (Gifted 30d)"
          value={formatNumber(data.north_star_30d)}
          icon={<Gift className="h-5 w-5 text-pink-500" />}
          tooltip="Registries that received at least one confirmed gift in the last 30 days. This is our primary success metric."
        />
        <KPICard
          title="New Signups (period)"
          value={formatNumber(data.new_users)}
          icon={<UserPlus className="h-5 w-5 text-blue-500" />}
          tooltip="Users who signed up during the selected date range. Updates with the date filter."
          change={newUsersTrend.change}
          changePositive={newUsersTrend.changePositive}
          subtitle="vs prev period"
        />
        <KPICard
          title="Active Registries"
          value={formatNumber(data.active_registries)}
          icon={<ClipboardList className="h-5 w-5 text-green-500" />}
          tooltip="Registries that had at least one item added during the selected period."
          change={registriesTrend.change}
          changePositive={registriesTrend.changePositive}
          subtitle="vs prev period"
        />
        <KPICard
          title="Platform GMV"
          value={formatCurrency(data.platform_gmv)}
          icon={<DollarSign className="h-5 w-5 text-yellow-500" />}
          tooltip="Gross Merchandise Value — total wishlist value (price x quantity) across all registries."
          change={gmvTrend.change}
          changePositive={gmvTrend.changePositive}
          subtitle="vs prev period"
        />
      </div>

      {/* KPI Row 1b — gift attribution (who actually bought) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Gifts by Friends & Family"
          value={formatNumber(giftsByExternal)}
          icon={<Heart className="h-5 w-5 text-pink-500" />}
          tooltip="Confirmed gift purchases (this period) where the buyer email does NOT match the registry owner or co-parent — i.e. real external gift-givers."
          change={externalGiftsTrend.change}
          changePositive={externalGiftsTrend.changePositive}
          subtitle="vs prev period"
        />
        <KPICard
          title="Gifts by Owner / Co-parent"
          value={formatNumber(giftsByOwner)}
          icon={<UserCircle className="h-5 w-5 text-gray-500" />}
          tooltip="Confirmed gift purchases (this period) where the buyer email matches the registry owner or their co-parent. Usually self-bought items the owner ran through the gift flow."
          change={ownerGiftsTrend.change}
          changePositive={ownerGiftsTrend.changePositive}
          subtitle="vs prev period"
        />
        <KPICard
          title="Friends & Family Share"
          value={formatPercent(externalShare)}
          icon={<Gift className="h-5 w-5 text-rose-500" />}
          tooltip="Share of confirmed gifts (this period) bought by friends & family rather than the owner/co-parent. Higher = registries are reaching their network, not just being self-fulfilled."
          subtitle={`${formatNumber(giftsByExternal)} of ${formatNumber(giftsTotalSplit)}`}
        />
      </div>

      {/* KPI Row 2 — all-time / structural metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Total Users"
          value={formatNumber(data.total_users)}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          tooltip="All signed-up users across all time (cumulative, not filtered by date range)."
          subtitle="all-time"
        />
        <KPICard
          title="Co-parents"
          value={formatNumber(data.co_parents_count)}
          icon={<Handshake className="h-5 w-5 text-rose-500" />}
          tooltip="Registries with an accepted co-parent invitation. Counts distinct registries with a linked partner."
          subtitle="registries w/ partner"
        />
        <KPICard
          title="Avg Registry Value"
          value={formatCurrency(data.avg_registry_value)}
          icon={<BarChart3 className="h-5 w-5 text-indigo-500" />}
          tooltip="Average total wishlist value (price x quantity) per registry."
        />
        <KPICard
          title="Avg Items/Registry"
          value={formatNumber(data.avg_items_per_registry)}
          icon={<Package className="h-5 w-5 text-teal-500" />}
          tooltip="Average number of items added per active registry."
        />
        <KPICard
          title="Active Registry Rate"
          value={formatPercent(activeRate)}
          icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
          tooltip="Active registries ÷ new signups (this period). Can exceed 100% when older cohorts stay active alongside fresh signups."
          change={activeRateTrend.change}
          changePositive={activeRateTrend.changePositive}
          subtitle="vs prev period"
        />
        <KPICard
          title="Extension Adoption"
          value={formatPercent(extensionAdoption)}
          icon={<Puzzle className="h-5 w-5 text-purple-500" />}
          tooltip="Percentage of users with items who added at least one item via the Chrome extension (vs manual entry)."
        />
      </div>

      {/* User Tier Funnel — compact view, filtered by signup cohort */}
      {(() => {
        const TIER_META_OV: Record<TierName, { label: string; color: string }> = {
          user:     { label: 'User',       color: '#94a3b8' },
          started:  { label: 'Started',    color: '#60a5fa' },
          active:   { label: 'Active',     color: '#34d399' },
          super:    { label: 'Super',      color: '#fbbf24' },
          champion: { label: 'Champion',   color: '#f472b6' },
        }
        const tf = tierFunnel.data
        const totalTier = tf?.total_users ?? 0
        const rows = (tf?.tiers ?? []).map((row) => ({
          ...row,
          meta: TIER_META_OV[row.tier],
          pct: totalTier > 0 ? (row.users / totalTier) * 100 : 0,
        }))
        const maxUsers = Math.max(1, ...rows.map((r) => r.users))
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-medium text-gray-900">User Tier Funnel</h2>
              <Link to="/funnel" className="text-xs text-indigo-600 hover:text-indigo-700">Details →</Link>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Signup cohort: {dateRange.label} · {formatNumber(totalTier)} users · tests excluded
            </p>
            {tierFunnel.isLoading ? (
              <div className="h-32 flex items-center justify-center text-gray-400">Loading tiers...</div>
            ) : rows.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-gray-400">No signups in this range</div>
            ) : (
              <div className="grid grid-cols-5 gap-3">
                {rows.map((row) => (
                  <div key={row.tier} className="flex flex-col items-center">
                    <div className="text-xs text-gray-500 mb-1.5">{row.meta.label}</div>
                    <div className="w-full h-28 bg-gray-50 rounded-lg overflow-hidden flex items-end">
                      <div
                        className="w-full transition-all duration-500"
                        style={{
                          height: `${(row.users / maxUsers) * 100}%`,
                          backgroundColor: row.meta.color,
                          minHeight: row.users > 0 ? '4px' : '0',
                        }}
                      />
                    </div>
                    <div className="text-lg font-semibold text-gray-900 mt-2">{formatNumber(row.users)}</div>
                    <div className="text-xs text-gray-400">{row.pct.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Signups Trend + Active Registries overlay */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Daily Signups &amp; Active Registries</h2>
        {(signups.isLoading || dailyActive.isLoading) ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
        ) : (
          <TrendChart
            data={(() => {
              // Merge the two series into one row-per-day so the chart can
              // render both lines on a shared x-axis. Days present in either
              // series become a row; missing values become 0 so the line
              // still draws across the range.
              const activeByDay = new Map<string, number>()
              for (const d of dailyActive.data ?? []) activeByDay.set(d.day, d.active_registries)
              const signupByDay = new Map<string, number>()
              for (const d of signups.data ?? []) signupByDay.set(d.day, d.signups)

              const allDays = new Set<string>([...activeByDay.keys(), ...signupByDay.keys()])
              return Array.from(allDays)
                .sort()
                .filter((day) => {
                  const date = new Date(day)
                  return date >= dateRange.start && date <= dateRange.end
                })
                .map((day) => ({
                  day,
                  signups: signupByDay.get(day) ?? 0,
                  active_registries: activeByDay.get(day) ?? 0,
                }))
            })()}
            lines={[
              { key: 'signups', color: '#6366f1', label: 'Signups' },
              { key: 'active_registries', color: '#10b981', label: 'Active Registries' },
            ]}
            height={280}
            xAxisLabel="Date"
            yAxisLabel="Count"
          />
        )}
      </div>

      {/* Bottom Grid: Funnel + Top Stores + Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mini Funnel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Funnel</h2>
          {funnel.isLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-3">
              {funnelData.map((stage) => {
                const maxCount = funnelData[0]?.count || 1
                const widthPct = (stage.count / maxCount) * 100
                return (
                  <div key={stage.stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 capitalize">{stage.stage.replace('_', ' ')}</span>
                      <span className="font-medium text-gray-900">{formatNumber(stage.count)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div
                        className="bg-indigo-500 h-3 rounded-full transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top 5 Stores */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top 5 Stores</h2>
          {stores.isLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-3">
              {topStores.map((store, i) => (
                <div key={store.store_domain} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-400 w-5">{i + 1}</span>
                    <span className="text-sm text-gray-900">{store.store_display_name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {formatNumber(store.item_count)} items
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Donut */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Categories</h2>
          {categories.isLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <DonutChart data={categoryData} height={240} />
          )}
        </div>
      </div>
    </div>
  )
}
