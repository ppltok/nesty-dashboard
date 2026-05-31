// Live data loader + flat-row builders for the admin pivot analytics tab.
// Pulls profiles / registries / items from Supabase (anon key, paginated —
// same approach proven by analysis/run.js) and denormalises them into two
// flat datasets: one row per item (enriched with registry + owner attributes)
// and one row per user.

import { supabase } from '../../lib/supabase';
import type { FlatRow, DimensionDef, MeasureDef } from './pivotEngine';

export interface RawData {
  profiles: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  registries: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  items: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const PAGE = 1000;

async function fetchAll(table: string, columns: string): Promise<any[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const all: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  let from = 0;
  // Loop pages until a short page is returned.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message || JSON.stringify(error)}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function loadRawData(): Promise<RawData> {
  // Select '*' so the pivot never breaks if a column is renamed/absent —
  // buildFlatRows reads whatever fields exist and maps the rest to '(none)'.
  const [profiles, registries, items] = await Promise.all([
    fetchAll('profiles', '*'),
    fetchAll('registries', '*'),
    fetchAll('items', '*'),
  ]);
  return { profiles, registries, items };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const monthOf = (ts: string | null): string => (ts ? ts.slice(0, 7) : '(none)');

const dayOf = (ts: string | null): string => (ts ? ts.slice(0, 10) : '(none)');

// ISO day string ('YYYY-MM-DD') used by the date-range filter. '' when missing.
const isoDay = (ts: unknown): string => (ts ? String(ts).slice(0, 10) : '');

const yesNo = (v: unknown): string => (v === true ? 'Yes' : v === false ? 'No' : '(none)');

const priceBucket = (p: number | null): string => {
  if (p === null || p === undefined || !Number.isFinite(Number(p))) return '(none)';
  const n = Number(p);
  if (n < 50) return '₪0–50';
  if (n < 100) return '₪50–100';
  if (n < 200) return '₪100–200';
  if (n < 500) return '₪200–500';
  return '₪500+';
};

const itemCountBucket = (n: number): string => {
  if (n === 0) return '0 (nonactive)';
  if (n < 5) return '1–4 (newbie)';
  if (n < 10) return '5–9';
  return '10+';
};

const segment = (n: number): string => (n === 0 ? 'Nonactive' : n < 5 ? 'Newbie' : 'Pro');

const clean = (s: unknown): string => {
  const v = (s ?? '').toString().trim();
  return v === '' ? '(none)' : v;
};

// ── Builders ───────────────────────────────────────────────────────────────

interface Built {
  itemRows: FlatRow[];
  userRows: FlatRow[];
}

export function buildFlatRows(raw: RawData): Built {
  const { profiles, registries, items } = raw;

  const profileById = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const p of profiles) profileById.set(p.id, p);

  const regById = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const r of registries) regById.set(r.id, r);

  // Per-owner aggregates
  const itemsByOwner = new Map<string, number>();
  const regsByOwner = new Map<string, number>();
  const hasPartner = new Map<string, boolean>();
  for (const r of registries) {
    if (r.owner_id) {
      regsByOwner.set(r.owner_id, (regsByOwner.get(r.owner_id) || 0) + 1);
      if (r.partner_id) hasPartner.set(r.owner_id, true);
    }
  }
  for (const it of items) {
    const reg = regById.get(it.registry_id);
    if (reg?.owner_id) itemsByOwner.set(reg.owner_id, (itemsByOwner.get(reg.owner_id) || 0) + 1);
  }

  // ── Items grain ──
  const itemRows: FlatRow[] = [];
  for (const it of items) {
    const reg = regById.get(it.registry_id);
    const owner = reg ? profileById.get(reg.owner_id) : null;
    itemRows.push({
      // ids for distinct measures
      item_id: it.id,
      registry_id: it.registry_id ?? '(none)',
      owner_id: reg?.owner_id ?? '(none)',
      // raw date for the range filter (item creation)
      _date: isoDay(it.created_at),
      // full timestamp for the draggable Date dimension (any granularity)
      _ts: it.created_at ?? '',
      // numeric measure sources
      price: it.price === null || it.price === undefined ? null : Number(it.price),
      // item dimensions
      item_store: clean(it.store_name),
      item_category: clean(it.category),
      item_most_wanted: yesNo(it.is_most_wanted),
      item_added_via: clean(it.added_via),
      item_day: dayOf(it.created_at),
      item_currency: clean(it.source_currency),
      item_received: Number(it.quantity_received) > 0 ? 'Yes' : 'No',
      item_chip_in: yesNo(it.enable_chip_in),
      item_month: monthOf(it.created_at),
      item_price_bucket: priceBucket(it.price),
      // registry dimensions
      registry_is_public: yesNo(reg?.is_public),
      registry_has_partner: owner ? yesNo(!!hasPartner.get(owner.id)) : '(none)',
      // owner dimensions
      owner_utm_source: clean(owner?.utm_source),
      owner_utm_medium: clean(owner?.utm_medium),
      owner_utm_campaign: clean(owner?.utm_campaign),
      owner_referral_source: clean(owner?.referral_source),
      owner_feeling: clean(owner?.feeling),
      owner_first_time_parent: yesNo(owner?.is_first_time_parent),
      owner_onboarding_completed: yesNo(owner?.onboarding_completed),
      owner_signup_month: monthOf(owner?.created_at ?? null),
    });
  }

  // ── Users grain ──
  const userRows: FlatRow[] = [];
  for (const p of profiles) {
    const ic = itemsByOwner.get(p.id) || 0;
    userRows.push({
      user_id: p.id,
      _date: isoDay(p.created_at),
      _ts: p.created_at ?? '',
      item_count: ic,
      registry_count: regsByOwner.get(p.id) || 0,
      utm_source: clean(p.utm_source),
      utm_medium: clean(p.utm_medium),
      utm_campaign: clean(p.utm_campaign),
      referral_source: clean(p.referral_source),
      feeling: clean(p.feeling),
      first_time_parent: yesNo(p.is_first_time_parent),
      onboarding_completed: yesNo(p.onboarding_completed),
      marketing_emails: yesNo(p.marketing_emails),
      price_alerts_email: yesNo(p.email_price_alerts),
      has_partner: yesNo(!!hasPartner.get(p.id)),
      signup_day: dayOf(p.created_at),
      signup_month: monthOf(p.created_at),
      segment: segment(ic),
      item_count_bucket: itemCountBucket(ic),
    });
  }

  return { itemRows, userRows };
}

// ── Metadata: dimensions & measures per grain ──────────────────────────────

export type Grain = 'items' | 'users';

// The single draggable "Date" dimension. Its bucket is derived at render time
// from the row's full timestamp (`_ts`) at the chosen granularity.
export const DATE_KEY = '__date';
export type DateGran = 'hour' | 'day' | 'month' | 'year';

// Bucket a timestamp at the requested granularity. Uses the timestamp's own
// (UTC) text — fast and deterministic; no timezone math.
export function dateBucket(ts: unknown, gran: DateGran): string {
  const s = (ts ?? '').toString();
  if (!s) return '(none)';
  if (gran === 'year') return s.slice(0, 4);
  if (gran === 'month') return s.slice(0, 7);
  if (gran === 'day') return s.slice(0, 10);
  return `${s.slice(0, 10)} ${s.slice(11, 13)}:00`; // hour
}

export const DIMENSIONS: Record<Grain, DimensionDef[]> = {
  items: [
    { key: '__date', label: 'Date' },
    { key: 'item_store', label: 'Store' },
    { key: 'item_category', label: 'Category' },
    { key: 'item_price_bucket', label: 'Price range' },
    { key: 'item_most_wanted', label: 'Most wanted?' },
    { key: 'item_added_via', label: 'Added via' },
    { key: 'item_received', label: 'Received?' },
    { key: 'item_chip_in', label: 'Chip-in enabled?' },
    { key: 'item_currency', label: 'Currency' },
    { key: 'registry_is_public', label: 'Registry public?' },
    { key: 'registry_has_partner', label: 'Owner has partner?' },
    { key: 'owner_signup_month', label: 'Owner signup month' },
    { key: 'owner_utm_source', label: 'Owner UTM source' },
    { key: 'owner_utm_medium', label: 'Owner UTM medium' },
    { key: 'owner_utm_campaign', label: 'Owner UTM campaign' },
    { key: 'owner_referral_source', label: 'Owner referral source' },
    { key: 'owner_feeling', label: 'Owner feeling' },
    { key: 'owner_first_time_parent', label: 'Owner first-time parent?' },
    { key: 'owner_onboarding_completed', label: 'Owner onboarding done?' },
  ],
  users: [
    { key: '__date', label: 'Date' },
    { key: 'segment', label: 'Activity segment' },
    { key: 'item_count_bucket', label: 'Item-count bucket' },
    { key: 'utm_source', label: 'UTM source' },
    { key: 'utm_medium', label: 'UTM medium' },
    { key: 'utm_campaign', label: 'UTM campaign' },
    { key: 'referral_source', label: 'Referral source' },
    { key: 'feeling', label: 'Feeling' },
    { key: 'baby_gender', label: 'Baby gender' },
    { key: 'first_time_parent', label: 'First-time parent?' },
    { key: 'onboarding_completed', label: 'Onboarding done?' },
    { key: 'marketing_emails', label: 'Marketing emails on?' },
    { key: 'price_drop_opt_in', label: 'Price-drop opt-in?' },
    { key: 'has_partner', label: 'Has partner?' },
  ],
};

export const MEASURES: Record<Grain, MeasureDef[]> = {
  items: [
    { key: 'items', label: 'Items (count)', agg: 'count', format: 'int' },
    { key: 'registries', label: 'Distinct registries', agg: 'distinct', field: 'registry_id', format: 'int' },
    { key: 'owners', label: 'Distinct families', agg: 'distinct', field: 'owner_id', format: 'int' },
    { key: 'sumPrice', label: 'Total price (₪)', agg: 'sum', field: 'price', format: 'money' },
    { key: 'avgPrice', label: 'Avg price (₪)', agg: 'avg', field: 'price', format: 'money' },
    { key: 'minPrice', label: 'Min price (₪)', agg: 'min', field: 'price', format: 'money' },
    { key: 'maxPrice', label: 'Max price (₪)', agg: 'max', field: 'price', format: 'money' },
  ],
  users: [
    { key: 'users', label: 'Users (count)', agg: 'count', format: 'int' },
    { key: 'sumItems', label: 'Total items', agg: 'sum', field: 'item_count', format: 'int' },
    { key: 'avgItems', label: 'Avg items / user', agg: 'avg', field: 'item_count', format: 'num' },
    { key: 'sumReg', label: 'Total registries', agg: 'sum', field: 'registry_count', format: 'int' },
    { key: 'avgReg', label: 'Avg registries / user', agg: 'avg', field: 'registry_count', format: 'num' },
  ],
};

// Distinct values for a dimension across the dataset — used to build filter
// checklists. Returns sorted values with "(none)" pushed last.
export function distinctValues(rows: FlatRow[], field: string): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = r[field];
    set.add(v === null || v === undefined || v === '' ? '(none)' : String(v));
  }
  const arr = [...set];
  arr.sort((a, b) => {
    if (a === '(none)') return 1;
    if (b === '(none)') return -1;
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a < b ? -1 : 1;
  });
  return arr;
}
