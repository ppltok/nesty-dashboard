-- ============================================
-- DASHBOARD MATERIALIZED VIEWS
-- ============================================
-- These views precompute expensive analytics queries.
-- Refreshed every 5 minutes via pg_cron or Edge Function.
-- Run this AFTER 001_dashboard_access.sql.

-- ============================================
-- 1. STORE BREAKDOWN
-- ============================================
-- Normalizes store names from URLs and aggregates item data per store.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_store_breakdown AS
SELECT
  CASE
    WHEN original_url IS NULL OR original_url = '' THEN 'manual'
    ELSE lower(regexp_replace(
      regexp_replace(original_url, '^https?://(www\.)?', ''),
      '/.*$', ''
    ))
  END AS store_domain,
  COALESCE(NULLIF(store_name, 'ידני'), 'Manual Entry') AS store_display_name,
  COUNT(*) AS item_count,
  COUNT(DISTINCT i.registry_id) AS registry_count,
  ROUND(AVG(i.price)::numeric, 2) AS avg_price,
  SUM(i.price * i.quantity) AS total_value,
  SUM(i.quantity_received) AS total_purchased,
  SUM(i.quantity) AS total_wanted,
  CASE
    WHEN SUM(i.quantity) > 0
    THEN ROUND((SUM(i.quantity_received)::numeric / SUM(i.quantity)::numeric) * 100, 1)
    ELSE 0
  END AS purchase_rate
FROM items i
GROUP BY store_domain, store_display_name
ORDER BY item_count DESC;

-- Unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS mv_store_breakdown_idx
  ON mv_store_breakdown (store_domain, store_display_name);


-- ============================================
-- 2. FUNNEL SNAPSHOT
-- ============================================
-- All-time funnel stage counts for quick funnel visualization.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_funnel_snapshot AS
WITH
  stage1 AS (SELECT COUNT(*) AS cnt FROM profiles),
  stage2 AS (SELECT COUNT(*) AS cnt FROM profiles WHERE onboarding_completed = true),
  stage3 AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    WHERE EXISTS (SELECT 1 FROM items WHERE registry_id = r.id)
  ),
  stage4 AS (
    SELECT COUNT(DISTINCT sub.owner_id) AS cnt
    FROM (
      SELECT r.owner_id, COUNT(*) AS item_count
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      GROUP BY r.owner_id
      HAVING COUNT(*) >= 5
    ) sub
  ),
  -- Stage 5 (shared) approximated by registries with title set and items
  stage5 AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    WHERE r.title IS NOT NULL
    AND EXISTS (SELECT 1 FROM items WHERE registry_id = r.id LIMIT 1)
  ),
  -- Stage 6 (viewed) = registries with any purchase attempt
  stage6 AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    JOIN items i ON i.registry_id = r.id
    JOIN purchases p ON p.item_id = i.id
  ),
  -- Stage 7 (gifted) = registries with confirmed purchase
  stage7 AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    JOIN items i ON i.registry_id = r.id
    JOIN purchases p ON p.item_id = i.id
    WHERE p.status = 'confirmed'
  )
SELECT 'signups' AS stage, 1 AS stage_order, cnt AS count FROM stage1
UNION ALL SELECT 'onboarded', 2, cnt FROM stage2
UNION ALL SELECT 'first_item', 3, cnt FROM stage3
UNION ALL SELECT 'five_items', 4, cnt FROM stage4
UNION ALL SELECT 'shared', 5, cnt FROM stage5
UNION ALL SELECT 'viewed', 6, cnt FROM stage6
UNION ALL SELECT 'gifted', 7, cnt FROM stage7;

CREATE UNIQUE INDEX IF NOT EXISTS mv_funnel_snapshot_idx
  ON mv_funnel_snapshot (stage);


-- ============================================
-- 3. CATEGORY BREAKDOWN
-- ============================================
-- Item distribution across categories with purchase rates.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_breakdown AS
SELECT
  category,
  COUNT(*) AS item_count,
  SUM(price * quantity) AS total_value,
  ROUND(AVG(price)::numeric, 2) AS avg_price,
  SUM(quantity_received) AS total_purchased,
  SUM(quantity) AS total_wanted,
  CASE
    WHEN SUM(quantity) > 0
    THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1)
    ELSE 0
  END AS purchase_rate
FROM items
GROUP BY category
ORDER BY item_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS mv_category_breakdown_idx
  ON mv_category_breakdown (category);


-- ============================================
-- 4. DAILY SIGNUPS (for trend charts)
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_signups AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) AS signups,
  COUNT(*) FILTER (WHERE onboarding_completed = true) AS onboarded
FROM profiles
GROUP BY day
ORDER BY day DESC;

CREATE UNIQUE INDEX IF NOT EXISTS mv_daily_signups_idx
  ON mv_daily_signups (day);


-- ============================================
-- 5. DAILY ITEMS ADDED
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_items AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) AS items_added,
  COUNT(*) FILTER (WHERE original_url IS NOT NULL AND store_name != 'ידני') AS via_extension,
  COUNT(*) FILTER (WHERE original_url IS NULL OR store_name = 'ידני') AS via_manual
FROM items
GROUP BY day
ORDER BY day DESC;

CREATE UNIQUE INDEX IF NOT EXISTS mv_daily_items_idx
  ON mv_daily_items (day);


-- ============================================
-- 6. DAILY GIFTS
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_gifts AS
SELECT
  date_trunc('day', confirmed_at)::date AS day,
  COUNT(*) AS gifts_confirmed,
  COUNT(DISTINCT buyer_email) AS unique_givers
FROM purchases
WHERE status = 'confirmed'
AND confirmed_at IS NOT NULL
GROUP BY day
ORDER BY day DESC;

CREATE UNIQUE INDEX IF NOT EXISTS mv_daily_gifts_idx
  ON mv_daily_gifts (day);


-- ============================================
-- REFRESH FUNCTION
-- ============================================
-- Call this to refresh all materialized views at once.

CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_store_breakdown;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funnel_snapshot;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_breakdown;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_signups;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_items;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_gifts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
