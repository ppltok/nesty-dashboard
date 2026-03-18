import { useFunnel } from '@/hooks/useDashboardData'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { FunnelChart } from '@/components/charts/FunnelChart'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { Download } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'

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

  if (isLoading) return <PageSkeleton />
  if (error) return <div className="p-6 text-red-600">Failed to load funnel: {error.message}</div>

  const stages = data ?? []
  const signupCount = stages[0]?.count || 1

  return (
    <div className="space-y-6">
      {/* Funnel Visualization */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
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
    </div>
  )
}
