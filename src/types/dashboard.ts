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
  platform_gmv: number
  period_gmv: number
  avg_registry_value: number
  avg_items_per_registry: number
  completion_rate: number
  north_star_30d: number
  extension_users: number
  total_users_with_items: number
}

export interface FunnelStage {
  stage: string
  stage_order: number
  count: number
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
  items_by_week: { weeks_before_due: number; items_added: number }[] | null
  gifts_by_week: { weeks_before_due: number; gifts_received: number }[] | null
  avg_first_item_week: number | null
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
