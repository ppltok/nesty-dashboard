// Dependency-free SVG chart for the pivot view. Renders bar or line charts
// from the same pivot result the table uses — one series when there are no
// column dimensions, one series per column key otherwise.

import { formatValue, type MeasureDef } from './pivotEngine';

export interface ChartSeries {
  name: string;
  values: number[];
}

interface Props {
  labels: string[]; // x-axis category per data point (row keys)
  series: ChartSeries[];
  type: 'bar' | 'line';
  format: MeasureDef['format'];
}

// Brand-leaning palette for multi-series.
const COLORS = ['#86608e', '#c79fd1', '#5b9aa0', '#d98c5f', '#7b8cde', '#cf6f9b', '#6fb07a', '#b0904a'];

const H = 360; // plot height (px, in viewBox units)
const PAD_L = 64; // left padding for y labels
const PAD_B = 90; // bottom padding for rotated x labels
const PAD_T = 16;
const PAD_R = 16;

// Pick ~5 "nice" y-axis tick values from 0..max.
function ticks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export default function PivotChart({ labels, series, type, format }: Props) {
  const n = labels.length;
  if (n === 0 || series.length === 0) {
    return <div className="text-gray-400 text-sm py-16 text-center">No data to chart.</div>;
  }

  const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
  const yTicks = ticks(maxVal);
  const yMax = yTicks[yTicks.length - 1] || 1;

  // Give each point ~44px so dense category sets scroll horizontally.
  const plotW = Math.max(n * 44, 320);
  const W = PAD_L + plotW + PAD_R;
  const x = (i: number) => PAD_L + (plotW * (i + 0.5)) / n; // category center
  const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / yMax);
  const baseY = y(0);

  const bandW = plotW / n;
  const groupW = bandW * 0.7;
  const barW = groupW / series.length;

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block" style={{ minWidth: '100%' }}>
        {/* y grid + labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="#eee5f1" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#9ca3af">
              {formatValue(t, format)}
            </text>
          </g>
        ))}

        {/* bars */}
        {type === 'bar' &&
          series.map((s, si) =>
            s.values.map((v, i) => {
              const bx = x(i) - groupW / 2 + si * barW;
              const top = y(v);
              return (
                <rect
                  key={`${si}-${i}`}
                  x={bx}
                  y={top}
                  width={Math.max(1, barW - 2)}
                  height={Math.max(0, baseY - top)}
                  fill={COLORS[si % COLORS.length]}
                  rx={2}
                >
                  <title>{`${labels[i]} · ${s.name}: ${formatValue(v, format)}`}</title>
                </rect>
              );
            }),
          )}

        {/* lines + dots */}
        {type === 'line' &&
          series.map((s, si) => {
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
            return (
              <g key={si}>
                <polyline points={pts} fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2} />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={COLORS[si % COLORS.length]}>
                    <title>{`${labels[i]} · ${s.name}: ${formatValue(v, format)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

        {/* x labels (rotated) */}
        {labels.map((lab, i) => (
          <text
            key={i}
            x={x(i)}
            y={baseY + 12}
            fontSize={10}
            fill="#6b7280"
            textAnchor="end"
            transform={`rotate(-45 ${x(i)} ${baseY + 12})`}
          >
            {lab.length > 18 ? lab.slice(0, 17) + '…' : lab}
          </text>
        ))}

        {/* x axis */}
        <line x1={PAD_L} x2={W - PAD_R} y1={baseY} y2={baseY} stroke="#d9c9e2" strokeWidth={1} />
      </svg>

      {/* legend (only meaningful with multiple series) */}
      {series.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-2 px-2">
          {series.map((s, si) => (
            <span key={si} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS[si % COLORS.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
