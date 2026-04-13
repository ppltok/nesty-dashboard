import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface BarDef {
  key: string
  color: string
  label: string
  stackId?: string
}

interface BarChartComponentProps {
  data: Record<string, any>[]
  bars: BarDef[]
  height?: number
  layout?: 'horizontal' | 'vertical'
  xKey?: string
  xAxisLabel?: string
  yAxisLabel?: string
  /** Angle X-axis tick labels (degrees). Use -45 for long labels. Default 0. */
  xTickAngle?: number
  /** Custom tick formatter for X-axis */
  xTickFormatter?: (value: string) => string
}

export function BarChartComponent({
  data,
  bars,
  height = 300,
  layout = 'horizontal',
  xKey = 'name',
  xAxisLabel,
  yAxisLabel,
  xTickAngle = 0,
  xTickFormatter,
}: BarChartComponentProps) {
  const isVertical = layout === 'vertical'
  const needsAngle = xTickAngle !== 0

  // Build custom tick renderer for angled labels
  const angledTick = needsAngle
    ? (props: any) => {
        const { x, y, payload } = props
        const formatted = xTickFormatter ? xTickFormatter(payload.value) : payload.value
        return (
          <g transform={`translate(${x},${y})`}>
            <text
              x={0} y={0} dy={10}
              textAnchor="end"
              fill="#6b7280"
              fontSize={11}
              transform={`rotate(${xTickAngle})`}
            >
              {formatted}
            </text>
          </g>
        )
      }
    : undefined

  return (
    <div className="relative">
      {/* Y-axis label — rendered as HTML, positioned to the left */}
      {yAxisLabel && !isVertical && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateX(4px)' }}
        >
          <span className="text-xs font-semibold text-gray-500 tracking-wide">{yAxisLabel}</span>
        </div>
      )}

      <div className={yAxisLabel && !isVertical ? 'ml-5' : ''}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout={isVertical ? 'vertical' : 'horizontal'}
            margin={{ top: 4, right: 8, bottom: 8, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={true} vertical={false} />
            <XAxis
              {...(isVertical
                ? {
                    type: 'number' as const,
                    tick: { fontSize: 12, fill: '#9ca3af' },
                    axisLine: { stroke: '#e5e7eb' },
                    tickLine: false,
                  }
                : {
                    dataKey: xKey,
                    tick: angledTick || { fontSize: 11, fill: '#6b7280' },
                    axisLine: { stroke: '#e5e7eb' },
                    tickLine: false,
                    interval: 0 as const,
                    height: needsAngle ? 120 : 30,
                    tickFormatter: needsAngle ? undefined : xTickFormatter,
                  }
              )}
            />
            <YAxis
              {...(isVertical
                ? {
                    type: 'category' as const,
                    dataKey: 'name',
                    width: 100,
                    tick: { fontSize: 12, fill: '#6b7280' },
                    axisLine: false,
                    tickLine: false,
                  }
                : {
                    tick: { fontSize: 12, fill: '#9ca3af' },
                    axisLine: false,
                    tickLine: false,
                  }
              )}
            />
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
                stackId={bar.stackId}
                radius={bar.stackId ? undefined : (isVertical ? [0, 6, 6, 0] : [6, 6, 0, 0])}
                barSize={isVertical ? 24 : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>

        {/* X-axis label — rendered as HTML below the chart */}
        {xAxisLabel && (
          <div className="text-center -mt-1 mb-1">
            <span className="text-xs font-semibold text-gray-500 tracking-wide">{xAxisLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}
