import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  DashboardOverview,
  FunnelStage,
  StoreBreakdown,
  CategoryBreakdown,
  RegistryEconomics,
  ExtensionMetrics,
  GiftGiverInsights,
  PregnancyTimeline,
  DailySignups,
  DailyItems,
  DailyGifts,
  DashboardUser,
} from '@/types/dashboard'

export function useOverview(start: Date, end: Date) {
  return useQuery<DashboardOverview>({
    queryKey: ['overview', start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_overview', {
        period_start: start.toISOString(),
        period_end: end.toISOString(),
      })
      if (error) throw error
      return data as DashboardOverview
    },
    staleTime: 60_000,
  })
}

export function usePreviousOverview(start: Date, end: Date) {
  const durationMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime())
  const prevStart = new Date(start.getTime() - durationMs)

  return useQuery<DashboardOverview>({
    queryKey: ['overview-prev', prevStart.toISOString(), prevEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_overview', {
        period_start: prevStart.toISOString(),
        period_end: prevEnd.toISOString(),
      })
      if (error) throw error
      return data as DashboardOverview
    },
    staleTime: 60_000,
  })
}

export function useFunnel() {
  return useQuery<FunnelStage[]>({
    queryKey: ['funnel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_funnel_snapshot')
        .select('*')
        .order('stage_order')
      if (error) throw error
      return data as FunnelStage[]
    },
    staleTime: 300_000,
  })
}

export function useStores() {
  return useQuery<StoreBreakdown[]>({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_store_breakdown')
        .select('*')
        .order('item_count', { ascending: false })
      if (error) throw error
      return data as StoreBreakdown[]
    },
    staleTime: 300_000,
  })
}

export function useCategories() {
  return useQuery<CategoryBreakdown[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_category_breakdown')
        .select('*')
        .order('item_count', { ascending: false })
      if (error) throw error
      return data as CategoryBreakdown[]
    },
    staleTime: 300_000,
  })
}

export function useEconomics() {
  return useQuery<RegistryEconomics>({
    queryKey: ['economics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_registry_economics')
      if (error) throw error
      if (!data) return {
        total_gmv: 0, avg_registry_value: 0, median_registry_value: 0,
        avg_gift_value: 0, avg_items_per_registry: 0, avg_gifts_per_registry: 0,
        completion_rate: 0, total_registries_with_items: 0, total_gifts_given: 0,
        unique_gift_givers: 0, value_distribution: [],
      } satisfies RegistryEconomics
      return data as RegistryEconomics
    },
    staleTime: 300_000,
  })
}

export function useExtensionMetrics() {
  return useQuery<ExtensionMetrics>({
    queryKey: ['extension'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_extension_metrics')
      if (error) throw error
      return data as ExtensionMetrics
    },
    staleTime: 300_000,
  })
}

export function useGiftInsights() {
  return useQuery<GiftGiverInsights>({
    queryKey: ['gifts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_gift_giver_insights')
      if (error) throw error
      if (!data) return {
        total_purchases: 0, confirmed: 0, pending: 0, cancelled: 0, expired: 0,
        confirmation_rate: 0, avg_hours_to_confirm: 0, surprise_rate: 0,
        message_rate: 0, unique_givers: 0, avg_gifts_per_giver: 0,
        gift_category_distribution: [],
      } satisfies GiftGiverInsights
      return data as GiftGiverInsights
    },
    staleTime: 300_000,
  })
}

export function usePregnancyTimeline() {
  return useQuery<PregnancyTimeline>({
    queryKey: ['timeline'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pregnancy_timeline')
      if (error) throw error
      if (!data) return {
        items_by_week: [], gifts_by_week: [],
        avg_first_item_week: null, due_date_distribution: [],
      } satisfies PregnancyTimeline
      return data as PregnancyTimeline
    },
    staleTime: 300_000,
  })
}

export interface GrowthMetrics {
  activation_rate: number
  activated_users: number
  share_rate: number
  extension_install_rate: number
  extension_users_period: number
  retention_7d: number
  avg_hours_to_first_item: number
  total_signups_period: number
  onboarded_period: number
}

export function useGrowthMetrics(start: Date, end: Date) {
  return useQuery<GrowthMetrics>({
    queryKey: ['growth-metrics', start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_growth_metrics', {
        period_start: start.toISOString(),
        period_end: end.toISOString(),
      })
      if (error) throw error
      if (!data) return {
        activation_rate: 0, activated_users: 0, share_rate: 0,
        extension_install_rate: 0, extension_users_period: 0,
        retention_7d: 0, avg_hours_to_first_item: 0,
        total_signups_period: 0, onboarded_period: 0,
      } satisfies GrowthMetrics
      return data as GrowthMetrics
    },
    staleTime: 60_000,
  })
}

export function useDailySignups() {
  return useQuery<DailySignups[]>({
    queryKey: ['daily-signups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_daily_signups')
        .select('*')
        .order('day', { ascending: true })
      if (error) throw error
      return data as DailySignups[]
    },
    staleTime: 300_000,
  })
}

export function useDailyItems() {
  return useQuery<DailyItems[]>({
    queryKey: ['daily-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_daily_items')
        .select('*')
        .order('day', { ascending: true })
      if (error) throw error
      return data as DailyItems[]
    },
    staleTime: 300_000,
  })
}

export function useDailyGifts() {
  return useQuery<DailyGifts[]>({
    queryKey: ['daily-gifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_daily_gifts')
        .select('*')
        .order('day', { ascending: true })
      if (error) throw error
      return data as DailyGifts[]
    },
    staleTime: 300_000,
  })
}

export function useDashboardUsers() {
  return useQuery<DashboardUser[]>({
    queryKey: ['dashboard-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_access')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as DashboardUser[]
    },
  })
}

export function useCategoryItems(category: string | null) {
  return useQuery({
    queryKey: ['category-items', category],
    queryFn: async () => {
      if (!category) return []
      const { data, error } = await supabase
        .from('items')
        .select('name, price, store_name, quantity, quantity_received, image_url, original_url')
        .eq('category', category)
        .order('quantity', { ascending: false })
        .limit(5)
      if (error) throw error
      return data ?? []
    },
    enabled: !!category,
    staleTime: 300_000,
  })
}

export interface EmailMetrics {
  total_sent: number
  by_type: { type: string; count: number }[] | null
  delivered: number
  opened: number
  clicked: number
  bounced: number
  failed: number
  open_rate: number
  click_rate: number
  bounce_rate: number
  unique_recipients: number
  notification_opt_in: number
  marketing_opt_in: number
  daily_sends: { day: string; sent: number; opened: number; clicked: number }[] | null
  nudge_stats: { type: string; sent: number; acted: number }[] | null
}

export function useEmailMetrics(start: Date, end: Date) {
  return useQuery<EmailMetrics>({
    queryKey: ['email-metrics', start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_email_metrics', {
        period_start: start.toISOString(),
        period_end: end.toISOString(),
      })
      if (error) throw error
      if (!data) return {
        total_sent: 0, by_type: [], delivered: 0, opened: 0, clicked: 0,
        bounced: 0, failed: 0, open_rate: 0, click_rate: 0, bounce_rate: 0,
        unique_recipients: 0, notification_opt_in: 0, marketing_opt_in: 0,
        daily_sends: [], nudge_stats: [],
      } satisfies EmailMetrics
      return data as EmailMetrics
    },
    staleTime: 60_000,
  })
}

export function useRefreshViews() {
  return async () => {
    const { error } = await supabase.rpc('refresh_dashboard_views')
    if (error) throw error
  }
}
