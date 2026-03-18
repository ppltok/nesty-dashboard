import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'

interface TrendLine {
  key: string
  color: string
  label: string
}

interface TrendChartProps {
  data: Record<string, string | number>[]
  lines: TrendLine[]
  xKey?: string
  height?: number
}

export function TrendChart({ data, lines, xKey = 'day', height = 300 }: TrendChartProps) {
  // Show labels only when data points are sparse enough to avoid overlap
  const showLabels = data.length <= 30

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 0, left: -12 }}>
        <XAxis
          dataKey={xKey}
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
        />
        <Legend
          verticalAlign="top"
          height={36}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 13 }}
        />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={line.color}
            strokeWidth={2}
            dot={{ r: 3, fill: line.color, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          >
            {showLabels && (
              <LabelList
                dataKey={line.key}
                position="top"
                style={{ fontSize: 10, fill: '#6b7280', fontWeight: 500 }}
                offset={8}
              />
            )}
          </Line>
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
