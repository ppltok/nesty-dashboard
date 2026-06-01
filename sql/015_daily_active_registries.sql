-- 015: Daily active-registry series
-- Adds `mv_daily_active_registries` so the Overview page can overlay
-- "active registry" on top of daily signups. Definition mirrors the
-- Overview KPI: a registry is "active" on a day if at least one item was
-- added to it that day (distinct count by registry_id).
--
-- Also adds the new view to `refresh_dashboard_views()` so whatever cron /
-- scheduled task already runs that function keeps this view fresh too.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_active_registries AS
SELECT
  date_trunc('day', i.created_at)::date AS day,
  COUNT(DISTINCT i.registry_id) AS active_registries
FROM items i
JOIN registries r ON i.registry_id = r.id
JOIN profiles p ON r.owner_id = p.id
WHERE p.email NOT IN (
  'tom@ppltok.com',
  'ortalgoldi@gmail.com',
  'kehalim.michael@gmail.com',
  'michael.kehalim@gmail.com'
)
GROUP BY day
ORDER BY day DESC;

CREATE UNIQUE INDEX IF NOT EXISTS mv_daily_active_registries_idx
  ON mv_daily_active_registries (day);

-- Extend the shared refresh function to keep this view fresh. The other
-- views stay as-is; we just add our new REFRESH at the end.
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_store_breakdown;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funnel_snapshot;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_breakdown;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_signups;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_items;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_gifts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_active_registries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
