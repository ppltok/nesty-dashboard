// Google-Ads-report-editor-style pivot builder.
// Layout: a large data table on the LEFT, and a config panel on the RIGHT with
// Row / Column / Values shelves plus a searchable, grouped "All columns" field
// list you drag from. Date range, sortable headers, Total row and pagination.

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  loadRawData,
  buildFlatRows,
  DIMENSIONS,
  MEASURES,
  distinctValues,
  dateBucket,
  DATE_KEY,
  type Grain,
  type DateGran,
} from './pivotData';
import {
  computePivot,
  formatValue,
  type FlatRow,
  type MeasureDef,
} from './pivotEngine';
import PivotChart, { type ChartSeries } from './PivotChart';

const CHART_CAP = 60; // max categories plotted (keeps the chart readable)

type ShelfId = 'rows' | 'cols' | 'values';
type SortState = { type: 'rowkey' | 'total' | 'col'; colIndex?: number; dir: 'asc' | 'desc' };

const PAGE_SIZES = [25, 50, 100];

export default function PivotAnalytics() {
  const [grain, setGrain] = useState<Grain>('items');
  const [itemRows, setItemRows] = useState<FlatRow[]>([]);
  const [userRows, setUserRows] = useState<FlatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const [rowFields, setRowFields] = useState<string[]>(['item_store']);
  const [colFields, setColFields] = useState<string[]>([]);
  const [filterFields, setFilterFields] = useState<string[]>([]);
  const [measureKey, setMeasureKey] = useState<string>('items');
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [dateGran, setDateGran] = useState<DateGran>('day');

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ type: 'total', dir: 'desc' });
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);

  const [view, setView] = useState<'table' | 'chart'>('table');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const [dragKind, setDragKind] = useState<'dim' | 'measure' | null>(null);
  const [dragOver, setDragOver] = useState<ShelfId | null>(null);

  const allRows = grain === 'items' ? itemRows : userRows;
  const rows = useMemo(
    () =>
      !dateFrom && !dateTo
        ? allRows
        : allRows.filter((r) => {
            const d = (r._date as string) || '';
            if (!d) return false;
            if (dateFrom && d < dateFrom) return false;
            if (dateTo && d > dateTo) return false;
            return true;
          }),
    [allRows, dateFrom, dateTo],
  );

  // When the Date dimension is on any shelf, derive its bucket per-row at the
  // chosen granularity (hour/day/month/year). Otherwise pass rows through.
  const usesDate = [...rowFields, ...colFields, ...filterFields].includes(DATE_KEY);
  const datedRows = useMemo(
    () =>
      usesDate ? rows.map((r) => ({ ...r, [DATE_KEY]: dateBucket(r._ts, dateGran) })) : rows,
    [rows, usesDate, dateGran],
  );

  const dims = DIMENSIONS[grain];
  const measures = MEASURES[grain];
  const measure: MeasureDef = useMemo(
    () => measures.find((m) => m.key === measureKey) || measures[0],
    [measures, measureKey],
  );
  const dimLabel = (key: string) => dims.find((d) => d.key === key)?.label || key;
  const measureLabel = (key: string) => measures.find((m) => m.key === key)?.label || key;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const raw = await loadRawData();
      const { itemRows: ir, userRows: ur } = buildFlatRows(raw);
      setItemRows(ir);
      setUserRows(ur);
      setLoadedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // Pick a sensible default sort whenever the primary row dimension changes:
  // chronological (ascending) when it's the Date dimension, otherwise by the
  // measure descending. Clicking a column header still overrides this.
  useEffect(() => {
    setSort(rowFields[0] === DATE_KEY ? { type: 'rowkey', dir: 'asc' } : { type: 'total', dir: 'desc' });
    setPage(0);
  }, [rowFields[0]]);

  function switchGrain(g: Grain) {
    if (g === grain) return;
    setGrain(g);
    setRowFields([g === 'items' ? 'item_store' : 'segment']);
    setColFields([]);
    setFilterFields([]);
    setMeasureKey(MEASURES[g][0].key);
    setFilters({});
    setOpenFilter(null);
    setSort({ type: 'total', dir: 'desc' });
    setPage(0);
  }

  // ── Shelf assignment ──
  function assignDim(shelf: 'rows' | 'cols', key: string) {
    if (shelf === 'rows') {
      setColFields((p) => p.filter((k) => k !== key));
      setRowFields((p) => (p.includes(key) ? p : [...p, key]));
    } else {
      setRowFields((p) => p.filter((k) => k !== key));
      setColFields((p) => (p.includes(key) ? p : [...p, key]));
    }
    setPage(0);
  }
  function removeDim(shelf: 'rows' | 'cols', key: string) {
    if (shelf === 'rows') setRowFields((p) => p.filter((k) => k !== key));
    else setColFields((p) => p.filter((k) => k !== key));
    setPage(0);
  }
  function addFilter(key: string) {
    setFilterFields((p) => (p.includes(key) ? p : [...p, key]));
  }
  function removeFilter(key: string) {
    setFilterFields((p) => p.filter((k) => k !== key));
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (openFilter === key) setOpenFilter(null);
  }
  function toggleFilterValue(field: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev };
      const set = new Set(next[field] || []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      if (set.size === 0) delete next[field];
      else next[field] = set;
      return next;
    });
    setPage(0);
  }

  // ── Drag ──
  function onDragStart(e: DragEvent, kind: 'dim' | 'measure', key: string) {
    e.dataTransfer.setData('text/plain', `${kind}:${key}`);
    e.dataTransfer.effectAllowed = 'copyMove';
    setDragKind(kind);
  }
  function onDrop(e: DragEvent, shelf: ShelfId) {
    e.preventDefault();
    const payload = e.dataTransfer.getData('text/plain');
    const [kind, key] = payload.split(':');
    if (!key) return;
    if (shelf === 'values') {
      if (kind === 'measure') setMeasureKey(key);
    } else if (kind === 'dim') {
      assignDim(shelf, key);
    }
    setDragKind(null);
    setDragOver(null);
  }
  // A shelf only accepts the matching kind.
  const accepts = (shelf: ShelfId) =>
    shelf === 'values' ? dragKind === 'measure' : dragKind === 'dim';

  const result = useMemo(
    () => computePivot(datedRows, { rowFields, colFields, measure, filters }),
    [datedRows, rowFields, colFields, measure, filters],
  );

  // ── Sorting → ordered row indices ──
  const order = useMemo(() => {
    const idx = result.rowKeys.map((_, i) => i);
    const dir = sort.dir === 'desc' ? -1 : 1;
    const cmpKey = (a: string[], b: string[]) => {
      for (let i = 0; i < a.length; i++) {
        if (a[i] === b[i]) continue;
        const an = Number(a[i]);
        const bn = Number(b[i]);
        if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
        return a[i] < b[i] ? -1 : 1;
      }
      return 0;
    };
    if (sort.type === 'rowkey') idx.sort((a, b) => dir * cmpKey(result.rowKeys[a], result.rowKeys[b]));
    else if (sort.type === 'total') idx.sort((a, b) => dir * (result.rowTotals[a] - result.rowTotals[b]));
    else if (sort.type === 'col' && sort.colIndex != null)
      idx.sort((a, b) => dir * (result.cells[a][sort.colIndex!] - result.cells[b][sort.colIndex!]));
    return idx;
  }, [result, sort]);

  const pageCount = Math.max(1, Math.ceil(order.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageIdx = order.slice(safePage * pageSize, safePage * pageSize + pageSize);

  // Chart data — top CHART_CAP rows by current sort. One series per column key
  // (when columns are present), otherwise a single series of row totals.
  const chartData = useMemo(() => {
    const idx = order.slice(0, CHART_CAP);
    const labels = idx.map((ri) => result.rowKeys[ri].join(' / '));
    const series: ChartSeries[] = result.hasColumns
      ? result.colKeys.map((ck, ci) => ({ name: ck.join(' / '), values: idx.map((ri) => result.cells[ri][ci]) }))
      : [{ name: measure.label, values: idx.map((ri) => result.rowTotals[ri]) }];
    return { labels, series, truncated: order.length > CHART_CAP };
  }, [order, result, measure]);

  function toggleSort(next: SortState) {
    setSort((prev) =>
      prev.type === next.type && prev.colIndex === next.colIndex
        ? { ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : next,
    );
  }
  const sortArrow = (active: boolean, dir: 'asc' | 'desc') => (active ? (dir === 'asc' ? ' ↑' : ' ↓') : '');

  // ── Date range presets ──
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  function setLastDays(n: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (n - 1));
    setDateFrom(iso(from));
    setDateTo(iso(to));
    setPage(0);
  }
  function shiftRange(dir: 1 | -1) {
    if (!dateFrom || !dateTo) return;
    const f = new Date(dateFrom);
    const t = new Date(dateTo);
    const len = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
    f.setDate(f.getDate() + dir * len);
    t.setDate(t.getDate() + dir * len);
    setDateFrom(iso(f));
    setDateTo(iso(t));
    setPage(0);
  }

  // ── CSV export (full, not just current page) ──
  function exportCsv() {
    const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"';
    const header = [...rowFields.map(dimLabel)];
    if (result.hasColumns) {
      for (const ck of result.colKeys) header.push(ck.join(' / '));
      header.push('Total');
    } else header.push(measure.label);
    const lines = [header.map(esc).join(',')];
    order.forEach((ri) => {
      const cells = result.hasColumns
        ? [...result.cells[ri].map(String), String(result.rowTotals[ri])]
        : [String(result.rowTotals[ri])];
      lines.push([...result.rowKeys[ri], ...cells].map(esc).join(','));
    });
    const totalCells = result.hasColumns
      ? [...result.colTotals.map(String), String(result.grandTotal)]
      : [String(result.grandTotal)];
    lines.push([...rowFields.map((_, i) => (i === 0 ? 'Total' : '')), ...totalCells].map(esc).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nesty-pivot-${grain}-${measure.key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const usedDims = new Set([...rowFields, ...colFields, ...filterFields]);
  const fieldMatches = (label: string) => label.toLowerCase().includes(search.toLowerCase());

  // ── Render helpers ──
  const ShelfPill = ({ shelf, k }: { shelf: 'rows' | 'cols'; k: string }) => (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#f0ebf4] text-[#86608e] border border-[#d9c9e2]">
      <span className="text-gray-300">⠿</span>
      {dimLabel(k)}
      {k === DATE_KEY && (
        <select
          value={dateGran}
          onChange={(e) => {
            setDateGran(e.target.value as DateGran);
            setPage(0);
          }}
          className="ml-1 bg-white border border-[#d9c9e2] rounded px-1 py-0.5 text-[11px] text-[#86608e]"
          title="Time grouping"
        >
          <option value="hour">by hour</option>
          <option value="day">by day</option>
          <option value="month">by month</option>
          <option value="year">by year</option>
        </select>
      )}
      <button className="opacity-60 hover:opacity-100" onClick={() => removeDim(shelf, k)}>
        ✕
      </button>
    </span>
  );

  const Shelf = ({ id, label, children }: { id: ShelfId; label: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div
        onDragOver={(e) => {
          if (accepts(id)) {
            e.preventDefault();
            setDragOver(id);
          }
        }}
        onDragLeave={() => setDragOver((d) => (d === id ? null : d))}
        onDrop={(e) => onDrop(e, id)}
        className={`min-h-[42px] rounded-lg border px-2 py-2 flex flex-wrap gap-1.5 items-center transition ${
          dragOver === id ? 'border-[#86608e] bg-[#f0ebf4]' : 'border-[#e2d8ea] bg-[#fcfaff]'
        }`}
      >
        {children}
      </div>
    </div>
  );

  return (
    <div dir="ltr" className="text-left flex gap-4" style={{ minHeight: 600 }}>
      {/* ════════ LEFT: table ════════ */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar: date range */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {/* Table / Chart view toggle */}
          <div className="inline-flex rounded-lg overflow-hidden border border-[#e2d8ea]">
            {(['table', 'chart'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 text-xs ${view === v ? 'bg-[#86608e] text-white' : 'bg-white text-[#86608e]'}`}
              >
                {v === 'table' ? '▦ Table' : '📈 Chart'}
              </button>
            ))}
          </div>
          {view === 'chart' && (
            <div className="inline-flex rounded-lg overflow-hidden border border-[#e2d8ea]">
              {(['bar', 'line'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`px-2.5 py-1 text-xs ${chartType === t ? 'bg-[#f0ebf4] text-[#86608e] font-semibold' : 'bg-white text-gray-500'}`}
                >
                  {t === 'bar' ? 'Bars' : 'Line'}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[11px] text-gray-400 leading-none mb-1">
              {dateFrom || dateTo ? 'Custom' : 'All time'} · filters {grain === 'items' ? 'item added' : 'signup'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => shiftRange(-1)}
                disabled={!dateFrom || !dateTo}
                className="px-1.5 py-1 rounded text-[#86608e] hover:bg-[#f0ebf4] disabled:opacity-30"
                title="Previous period"
              >
                ‹
              </button>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
                className="border border-[#d9c9e2] rounded-lg px-2 py-1 text-xs text-[#86608e]"
              />
              <span className="text-gray-400 text-xs">–</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
                className="border border-[#d9c9e2] rounded-lg px-2 py-1 text-xs text-[#86608e]"
              />
              <button
                onClick={() => shiftRange(1)}
                disabled={!dateFrom || !dateTo}
                className="px-1.5 py-1 rounded text-[#86608e] hover:bg-[#f0ebf4] disabled:opacity-30"
                title="Next period"
              >
                ›
              </button>
            </div>
          </div>
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              onClick={() => setLastDays(n)}
              className="px-2 py-1 rounded-lg text-xs bg-[#f0ebf4] text-[#86608e] hover:bg-[#e2d8ea]"
            >
              Last {n}d
            </button>
          ))}
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="px-2 py-1 rounded-lg text-xs text-gray-500 hover:text-[#86608e]"
            >
              clear
            </button>
          )}
          <div className="ms-auto text-xs text-gray-400">
            {loadedAt && (
              <>
                {rows.length.toLocaleString()}
                {(dateFrom || dateTo) && ` / ${allRows.length.toLocaleString()}`} rows
              </>
            )}
          </div>
        </div>

        {error && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">Error loading data: {error}</div>}

        {/* Table */}
        <div className="flex-1 overflow-auto rounded-xl border border-[#e2d8ea] bg-white">
          {loading ? (
            <div className="text-gray-400 text-sm py-16 text-center">Loading data…</div>
          ) : rowFields.length === 0 ? (
            <div className="text-gray-400 text-sm py-16 text-center">Drag a field into the Row shelf →</div>
          ) : view === 'chart' ? (
            <div className="p-4">
              <PivotChart
                labels={chartData.labels}
                series={chartData.series}
                type={chartType}
                format={measure.format}
              />
              {chartData.truncated && (
                <div className="text-xs text-gray-400 mt-2">
                  Showing top {chartData.labels.length} of {order.length.toLocaleString()} rows (by current sort). Narrow
                  the date range or add a filter to chart fewer.
                </div>
              )}
            </div>
          ) : (
            <table className="text-sm border-collapse w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-white border-b-2 border-[#e2d8ea] text-gray-700">
                  {rowFields.map((f, i) => (
                    <th
                      key={f}
                      onClick={() => i === 0 && toggleSort({ type: 'rowkey', dir: 'asc' })}
                      className={`px-3 py-2.5 text-left whitespace-nowrap font-semibold ${
                        i === 0 ? 'cursor-pointer select-none' : ''
                      }`}
                    >
                      {dimLabel(f)}
                      {i === 0 && sortArrow(sort.type === 'rowkey', sort.dir)}
                    </th>
                  ))}
                  {result.hasColumns ? (
                    <>
                      {result.colKeys.map((ck, ci) => (
                        <th
                          key={ci}
                          onClick={() => toggleSort({ type: 'col', colIndex: ci, dir: 'desc' })}
                          className="px-3 py-2.5 text-right whitespace-nowrap font-semibold cursor-pointer select-none"
                        >
                          {ck.join(' / ')}
                          {sortArrow(sort.type === 'col' && sort.colIndex === ci, sort.dir)}
                        </th>
                      ))}
                      <th
                        onClick={() => toggleSort({ type: 'total', dir: 'desc' })}
                        className="px-3 py-2.5 text-right whitespace-nowrap font-bold border-l border-[#e2d8ea] cursor-pointer select-none"
                      >
                        Total{sortArrow(sort.type === 'total', sort.dir)}
                      </th>
                    </>
                  ) : (
                    <th
                      onClick={() => toggleSort({ type: 'total', dir: 'desc' })}
                      className="px-3 py-2.5 text-right whitespace-nowrap font-semibold cursor-pointer select-none"
                    >
                      {measure.label}
                      {sortArrow(sort.type === 'total', sort.dir)}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pageIdx.map((ri) => (
                  <tr key={ri} className="border-b border-[#f3eef7] hover:bg-[#faf7fc]">
                    {result.rowKeys[ri].map((val, ci) => (
                      <td key={ci} className="px-3 py-2 whitespace-nowrap">
                        {val}
                      </td>
                    ))}
                    {result.hasColumns ? (
                      <>
                        {result.cells[ri].map((v, ci) => (
                          <td key={ci} className="px-3 py-2 text-right tabular-nums">
                            {v === 0 ? <span className="text-gray-300">·</span> : formatValue(v, measure.format)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right tabular-nums font-bold border-l border-[#e2d8ea]">
                          {formatValue(result.rowTotals[ri], measure.format)}
                        </td>
                      </>
                    ) : (
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatValue(result.rowTotals[ri], measure.format)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f8f5fb] border-t-2 border-[#e2d8ea] font-bold text-gray-700 sticky bottom-0">
                  <td className="px-3 py-2.5" colSpan={rowFields.length}>
                    Total
                  </td>
                  {result.hasColumns ? (
                    <>
                      {result.colTotals.map((v, ci) => (
                        <td key={ci} className="px-3 py-2.5 text-right tabular-nums">
                          {formatValue(v, measure.format)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right tabular-nums border-l border-[#e2d8ea]">
                        {formatValue(result.grandTotal, measure.format)}
                      </td>
                    </>
                  ) : (
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatValue(result.grandTotal, measure.format)}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && rowFields.length > 0 && view === 'table' && (
          <div className="flex items-center justify-end gap-4 mt-2 text-xs text-gray-500">
            <span>
              Rows per page:{' '}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="border border-[#e2d8ea] rounded px-1.5 py-0.5 text-[#86608e]"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </span>
            <span>
              {order.length === 0 ? 0 : safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, order.length)} of{' '}
              {order.length.toLocaleString()}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(0)} disabled={safePage === 0} className="px-1.5 py-0.5 rounded hover:bg-[#f0ebf4] disabled:opacity-30">
                «
              </button>
              <button onClick={() => setPage(safePage - 1)} disabled={safePage === 0} className="px-1.5 py-0.5 rounded hover:bg-[#f0ebf4] disabled:opacity-30">
                ‹
              </button>
              <button onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount - 1} className="px-1.5 py-0.5 rounded hover:bg-[#f0ebf4] disabled:opacity-30">
                ›
              </button>
              <button onClick={() => setPage(pageCount - 1)} disabled={safePage >= pageCount - 1} className="px-1.5 py-0.5 rounded hover:bg-[#f0ebf4] disabled:opacity-30">
                »
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ════════ RIGHT: config ════════ */}
      <aside className="w-[480px] shrink-0 border-l border-[#e2d8ea] ps-4 flex gap-4">
        {/* Shelves */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex rounded-lg overflow-hidden border border-[#e2d8ea]">
              {(['items', 'users'] as Grain[]).map((g) => (
                <button
                  key={g}
                  onClick={() => switchGrain(g)}
                  className={`px-3 py-1.5 text-sm ${grain === g ? 'bg-[#86608e] text-white' : 'bg-white text-[#86608e]'}`}
                >
                  {g === 'items' ? 'Items' : 'Users'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={load} disabled={loading} className="text-xs text-[#86608e] hover:underline disabled:opacity-50">
                {loading ? '…' : 'Refresh'}
              </button>
              <button onClick={exportCsv} disabled={loading} className="text-xs text-[#86608e] hover:underline disabled:opacity-50">
                Download
              </button>
            </div>
          </div>

          <Shelf id="rows" label="Row">
            {rowFields.length === 0 ? (
              <span className="text-xs text-gray-300">drag a dimension here</span>
            ) : (
              rowFields.map((k) => <ShelfPill key={k} shelf="rows" k={k} />)
            )}
          </Shelf>

          <Shelf id="cols" label="Column">
            {colFields.length === 0 ? (
              <span className="text-xs text-gray-300">drag a dimension here</span>
            ) : (
              colFields.map((k) => <ShelfPill key={k} shelf="cols" k={k} />)
            )}
          </Shelf>

          <Shelf id="values" label="Values (metric)">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#86608e] text-white">
              {measureLabel(measureKey)}
            </span>
          </Shelf>

          {/* Filters */}
          <div className="mt-2">
            <div className="text-xs text-gray-500 mb-1">Filters</div>
            <div className="flex flex-wrap gap-1.5">
              {filterFields.length === 0 && <span className="text-xs text-gray-300">drag a dimension to "Filters" below or click ⓕ</span>}
              {filterFields.map((k) => {
                const active = (filters[k]?.size ?? 0) > 0;
                return (
                  <div key={k} className="relative inline-block">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border ${
                        active ? 'bg-[#86608e] text-white border-[#86608e]' : 'bg-[#f0ebf4] text-[#86608e] border-[#d9c9e2]'
                      }`}
                    >
                      <button onClick={() => setOpenFilter(openFilter === k ? null : k)}>
                        {dimLabel(k)}
                        {active ? ` (${filters[k].size})` : ''} ▾
                      </button>
                      <button className="opacity-60 hover:opacity-100" onClick={() => removeFilter(k)}>
                        ✕
                      </button>
                    </span>
                    {openFilter === k && (
                      <div className="absolute z-20 mt-1 right-0 w-56 max-h-64 overflow-auto bg-white border border-[#e2d8ea] rounded-xl shadow-lg p-2">
                        {distinctValues(datedRows, k).map((v) => (
                          <label key={v} className="flex items-center gap-2 py-0.5 text-sm cursor-pointer hover:bg-[#f8f5fb] rounded px-1">
                            <input type="checkbox" checked={filters[k]?.has(v) ?? false} onChange={() => toggleFilterValue(k, v)} />
                            <span className="truncate">{v}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* All columns (field list) */}
        <div className="w-44 shrink-0 border-l border-[#e2d8ea] ps-3 flex flex-col">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full border border-[#e2d8ea] rounded-lg px-2 py-1 text-xs mb-2"
          />
          <div className="text-xs font-bold text-gray-500 mb-1">All columns</div>
          <div className="flex-1 overflow-auto pr-1">
            <div className="text-[11px] font-semibold text-gray-400 mt-1 mb-1">Dimensions</div>
            {dims.filter((d) => fieldMatches(d.label)).map((d) => (
              <div
                key={d.key}
                draggable
                onDragStart={(e) => onDragStart(e, 'dim', d.key)}
                onDragEnd={() => {
                  setDragKind(null);
                  setDragOver(null);
                }}
                onDoubleClick={() => assignDim('rows', d.key)}
                className={`group flex items-center gap-1.5 px-1.5 py-1 rounded text-[13px] cursor-grab active:cursor-grabbing ${
                  usedDims.has(d.key) ? 'text-[#86608e]' : 'text-gray-700 hover:bg-[#f8f5fb]'
                }`}
                title="Drag to Row/Column (double-click → Row)"
              >
                <span className="text-gray-300">⠿</span>
                <span className="truncate flex-1">{d.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addFilter(d.key);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#86608e]"
                  title="Add as filter"
                >
                  ⓕ
                </button>
              </div>
            ))}
            <div className="text-[11px] font-semibold text-gray-400 mt-3 mb-1">Metrics</div>
            {measures.filter((m) => fieldMatches(m.label)).map((m) => (
              <div
                key={m.key}
                draggable
                onDragStart={(e) => onDragStart(e, 'measure', m.key)}
                onDragEnd={() => {
                  setDragKind(null);
                  setDragOver(null);
                }}
                onDoubleClick={() => setMeasureKey(m.key)}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[13px] cursor-grab active:cursor-grabbing ${
                  measureKey === m.key ? 'text-[#86608e] font-semibold' : 'text-gray-700 hover:bg-[#f8f5fb]'
                }`}
                title="Drag to Values (double-click to set)"
              >
                <span className="text-gray-300">⠿</span>
                <span className="truncate">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
