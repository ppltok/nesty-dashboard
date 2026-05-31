import PivotAnalytics from '@/components/pivot/PivotAnalytics'

// Ad-hoc pivot / report builder over live Supabase data (Items + Users grains).
// Drag dimensions onto Row/Column shelves, pick a metric, slice by date — the
// same self-contained engine ported from the consumer app's /admin tab.
export default function PivotPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Pivot Tables</h1>
        <p className="text-sm text-gray-500 mt-1">
          Build your own cross-tab report — drag fields onto Row/Column, pick a
          metric, slice by date, then chart or export to CSV.
        </p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <PivotAnalytics />
      </div>
    </div>
  )
}
