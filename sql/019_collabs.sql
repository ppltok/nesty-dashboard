-- Collabs page: partner-perk ("collab") campaign analytics.
--
-- Reads public.collab_events (created by the nesty-web migration
-- 20260628_collab_events.sql). The dashboard uses the anon key, so this must be
-- SECURITY DEFINER to read past RLS — collab_events has no SELECT policy.
--
-- Returns a per-collab funnel summary + a daily time series, both date-filtered.

create or replace function public.get_collab_metrics(
  period_start timestamptz,
  period_end   timestamptz
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with ev as (
    select *
    from collab_events
    where created_at >= period_start
      and created_at <= period_end
  ),
  summary as (
    select
      collab,
      count(*) filter (where event_type = 'email_sent')        as emails_sent,
      count(*) filter (where event_type = 'email_link_click')  as email_clicks,
      count(*) filter (where event_type = 'popup_view')        as popup_views,
      count(*) filter (where event_type = 'popup_reveal')      as popup_reveals,
      count(*) filter (where event_type = 'popup_copy')        as popup_copies,
      count(*) filter (where event_type = 'popup_cta_click')   as popup_cta_clicks,
      count(*) filter (where event_type = 'card_view')         as card_views,
      count(*) filter (where event_type = 'card_reveal')       as card_reveals,
      count(*) filter (where event_type = 'card_copy')         as card_copies,
      count(*) filter (where event_type = 'card_cta_click')    as card_cta_clicks,
      count(*) filter (where event_type in ('popup_view','card_view'))                       as total_views,
      count(*) filter (where event_type in ('popup_reveal','card_reveal'))                   as total_reveals,
      count(*) filter (where event_type in ('popup_copy','card_copy'))                       as total_copies,
      count(*) filter (where event_type in ('popup_cta_click','card_cta_click','email_link_click')) as total_redeem_clicks,
      count(distinct user_id) as unique_users
    from ev
    group by collab
    order by collab
  ),
  daily as (
    select
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
      collab,
      count(*) filter (where event_type = 'email_sent')        as emails_sent,
      count(*) filter (where event_type = 'email_link_click')  as email_clicks,
      count(*) filter (where event_type in ('popup_view','card_view'))   as views,
      count(*) filter (where event_type in ('popup_reveal','card_reveal')) as reveals,
      count(*) filter (where event_type in ('popup_copy','card_copy'))   as copies,
      count(*) filter (where event_type in ('popup_cta_click','card_cta_click','email_link_click')) as redeem_clicks
    from ev
    group by 1, 2
    order by 1
  )
  select jsonb_build_object(
    'collabs', coalesce((select jsonb_agg(to_jsonb(summary)) from summary), '[]'::jsonb),
    'daily',   coalesce((select jsonb_agg(to_jsonb(daily))   from daily),   '[]'::jsonb)
  );
$$;

grant execute on function public.get_collab_metrics(timestamptz, timestamptz) to anon, authenticated;
