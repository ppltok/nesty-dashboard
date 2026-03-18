import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface BarDef {
  key: string
  color: string
  label: string
}

interface BarChartComponentProps {
  data: { name: string; value: number; secondValue?: number }[]
  bars: BarDef[]
  height?: number
  layout?: 'horizontal' | 'vertical'
}

export function BarChartComponent({
  data,
  bars,
  height = 300,
  layout = 'horizontal',
}: BarChartComponentProps) {
  const isVertical = layout === 'vertical'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={isVertical ? 'vertical' : 'horizontal'}
        margin={{
          top: 4,
          right: 8,
          bottom: 0,
          left: isVertical ? 0 : -12,
        }}
      >
        {isVertical ? (
          <>
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
          </>
        )}
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            fontSize: 13,
          }}
          formatter={(value: number) => value.toLocaleString()}
        />
        {bars.length > 1 && (
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 13 }}
          />
        )}
        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.label}
            fill={bar.color}
            radius={isVertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            barSize={isVertical ? 24 : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
