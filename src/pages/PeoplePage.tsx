import { useState, useMemo } from 'react'
import { usePeopleList } from '@/hooks/useDashboardData'
import type { PersonRow } from '@/types/dashboard'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/formatters'
import { downloadCSV } from '@/lib/csv'
import {
  Users, ShoppingBag, Target, TrendingUp,
  ArrowUpDown, Download, ChevronDown, ChevronRight,
  Copy, ExternalLink, Search, Check,
} from 'lucide-react'

type SortKey = 'display_name' | 'pregnancy_week' | 'item_count' |
  'registry_value' | 'gifts_received' | 'completion_pct' | 'signed_up_at'

function formatWeek(week: number | null): string {
  if (week === null) return '--'
  if (week <= 40) return `Week ${week}`
  return `PP +${week - 40}w`
}

function completionBadge(pct: number): { bg: string; text: string } {
  if (pct === 0) return { bg: 'bg-gray-100', text: 'text-gray-600' }
  if (pct < 25) return { bg: 'bg-red-100', text: 'text-red-700' }
  if (pct < 50) return { bg: 'bg-amber-100', text: 'text-amber-700' }
  if (pct < 75) return { bg: 'bg-blue-100', text: 'text-blue-700' }
  return { bg: 'bg-green-100', text: 'text-green-700' }
}

export default function PeoplePage() {
  const { data, isLoading, error } = usePeopleList()
  const [sortKey, setSortKey] = useState<SortKey>('signed_up_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let users = data?.users ?? []
    if (search) {
      const q = search.toLowerCase()
      users = users.filter(u =>
        u.display_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    }
    return [...users].sort((a, b) => {
      const va = a[sortKey] ?? (sortAsc ? Infinity : -Infinity)
      const vb = b[sortKey] ?? (sortAsc ? Infinity : -Infinity)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortAsc ? cmp : -cmp
    })
  }, [data, sortKey, sortAsc, search])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const copyEmail = (email: string, id: string) => {
    navigator.clipboard.writeText(email)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const SortHeader = ({ field, label }: { field: SortKey; label: string }) => (
    <th
      className="px-4 py-3 font-medium text-gray-500 cursor-pointer select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      {label}
      {sortKey === field
        ? (sortAsc
          ? <ChevronDown className="inline h-3 w-3 ml-1 rotate-180" />
          : <ChevronDown className="inline h-3 w-3 ml-1" />)
        : <ArrowUpDown className="inline h-3 w-3 ml-1 text-gray-300" />}
    </th>
  )

  if (isLoading) return <PageSkeleton />
  if (error) return <div className="p-6 text-red-600">Failed to load people data: {error.message}</div>

  const s = data!.summary

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Users"
          value={formatNumber(s.total_users)}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          tooltip="All registered users excluding test accounts."
        />
        <KPICard
          title="Users with Items"
          value={formatNumber(s.users_with_items)}
          icon={<ShoppingBag className="h-5 w-5 text-green-500" />}
          subtitle={`${s.total_users > 0 ? Math.round((s.users_with_items / s.total_users) * 100) : 0}% activation`}
          tooltip="Users who added at least one item to their registry."
        />
        <KPICard
          title="Avg Registry Value"
          value={formatCurrency(s.avg_registry_value)}
          icon={<Target className="h-5 w-5 text-indigo-500" />}
          tooltip="Average total wishlist value across registries with items."
        />
        <KPICard
          title="Avg Completion"
          value={formatPercent(s.avg_completion)}
          icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
          tooltip="Average percentage of wishlist items received as gifts."
        />
      </div>

      {/* Status dots legend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-5 py-3 flex items-center gap-6 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status Legend</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Onboarded</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" /> Has Items</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Has Gifts</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Email Opt-in</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" /> Not active</span>
      </div>

      {/* Search + Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">{filtered.length} users</span>
            <button
              onClick={() =>
                downloadCSV(
                  filtered.map(u => ({
                    Name: u.display_name,
                    Email: u.email,
                    'Pregnancy Week': formatWeek(u.pregnancy_week),
                    Items: u.item_count,
                    'Registry Value': u.registry_value,
                    'Gifts Received': u.gifts_received,
                    'Completion %': u.completion_pct,
                    'Signed Up': new Date(u.signed_up_at).toLocaleDateString('en-GB'),
                    'Due Date': u.due_date ? new Date(u.due_date).toLocaleDateString('en-GB') : '',
                    'Onboarded': u.onboarding_completed ? 'Yes' : 'No',
                    'Email Opt-in': u.email_notifications ? 'Yes' : 'No',
                  })),
                  'nesty-users'
                )
              }
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-md border border-gray-200 transition-colors"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 font-medium text-gray-500 w-10">Status</th>
                <SortHeader field="display_name" label="Name" />
                <th className="px-4 py-3 font-medium text-gray-500">Email</th>
                <SortHeader field="pregnancy_week" label="Week" />
                <SortHeader field="item_count" label="Items" />
                <SortHeader field="registry_value" label="Registry Value" />
                <SortHeader field="gifts_received" label="Gifts" />
                <SortHeader field="completion_pct" label="Completion" />
                <SortHeader field="signed_up_at" label="Signed Up" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((user) => {
                const isExpanded = expandedId === user.id
                const badge = completionBadge(user.completion_pct)
                return (
                  <RowGroup key={user.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : user.id)}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-4 py-3">
                        <StatusDots user={user} />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {user.display_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate" title={user.email}>{user.email}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyEmail(user.email, user.id) }}
                            className="shrink-0 text-gray-300 hover:text-gray-600 transition-colors"
                            title="Copy email"
                          >
                            {copiedId === user.id
                              ? <Check className="h-3.5 w-3.5 text-green-500" />
                              : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatWeek(user.pregnancy_week)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-right">{user.item_count}</td>
                      <td className="px-4 py-3 text-gray-700 text-right whitespace-nowrap">
                        {user.registry_value > 0 ? formatCurrency(user.registry_value) : '--'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-right">{user.gifts_received || '--'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                          {formatPercent(user.completion_pct)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(user.signed_up_at).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={10} className="px-6 py-4">
                          <ExpandedRow user={user} />
                        </td>
                      </tr>
                    )}
                  </RowGroup>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="h-32 flex items-center justify-center text-gray-400">
              {search ? 'No users match your search.' : 'No users found.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Fragment wrapper for row groups */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/** Expanded detail panel for a user */
function ExpandedRow({ user }: { user: PersonRow }) {
  const registryUrl = user.registry_slug
    ? `https://nestyil.com/registry/${user.registry_slug}`
    : null

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatBadge label="Due Date" value={user.due_date ? new Date(user.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'} />
        <StatBadge label="First-time Parent" value={user.is_first_time_parent ? 'Yes' : user.is_first_time_parent === false ? 'No' : '--'} />
        <StatBadge label="Feeling" value={user.feeling ?? '--'} />
        <StatBadge label="Onboarded" value={user.onboarding_completed ? 'Yes' : 'No'} />
        <StatBadge label="Email Opt-in" value={user.email_notifications ? 'Yes' : 'No'} />
        <StatBadge label="Unique Givers" value={String(user.unique_givers)} />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {registryUrl && (
          <a
            href={registryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Registry
          </a>
        )}
        {user.completion_pct > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md">
            {Math.round(user.completion_pct)}% of registry funded ({user.gifts_received} of {user.total_wanted} items)
          </span>
        )}
      </div>

      {/* Top items */}
      {user.top_items && user.top_items.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top Items (by price)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pr-4 py-1.5 font-medium">Item</th>
                  <th className="pr-4 py-1.5 font-medium">Category</th>
                  <th className="pr-4 py-1.5 font-medium">Store</th>
                  <th className="pr-4 py-1.5 font-medium text-right">Price</th>
                  <th className="pr-4 py-1.5 font-medium text-right">Qty</th>
                  <th className="py-1.5 font-medium text-right">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {user.top_items.map((item, i) => (
                  <tr key={i} className="text-gray-700">
                    <td className="pr-4 py-1.5 max-w-[200px] truncate" title={item.name}>
                      {item.original_url ? (
                        <a
                          href={item.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.name}
                        </a>
                      ) : item.name}
                    </td>
                    <td className="pr-4 py-1.5 text-gray-500 capitalize">{item.category || '--'}</td>
                    <td className="pr-4 py-1.5 text-gray-500">{item.store_name || '--'}</td>
                    <td className="pr-4 py-1.5 text-right">{formatCurrency(item.price)}</td>
                    <td className="pr-4 py-1.5 text-right">{item.quantity}</td>
                    <td className="py-1.5 text-right">
                      <span className={item.quantity_received > 0 ? 'text-green-600 font-medium' : ''}>
                        {item.quantity_received}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** Status indicator dots showing user lifecycle at a glance */
function StatusDots({ user }: { user: PersonRow }) {
  const dots: { color: string; label: string }[] = [
    {
      color: user.onboarding_completed ? 'bg-green-400' : 'bg-gray-300',
      label: user.onboarding_completed ? 'Onboarded' : 'Not onboarded',
    },
    {
      color: user.item_count > 0 ? 'bg-indigo-400' : 'bg-gray-300',
      label: user.item_count > 0 ? `${user.item_count} items` : 'No items',
    },
    {
      color: user.gifts_received > 0 ? 'bg-emerald-400' : 'bg-gray-300',
      label: user.gifts_received > 0 ? `${user.gifts_received} gifts` : 'No gifts',
    },
    {
      color: user.email_notifications ? 'bg-blue-400' : 'bg-gray-300',
      label: user.email_notifications ? 'Email opt-in' : 'Email opt-out',
    },
  ]

  return (
    <div className="flex items-center gap-1" title={dots.map(d => d.label).join(' · ')}>
      {dots.map((dot, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${dot.color}`}
          title={dot.label}
        />
      ))}
    </div>
  )
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5 capitalize">{value}</p>
    </div>
  )
}
