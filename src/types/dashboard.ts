export interface DashboardOverview {
  total_users: number
  new_users: number
  onboarded_users: number
  total_registries: number
  active_registries: number
  total_items: number
  new_items: number
  total_gifts: number
  new_gifts: number
  /** Confirmed gifts (period) where buyer email matches the registry owner or co-parent profile. */
  gifts_by_owner: number
  /** Confirmed gifts (period) where buyer email does NOT match the owner or co-parent — i.e. friends & family. */
  gifts_by_external: number
  platform_gmv: number
  period_gmv: number
  avg_registry_value: number
  avg_items_per_registry: number
  completion_rate: number
  north_star_30d: number
  extension_users: number
  total_users_with_items: number
  /** Registries with an accepted co-parent invitation (partner_id IS NOT NULL). */
  co_parents_count: number
  // Previous period for trends
  prev_total_users: number
  prev_new_users: number
  prev_active_registries: number
  prev_new_items: number
  prev_new_gifts: number
  prev_gifts_by_owner: number
  prev_gifts_by_external: number
  prev_platform_gmv: number
}

export interface FunnelStage {
  stage: string
  stage_order: number
  count: number
}

/** 5-tier user funnel + behavioral flag matrix. See User-Tiers.md in the
 *  Nesty Obsidian vault for tier and flag definitions. */
export interface TierFunnel {
  total_users: number
  tiers: { tier: TierName; tier_order: number; users: number }[]
  flags_overall: TierFlagCounts
  flag_by_tier: ({ tier: TierName; tier_order: number; users: number } & TierFlagCounts)[]
}

export type TierName = 'user' | 'started' | 'active' | 'super' | 'champion'

export interface TierFlagCounts {
  has_coparent: number
  sharer: number
  network_reached: number
  self_fulfiller: number
  gift_received: number
}

/** Per-signup-week cohort tier composition. For each week of signups,
 *  how many users currently sit in each tier. */
export interface TierTrendRow {
  week: string           // ISO date for the week-start (Monday)
  signups: number
  user: number
  started: number
  active: number
  super: number
  champion: number
}

export interface StoreBreakdown {
  store_domain: string
  store_display_name: string
  item_count: number
  registry_count: number
  avg_price: number
  total_value: number
  total_purchased: number
  total_wanted: number
  purchase_rate: number
}

export interface CategoryBreakdown {
  category: string
  item_count: number
  total_value: number
  avg_price: number
  total_purchased: number
  total_wanted: number
  purchase_rate: number
}

export interface RegistryEconomics {
  total_gmv: number
  avg_registry_value: number
  median_registry_value: number
  avg_gift_value: number
  avg_items_per_registry: number
  avg_gifts_per_registry: number
  completion_rate: number
  total_registries_with_items: number
  total_gifts_given: number
  unique_gift_givers: number
  value_distribution: { bucket: string; registry_count: number }[]
}

export interface ExtensionMetrics {
  extension_users: number
  non_extension_users: number
  items_via_extension: number
  items_manual: number
  ext_avg_items: number
  non_ext_avg_items: number
  ext_avg_value: number
  non_ext_avg_value: number
  ext_completion_rate: number
  non_ext_completion_rate: number
}

export interface GiftGiverInsights {
  total_purchases: number
  confirmed: number
  pending: number
  cancelled: number
  expired: number
  confirmation_rate: number
  avg_hours_to_confirm: number
  surprise_rate: number
  message_rate: number
  unique_givers: number
  avg_gifts_per_giver: number
  gift_category_distribution: { category: string; gift_count: number }[] | null
}

export interface PregnancyTimeline {
  items_by_week: { pregnancy_week: number; items_added: number }[] | null
  gifts_by_week: { pregnancy_week: number; gifts_received: number }[] | null
  signups_by_week: { pregnancy_week: number; signups: number }[] | null
  milestones: {
    avg_signup_week: number | null
    avg_first_item_week: number | null
    avg_first_gift_week: number | null
    recommended_share_week: number | null
    users_with_due_date: number
  }
  due_date_distribution: { month: string; user_count: number }[] | null
}

export interface DailySignups {
  day: string
  signups: number
  onboarded: number
}

export interface DailyItems {
  day: string
  items_added: number
  via_extension: number
  via_manual: number
}

export interface DailyActiveRegistries {
  day: string
  active_registries: number
}

export interface DailyGifts {
  day: string
  gifts_confirmed: number
  unique_givers: number
}

export interface DashboardUser {
  id: string
  email: string
  display_name: string | null
  role: 'admin' | 'viewer'
  added_by: string | null
  created_at: string
}

export interface DateRange {
  start: Date
  end: Date
  label: string
}

// People page
export interface PersonTopItem {
  name: string
  price: number
  category: string
  store_name: string | null
  quantity: number
  quantity_received: number
  image_url: string | null
  original_url: string | null
}

export interface PersonCoParent {
  id: string
  email: string
  display_name: string
  first_name: string | null
  last_name: string | null
  signed_up_at: string
  onboarding_completed: boolean
}

export interface PersonRow {
  id: string
  email: string
  display_name: string
  first_name: string | null
  last_name: string | null
  due_date: string | null
  is_first_time_parent: boolean | null
  feeling: string | null
  onboarding_completed: boolean
  email_notifications: boolean
  marketing_emails: boolean
  signed_up_at: string
  registry_id: string | null
  registry_slug: string | null
  registry_title: string | null
  item_count: number
  registry_value: number
  gifts_received: number
  gift_value: number
  total_wanted: number
  total_received: number
  unique_givers: number
  pregnancy_week: number | null
  completion_pct: number
  top_items: PersonTopItem[] | null
  last_item_at: string | null
  /** The co-parent linked to this owner's registry, or null if none. */
  co_parent: PersonCoParent | null
}

export interface PeopleSummary {
  total_users: number
  users_with_items: number
  users_with_gifts: number
  co_parent_count: number
  avg_registry_value: number
  avg_items: number
  avg_completion: number
}

export interface PeopleData {
  summary: PeopleSummary
  users: PersonRow[]
}

// User Journey Timing
export interface UserJourneyTiming {
  timing: {
    avg_days_signup_to_checklist: number | null
    median_days_signup_to_checklist: number | null
    users_with_checklist: number
    avg_days_signup_to_first_item: number | null
    median_days_signup_to_first_item: number | null
    users_with_items: number
    avg_days_checklist_to_first_item: number | null
    median_days_checklist_to_first_item: number | null
    users_checklist_then_item: number
    total_users: number
  }
  signup_to_checklist_distribution: { bucket: string; users: number }[]
  signup_to_item_distribution: { bucket: string; users: number }[]
  share_by_pregnancy_week: { pregnancy_week: number; users: number }[]
  gift_by_pregnancy_week: { pregnancy_week: number; users: number }[]
}
