import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'

interface FunnelStage {
  stage: string
  count: number
}

interface FunnelChartProps {
  data: FunnelStage[]
}

const STAGE_LABELS: Record<string, string> = {
  signups: 'Signed Up',
  onboarded: 'Onboarded',
  first_item: 'First Item',
  five_items: '5+ Items',
  shared: 'Shared',
  viewed: 'Viewed',
  gifted: 'Gifted',
}

const BLUE_SHADES = [
  '#1e40af',
  '#1d4ed8',
  '#2563eb',
  '#3b82f6',
  '#60a5fa',
  '#93bbfd',
  '#bfdbfe',
]

export function FunnelChart({ data }: FunnelChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    displayLabel: STAGE_LABELS[d.stage] ?? d.stage,
  }))

  return (
    <ResponsiveContainer width="100%" height={data.length * 52 + 20}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="displayLabel"
          width={100}
          tick={{ fontSize: 13, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => [value.toLocaleString(), 'Count']}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={32}>
          {chartData.map((_, index) => (
            <Cell
              key={index}
              fill={BLUE_SHADES[index % BLUE_SHADES.length]}
            />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            style={{ fontSize: 13, fontWeight: 600, fill: '#374151' }}
            formatter={(v: number) => v.toLocaleString()}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
