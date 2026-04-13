import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { DonutChart } from '@/components/charts/DonutChart'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { formatNumber, formatPercent } from '@/lib/formatters'
import {
  ClipboardList, Users, CheckCircle, Eye, EyeOff,
  PenLine, TrendingUp, Layers, Star
} from 'lucide-react'

// Category labels (Hebrew) — must match Checklist.tsx CATEGORIES
const CATEGORY_LABELS: Record<string, string> = {
  strollers: 'Strollers',
  car_safety: 'Car Safety',
  furniture: 'Furniture',
  safety: 'Home Safety',
  feeding: 'Feeding',
  nursing: 'Nursing',
  birth_prep: 'Birth Prep',
  bath: 'Bath',
  clothing: 'Clothing',
  bedding: 'Bedding',
  toys: 'Toys & Dev',
  general: 'General',
  siblings: 'Siblings',
}

const CATEGORY_COLORS: Record<string, string> = {
  strollers: '#7c4dbd',
  car_safety: '#e74c3c',
  furniture: '#3498db',
  safety: '#e67e22',
  feeding: '#2ecc71',
  nursing: '#f1c40f',
  birth_prep: '#e91e63',
  bath: '#00bcd4',
  clothing: '#9c27b0',
  bedding: '#607d8b',
  toys: '#ff9800',
  general: '#795548',
  siblings: '#8bc34a',
}

interface ChecklistPref {
  id: string
  user_id: string
  category_id: string
  item_name: string
  quantity: number
  is_checked: boolean
  is_hidden: boolean
  notes: string | null
  priority: string
  created_at: string
  updated_at: string
  checked_at: string | null
}

interface ProfileMinimal {
  id: string
  email: string
  first_name: string | null
  due_date: string | null
  created_at: string
}

function useChecklistData() {
  return useQuery<ChecklistPref[]>({
    queryKey: ['checklist-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_preferences')
        .select('*')
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })
}

function useProfiles() {
  return useQuery<ProfileMinimal[]>({
    queryKey: ['checklist-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, due_date, created_at')
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Test accounts to exclude from analytics
const TEST_EMAILS = ['tom@ppltok.com']

export default function ChecklistAnalyticsPage() {
  const checklistQuery = useChecklistData()
  const profilesQuery = useProfiles()
  const allProfiles = profilesQuery.data ?? []

  // Filter out test accounts
  const testUserIds = new Set(
    allProfiles.filter(p => TEST_EMAILS.includes(p.email)).map(p => p.id)
  )
  const profiles = allProfiles.filter(p => !TEST_EMAILS.includes(p.email))
  const prefs = (checklistQuery.data ?? []).filter(p => !testUserIds.has(p.user_id))

  // ===== COMPUTED METRICS =====

  const metrics = useMemo(() => {
    if (!prefs.length || !profiles.length) return null

    const totalUsers = profiles.length
    const checklistUsers = new Set(prefs.map(p => p.user_id))
    const activeUsers = checklistUsers.size

    // Per-user stats
    const userStats = new Map<string, {
      checked: number
      hidden: number
      custom: number // items with no matching suggested item
      notes: number
      total: number
      essential: number
      niceToHave: number
      firstInteraction: string
      lastInteraction: string
    }>()

    for (const pref of prefs) {
      if (!userStats.has(pref.user_id)) {
        userStats.set(pref.user_id, {
          checked: 0, hidden: 0, custom: 0, notes: 0, total: 0,
          essential: 0, niceToHave: 0,
          firstInteraction: pref.created_at,
          lastInteraction: pref.updated_at,
        })
      }
      const s = userStats.get(pref.user_id)!
      s.total++
      if (pref.is_checked) s.checked++
      if (pref.is_hidden) s.hidden++
      if (pref.notes && pref.notes.trim().length > 0) s.notes++
      if (pref.priority === 'essential') s.essential++
      else s.niceToHave++
      if (pref.created_at < s.firstInteraction) s.firstInteraction = pref.created_at
      if (pref.updated_at > s.lastInteraction) s.lastInteraction = pref.updated_at
    }

    // Engagement tiers
    const engagementTiers = {
      visitors: activeUsers,        // Any interaction
      engaged: 0,                    // >= 5 items interacted
      active: 0,                     // >= 10 items checked
      power: 0,                      // >= 50% completion
    }

    let totalCompletion = 0
    let usersWithChecks = 0
    const completionRates: number[] = []

    for (const [, stats] of userStats) {
      if (stats.total >= 5) engagementTiers.engaged++
      if (stats.checked >= 10) engagementTiers.active++
      const nonHidden = stats.total - stats.hidden
      if (nonHidden > 0) {
        const rate = stats.checked / nonHidden
        completionRates.push(rate)
        totalCompletion += rate
        usersWithChecks++
        if (rate >= 0.5) engagementTiers.power++
      }
    }

    const avgCompletion = usersWithChecks > 0 ? totalCompletion / usersWithChecks : 0

    // Notes adoption
    const usersWithNotes = Array.from(userStats.values()).filter(s => s.notes > 0).length
    const notesAdoption = activeUsers > 0 ? usersWithNotes / activeUsers : 0

    // Category-level analytics
    const categoryStats = new Map<string, {
      total: number
      checked: number
      hidden: number
      withNotes: number
      users: Set<string>
    }>()

    for (const pref of prefs) {
      if (!categoryStats.has(pref.category_id)) {
        categoryStats.set(pref.category_id, {
          total: 0, checked: 0, hidden: 0, withNotes: 0, users: new Set()
        })
      }
      const c = categoryStats.get(pref.category_id)!
      c.total++
      c.users.add(pref.user_id)
      if (pref.is_checked) c.checked++
      if (pref.is_hidden) c.hidden++
      if (pref.notes && pref.notes.trim().length > 0) c.withNotes++
    }

    // Most hidden items (suggested items users reject)
    const hiddenItems = new Map<string, number>()
    for (const pref of prefs) {
      if (pref.is_hidden) {
        const key = pref.item_name
        hiddenItems.set(key, (hiddenItems.get(key) || 0) + 1)
      }
    }
    const topHiddenItems = Array.from(hiddenItems.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, count }))

    // Most checked items (popular items)
    const checkedItems = new Map<string, number>()
    for (const pref of prefs) {
      if (pref.is_checked) {
        const key = pref.item_name
        checkedItems.set(key, (checkedItems.get(key) || 0) + 1)
      }
    }
    const topCheckedItems = Array.from(checkedItems.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, count }))

    // Custom items (items not in known suggested items — detect by checking if multiple users have same item, or unique per user)
    // We'll identify items that appear for only 1 user as likely custom
    const itemUserCount = new Map<string, Set<string>>()
    for (const pref of prefs) {
      if (!itemUserCount.has(pref.item_name)) {
        itemUserCount.set(pref.item_name, new Set())
      }
      itemUserCount.get(pref.item_name)!.add(pref.user_id)
    }
    const customItems = Array.from(itemUserCount.entries())
      .filter(([, users]) => users.size === 1) // Unique to one user = likely custom
      .map(([name]) => name)

    // Time-based: checked_at distribution (by day of week, by hour)
    const checkedByDow = new Array(7).fill(0) // Sun-Sat
    const checkedByHour = new Array(24).fill(0)
    for (const pref of prefs) {
      if (pref.checked_at) {
        const d = new Date(pref.checked_at)
        checkedByDow[d.getDay()]++
        checkedByHour[d.getHours()]++
      }
    }

    // Per-user table data
    const userTable = Array.from(userStats.entries()).map(([userId, stats]) => {
      const profile = profiles.find(p => p.id === userId)
      const nonHidden = stats.total - stats.hidden
      return {
        userId,
        email: profile?.email || 'Unknown',
        name: profile?.first_name || '-',
        dueDate: profile?.due_date || null,
        totalItems: stats.total,
        checked: stats.checked,
        hidden: stats.hidden,
        notes: stats.notes,
        completion: nonHidden > 0 ? stats.checked / nonHidden : 0,
        firstInteraction: stats.firstInteraction,
        lastInteraction: stats.lastInteraction,
      }
    }).sort((a, b) => b.checked - a.checked)

    return {
      totalUsers,
      activeUsers,
      adoptionRate: totalUsers > 0 ? activeUsers / totalUsers : 0,
      avgCompletion,
      notesAdoption,
      engagementTiers,
      categoryStats,
      topHiddenItems,
      topCheckedItems,
      customItems,
      checkedByDow,
      checkedByHour,
      userTable,
      completionRates,
      totalChecked: prefs.filter(p => p.is_checked).length,
      totalHidden: prefs.filter(p => p.is_hidden).length,
      totalWithNotes: prefs.filter(p => p.notes && p.notes.trim().length > 0).length,
    }
  }, [prefs, profiles])

  // ===== CHART DATA =====

  const categoryChartData = useMemo(() => {
    if (!metrics) return []
    return Array.from(metrics.categoryStats.entries())
      .map(([catId, stats]) => ({
        name: CATEGORY_LABELS[catId] || catId,
        checked: stats.checked,
        hidden: stats.hidden,
        total: stats.total,
        users: stats.users.size,
        completion: stats.total > 0 ? Math.round((stats.checked / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.users - a.users)
  }, [metrics])

  const categoryEngagementDonut = useMemo(() => {
    if (!metrics) return []
    return Array.from(metrics.categoryStats.entries())
      .map(([catId, stats]) => ({
        name: CATEGORY_LABELS[catId] || catId,
        value: stats.users.size,
        color: CATEGORY_COLORS[catId] || '#6b7280',
      }))
      .sort((a, b) => b.value - a.value)
  }, [metrics])

  const funnelData = useMemo(() => {
    if (!metrics) return []
    return [
      { name: 'Total Users', value: metrics.totalUsers },
      { name: 'Opened Checklist', value: metrics.engagementTiers.visitors },
      { name: 'Engaged (5+ items)', value: metrics.engagementTiers.engaged },
      { name: 'Active (10+ checked)', value: metrics.engagementTiers.active },
      { name: 'Power (50%+ done)', value: metrics.engagementTiers.power },
    ]
  }, [metrics])

  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dowData = useMemo(() => {
    if (!metrics) return []
    return metrics.checkedByDow.map((count: number, i: number) => ({
      name: dowLabels[i],
      value: count,
    }))
  }, [metrics])

  const completionDistribution = useMemo(() => {
    if (!metrics) return []
    const buckets = [
      { label: '0%', min: 0, max: 0.01 },
      { label: '1-10%', min: 0.01, max: 0.1 },
      { label: '10-25%', min: 0.1, max: 0.25 },
      { label: '25-50%', min: 0.25, max: 0.5 },
      { label: '50-75%', min: 0.5, max: 0.75 },
      { label: '75-100%', min: 0.75, max: 1.01 },
    ]
    return buckets.map(b => ({
      name: b.label,
      value: metrics.completionRates.filter((r: number) => r >= b.min && r < b.max).length,
    }))
  }, [metrics])

  if (checklistQuery.isLoading || profilesQuery.isLoading) return <PageSkeleton />

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No checklist data found
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Checklist Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          How users interact with the pregnancy preparation checklist. {metrics.activeUsers} of {metrics.totalUsers} users have interacted.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Checklist Adoption"
          value={formatPercent(metrics.adoptionRate * 100)}
          subtitle={`${formatNumber(metrics.activeUsers)} of ${formatNumber(metrics.totalUsers)} users`}
          icon={<ClipboardList size={20} />}
        />
        <KPICard
          title="Avg Completion"
          value={formatPercent(metrics.avgCompletion * 100)}
          subtitle="Among active users"
          icon={<CheckCircle size={20} />}
        />
        <KPICard
          title="Notes Adoption"
          value={formatPercent(metrics.notesAdoption * 100)}
          subtitle={`${formatNumber(metrics.totalWithNotes)} notes written`}
          icon={<PenLine size={20} />}
        />
        <KPICard
          title="Items Rejected"
          value={formatNumber(metrics.totalHidden)}
          subtitle={`${formatNumber(metrics.customItems.length)} custom items added`}
          icon={<EyeOff size={20} />}
        />
      </div>

      {/* Engagement Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Engagement Funnel</h3>
        <div className="flex items-end justify-between gap-2 h-48">
          {funnelData.map((step, i) => {
            const maxVal = funnelData[0]?.value || 1
            const heightPct = Math.max(8, (step.value / maxVal) * 100)
            const opacity = 1 - (i * 0.15)
            return (
              <div key={step.name} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-gray-900">{formatNumber(step.value)}</span>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: `rgba(99, 102, 241, ${opacity})`,
                  }}
                />
                <span className="text-[10px] text-gray-500 text-center leading-tight">{step.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Charts Row 1: Category engagement + Completion distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Users by Category</h3>
          <DonutChart data={categoryEngagementDonut} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Completion Distribution</h3>
          <BarChartComponent
            data={completionDistribution}
            bars={[{ key: 'value', color: '#6366f1', label: 'Users' }]}
            xAxisLabel="Completion Rate"
            yAxisLabel="Users"
          />
        </div>
      </div>

      {/* Charts Row 2: Category completion rates */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Category Completion Rates</h3>
        <BarChartComponent
          data={categoryChartData}
          bars={[
            { key: 'checked', color: '#10b981', label: 'Checked' },
            { key: 'hidden', color: '#ef4444', label: 'Rejected' },
          ]}
          xAxisLabel="Category"
          yAxisLabel="Items"
          xTickAngle={-35}
          height={350}
        />
      </div>

      {/* Charts Row 3: Activity by day of week */}
      {dowData.some(d => d.value > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Check Activity by Day of Week</h3>
          <BarChartComponent
            data={dowData}
            bars={[{ key: 'value', color: '#8b5cf6', label: 'Items Checked' }]}
            xAxisLabel="Day"
            yAxisLabel="Items Checked"
          />
        </div>
      )}

      {/* Tables Row: Most popular + Most rejected */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most checked items */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <Star size={16} className="text-yellow-500" />
            <h3 className="text-sm font-semibold text-gray-700">Most Popular Items</h3>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Item</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Users</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topCheckedItems.map((item, i) => (
                  <tr key={item.name} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 text-gray-900 font-medium" dir="auto">{item.name}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{item.count}</td>
                  </tr>
                ))}
                {metrics.topCheckedItems.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No checked items yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Most rejected items */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <EyeOff size={16} className="text-red-400" />
            <h3 className="text-sm font-semibold text-gray-700">Most Rejected Items</h3>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Item</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Rejected by</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topHiddenItems.map((item, i) => (
                  <tr key={item.name} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 text-gray-900 font-medium" dir="auto">{item.name}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{item.count}</td>
                  </tr>
                ))}
                {metrics.topHiddenItems.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No rejected items yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Custom items insight */}
      {metrics.customItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-700">
              Custom Items Added by Users ({metrics.customItems.length})
            </h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">Items unique to one user — potential gaps in suggested items list</p>
          <div className="flex flex-wrap gap-2">
            {metrics.customItems.slice(0, 40).map(item => (
              <span
                key={item}
                className="px-3 py-1 bg-purple-50 text-purple-700 text-xs rounded-full border border-purple-200"
                dir="auto"
              >
                {item}
              </span>
            ))}
            {metrics.customItems.length > 40 && (
              <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                +{metrics.customItems.length - 40} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Per-user table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Users size={16} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-700">Per-User Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Checked</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Hidden</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Notes</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Completion</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {metrics.userTable.slice(0, 50).map(row => (
                <tr key={row.userId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-gray-900 font-medium">{row.name}</span>
                      <span className="text-gray-400 text-xs block">{row.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-green-600 font-medium">{row.checked}</span>
                    <span className="text-gray-400">/{row.totalItems}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.hidden}</td>
                  <td className="px-4 py-3 text-gray-500">{row.notes}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full"
                          style={{ width: `${Math.min(100, row.completion * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{formatPercent(row.completion * 100)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(row.lastInteraction).toLocaleDateString('en-IL')}
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
