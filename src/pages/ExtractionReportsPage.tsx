import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { KPICard } from '@/components/shared/KPICard'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatNumber } from '@/lib/formatters'
import { downloadCSV } from '@/lib/csv'
import {
  Bug, Globe, AlertTriangle, CheckCircle, Clock, Download,
  ArrowUpDown, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'

const ERROR_TYPE_LABELS: Record<string, string> = {
  no_product_data: 'No Product Data',
  no_image: 'No Image',
  broken_image: 'Broken Image',
  manual_report: 'Manual Report',
  non_product_page: 'Non-Product Page',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  fixed: 'Fixed',
  wont_fix: "Won't Fix",
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  new: { bg: 'bg-amber-100', text: 'text-amber-700' },
  reviewed: { bg: 'bg-blue-100', text: 'text-blue-700' },
  fixed: { bg: 'bg-green-100', text: 'text-green-700' },
  wont_fix: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

interface ExtractionReport {
  id: string
  url: string
  hostname: string
  error_type: string
  status: string
  notes: string | null
  created_at: string
}

type SortField = 'created_at' | 'hostname' | 'error_type' | 'status'

function useExtractionReports() {
  return useQuery<ExtractionReport[]>({
    queryKey: ['extraction-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extraction_reports')
        .select('id, url, hostname, error_type, status, notes, created_at')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data || []
    },
  })
}

export default function ExtractionReportsPage() {
  const reports = useExtractionReports()

  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const data = reports.data ?? []

  // KPI metrics
  const totalReports = data.length
  const newReports = data.filter(r => r.status === 'new').length
  const uniqueDomains = new Set(data.map(r => r.hostname)).size
  const topDomain = useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(r => { counts[r.hostname] = (counts[r.hostname] || 0) + 1 })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return sorted[0] ? `${sorted[0][0]} (${sorted[0][1]})` : '-'
  }, [data])

  // Charts
  const byType = useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(r => { counts[r.error_type] = (counts[r.error_type] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({
      name: ERROR_TYPE_LABELS[name] || name,
      value,
    }))
  }, [data])

  const byDomain = useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(r => { counts[r.hostname] = (counts[r.hostname] || 0) + 1 })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }))
  }, [data])

  // Sorting & filtering
  const sortedRows = useMemo(() => {
    let filtered = data
    if (filterType !== 'all') filtered = filtered.filter(r => r.error_type === filterType)
    if (filterStatus !== 'all') filtered = filtered.filter(r => r.status === filterStatus)

    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [data, sortField, sortAsc, filterType, filterStatus])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(false) }
  }

  if (reports.isLoading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Extraction Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Bug reports from failed product extractions — grouped by domain</p>
        </div>
        <button
          onClick={() => downloadCSV(sortedRows as unknown as Record<string, unknown>[], 'extraction-reports')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Reports" value={formatNumber(totalReports)} icon={<Bug size={20} />} />
        <KPICard title="New (Unreviewed)" value={formatNumber(newReports)} icon={<AlertTriangle size={20} />} />
        <KPICard title="Unique Domains" value={formatNumber(uniqueDomains)} icon={<Globe size={20} />} />
        <KPICard title="Top Domain" value={topDomain} icon={<ExternalLink size={20} />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">By Error Type</h3>
          <DonutChart data={byType} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Failing Domains</h3>
          <DonutChart data={byDomain} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All Types</option>
          {Object.entries(ERROR_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {[
                  { field: 'created_at' as SortField, label: 'Date' },
                  { field: 'hostname' as SortField, label: 'Domain' },
                  { field: 'error_type' as SortField, label: 'Error Type' },
                  { field: 'status' as SortField, label: 'Status' },
                ].map(col => (
                  <th
                    key={col.field}
                    onClick={() => toggleSort(col.field)}
                    className="px-4 py-3 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown size={14} className="text-gray-300" />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium text-gray-500">URL</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.slice(0, 100).map(row => {
                const badge = STATUS_BADGE[row.status] || STATUS_BADGE.new
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleDateString('en-IL')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.hostname}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {ERROR_TYPE_LABELS[row.error_type] || row.error_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs truncate block max-w-[300px]"
                      >
                        {row.url}
                      </a>
                    </td>
                  </tr>
                )
              })}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No extraction reports yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
