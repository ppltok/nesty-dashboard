import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { DonutChart } from '@/components/charts/DonutChart'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { Users, Megaphone, TrendingUp, UserPlus } from 'lucide-react'

const SOURCE_LABELS: Record<string, string> = {
  facebook: 'Meta Ads (Facebook/Instagram)',
  instagram: 'Instagram',
  google: 'Google',
  tiktok: 'TikTok',
  friend: 'Friend Referral',
  other: 'Other',
  unknown: 'Organic / Unknown',
}

const SOURCE_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  google: '#4285F4',
  tiktok: '#000000',
  friend: '#10b981',
  other: '#8b5cf6',
  unknown: '#9ca3af',
}

interface AcquisitionData {
  referral_source: string | null
  count: number
  with_registry: number
  with_items: number
}

function useAcquisitionData() {
  return useQuery<AcquisitionData[]>({
    queryKey: ['acquisition-data'],
    queryFn: async () => {
      // Get all profiles with their referral source
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, referral_source, onboarding_completed')
        .eq('onboarding_completed', true)

      if (error) throw error

      // Get registries and item counts
      const { data: registries } = await supabase
        .from('registries')
        .select('owner_id')

      const { data: items } = await supabase
        .from('items')
        .select('registry_id')

      const registryOwners = new Set(registries?.map(r => r.owner_id) || [])
      const registriesWithItems = new Set<string>()
      const registryIdToOwner = new Map<string, string>()
      registries?.forEach(r => {
        // We need registry id → owner mapping
        // Since we only have owner_id, get full registries
      })

      // Group by source
      const groups: Record<string, AcquisitionData> = {}

      for (const profile of (profiles || [])) {
        const source = profile.referral_source || 'unknown'
        if (!groups[source]) {
          groups[source] = { referral_source: source, count: 0, with_registry: 0, with_items: 0 }
        }
        groups[source].count++
        if (registryOwners.has(profile.id)) {
          groups[source].with_registry++
        }
      }

      return Object.values(groups).sort((a, b) => b.count - a.count)
    },
  })
}

export default function AcquisitionPage() {
  const acquisition = useAcquisitionData()
  const data = acquisition.data ?? []

  const totalUsers = data.reduce((sum, d) => sum + d.count, 0)
  const knownSource = data.filter(d => d.referral_source !== 'unknown').reduce((sum, d) => sum + d.count, 0)
  const topSource = data[0]

  // Chart data
  const chartData = useMemo(() =>
    data.filter(d => d.referral_source !== 'unknown').map(d => ({
      name: SOURCE_LABELS[d.referral_source || ''] || d.referral_source || 'Unknown',
      value: d.count,
      color: SOURCE_COLORS[d.referral_source || ''] || '#6b7280',
    })),
    [data]
  )

  const barData = useMemo(() =>
    data.map(d => ({
      name: SOURCE_LABELS[d.referral_source || ''] || d.referral_source || 'Unknown',
      value: d.count,
    })),
    [data]
  )

  if (acquisition.isLoading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Acquisition Sources</h1>
        <p className="text-sm text-gray-500 mt-1">Where do users come from? Based on onboarding "How did you hear about us?" answers.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Users" value={formatNumber(totalUsers)} icon={<Users size={20} />} />
        <KPICard
          title="Known Source"
          value={formatPercent(totalUsers > 0 ? knownSource / totalUsers : 0)}
          subtitle={`${formatNumber(knownSource)} of ${formatNumber(totalUsers)}`}
          icon={<Megaphone size={20} />}
        />
        <KPICard
          title="Top Source"
          value={topSource ? (SOURCE_LABELS[topSource.referral_source || ''] || topSource.referral_source || '-') : '-'}
          subtitle={topSource ? `${topSource.count} users` : ''}
          icon={<TrendingUp size={20} />}
        />
        <KPICard
          title="Unknown Source"
          value={formatNumber(totalUsers - knownSource)}
          subtitle="Signed up before tracking"
          icon={<UserPlus size={20} />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Source Distribution</h3>
          <DonutChart data={chartData} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Users by Source</h3>
          <BarChartComponent
            data={barData}
            bars={[{ key: 'value', color: '#7c4dbd', label: 'Users' }]}
            xAxisLabel="Source"
            yAxisLabel="Users"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Source Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Users</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">% of Total</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created Registry</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.referral_source || 'unknown'} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: SOURCE_COLORS[row.referral_source || ''] || '#6b7280' }}
                      />
                      <span className="font-medium text-gray-900">
                        {SOURCE_LABELS[row.referral_source || ''] || row.referral_source || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatNumber(row.count)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {totalUsers > 0 ? formatPercent(row.count / totalUsers) : '0%'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatNumber(row.with_registry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
