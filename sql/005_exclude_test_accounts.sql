-- ============================================
-- EXCLUDE TEST ACCOUNTS FROM DASHBOARD
-- ============================================
-- Adds a test_emails list and rebuilds all views/functions
-- to exclude those accounts from calculations.
-- Run this in Supabase SQL Editor.

-- Step 1: Find test account's registry ID for reference
-- SELECT r.id, r.owner_id, p.email
-- FROM registries r JOIN profiles p ON r.owner_id = p.id
-- WHERE p.email = 'tom@ppltok.com';

-- ============================================
-- RECREATE ALL MATERIALIZED VIEWS (excluding test accounts)
-- ============================================

-- Drop old views first
DROP MATERIALIZED VIEW IF EXISTS mv_store_breakdown CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_funnel_snapshot CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_category_breakdown CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_daily_signups CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_daily_items CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_daily_gifts CASCADE;


-- 1. STORE BREAKDOWN (excluding test accounts)
CREATE MATERIALIZED VIEW mv_store_breakdown AS
SELECT
  CASE
    WHEN i.original_url IS NULL OR i.original_url = '' THEN 'manual'
    ELSE lower(regexp_replace(
      regexp_replace(i.original_url, '^https?://(www\.)?', ''),
      '/.*$', ''
    ))
  END AS store_domain,
  COALESCE(NULLIF(i.store_name, 'ידני'), 'Manual Entry') AS store_display_name,
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
JOIN registries r ON i.registry_id = r.id
JOIN profiles p ON r.owner_id = p.id
WHERE p.email NOT IN ('tom@ppltok.com')
GROUP BY store_domain, store_display_name
ORDER BY item_count DESC;

CREATE UNIQUE INDEX mv_store_breakdown_idx ON mv_store_breakdown (store_domain, store_display_name);


-- 2. FUNNEL SNAPSHOT (excluding test accounts)
CREATE MATERIALIZED VIEW mv_funnel_snapshot AS
WITH
  test_users AS (SELECT id FROM profiles WHERE email IN ('tom@ppltok.com')),
  stage1 AS (SELECT COUNT(*) AS cnt FROM profiles WHERE id NOT IN (SELECT id FROM test_users)),
  stage2 AS (SELECT COUNT(*) AS cnt FROM profiles WHERE onboarding_completed = true AND id NOT IN (SELECT id FROM test_users)),
  stage3 AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    WHERE EXISTS (SELECT 1 FROM items WHERE registry_id = r.id)
    AND r.owner_id NOT IN (SELECT id FROM test_users)
  ),
  stage4 AS (
    SELECT COUNT(DISTINCT sub.owner_id) AS cnt
    FROM (
      SELECT r.owner_id, COUNT(*) AS item_count
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      WHERE r.owner_id NOT IN (SELECT id FROM test_users)
      GROUP BY r.owner_id
      HAVING COUNT(*) >= 5
    ) sub
  ),
  stage5 AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    WHERE r.title IS NOT NULL
    AND EXISTS (SELECT 1 FROM items WHERE registry_id = r.id LIMIT 1)
    AND r.owner_id NOT IN (SELECT id FROM test_users)
  ),
  stage6 AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    JOIN items i ON i.registry_id = r.id
    JOIN purchases pu ON pu.item_id = i.id
    WHERE r.owner_id NOT IN (SELECT id FROM test_users)
  ),
  stage7 AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    JOIN items i ON i.registry_id = r.id
    JOIN purchases pu ON pu.item_id = i.id
    WHERE pu.status = 'confirmed'
    AND r.owner_id NOT IN (SELECT id FROM test_users)
  )
SELECT 'signups' AS stage, 1 AS stage_order, cnt AS count FROM stage1
UNION ALL SELECT 'onboarded', 2, cnt FROM stage2
UNION ALL SELECT 'first_item', 3, cnt FROM stage3
UNION ALL SELECT 'five_items', 4, cnt FROM stage4
UNION ALL SELECT 'shared', 5, cnt FROM stage5
UNION ALL SELECT 'viewed', 6, cnt FROM stage6
UNION ALL SELECT 'gifted', 7, cnt FROM stage7;

CREATE UNIQUE INDEX mv_funnel_snapshot_idx ON mv_funnel_snapshot (stage);


-- 3. CATEGORY BREAKDOWN (excluding test accounts)
CREATE MATERIALIZED VIEW mv_category_breakdown AS
SELECT
  i.category,
  COUNT(*) AS item_count,
  SUM(i.price * i.quantity) AS total_value,
  ROUND(AVG(i.price)::numeric, 2) AS avg_price,
  SUM(i.quantity_received) AS total_purchased,
  SUM(i.quantity) AS total_wanted,
  CASE
    WHEN SUM(i.quantity) > 0
    THEN ROUND((SUM(i.quantity_received)::numeric / SUM(i.quantity)::numeric) * 100, 1)
    ELSE 0
  END AS purchase_rate
FROM items i
JOIN registries r ON i.registry_id = r.id
JOIN profiles p ON r.owner_id = p.id
WHERE p.email NOT IN ('tom@ppltok.com')
GROUP BY i.category
ORDER BY item_count DESC;

CREATE UNIQUE INDEX mv_category_breakdown_idx ON mv_category_breakdown (category);


-- 4. DAILY SIGNUPS (excluding test accounts)
CREATE MATERIALIZED VIEW mv_daily_signups AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) AS signups,
  COUNT(*) FILTER (WHERE onboarding_completed = true) AS onboarded
FROM profiles
WHERE email NOT IN ('tom@ppltok.com')
GROUP BY day
ORDER BY day DESC;

CREATE UNIQUE INDEX mv_daily_signups_idx ON mv_daily_signups (day);


-- 5. DAILY ITEMS (excluding test accounts)
CREATE MATERIALIZED VIEW mv_daily_items AS
SELECT
  date_trunc('day', i.created_at)::date AS day,
  COUNT(*) AS items_added,
  COUNT(*) FILTER (WHERE i.original_url IS NOT NULL AND i.store_name != 'ידני') AS via_extension,
  COUNT(*) FILTER (WHERE i.original_url IS NULL OR i.store_name = 'ידני') AS via_manual
FROM items i
JOIN registries r ON i.registry_id = r.id
JOIN profiles p ON r.owner_id = p.id
WHERE p.email NOT IN ('tom@ppltok.com')
GROUP BY day
ORDER BY day DESC;

CREATE UNIQUE INDEX mv_daily_items_idx ON mv_daily_items (day);


-- 6. DAILY GIFTS (excluding test accounts)
CREATE MATERIALIZED VIEW mv_daily_gifts AS
SELECT
  date_trunc('day', pu.confirmed_at)::date AS day,
  COUNT(*) AS gifts_confirmed,
  COUNT(DISTINCT pu.buyer_email) AS unique_givers
FROM purchases pu
JOIN items i ON pu.item_id = i.id
JOIN registries r ON i.registry_id = r.id
JOIN profiles p ON r.owner_id = p.id
WHERE pu.status = 'confirmed'
AND pu.confirmed_at IS NOT NULL
AND p.email NOT IN ('tom@ppltok.com')
GROUP BY day
ORDER BY day DESC;

CREATE UNIQUE INDEX mv_daily_gifts_idx ON mv_daily_gifts (day);


-- ============================================
-- RECREATE REFRESH FUNCTION
-- ============================================
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


-- ============================================
-- RECREATE ALL RPC FUNCTIONS (excluding test accounts)
-- ============================================

-- 1. DASHBOARD OVERVIEW
CREATE OR REPLACE FUNCTION get_dashboard_overview(
  period_start TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  period_end TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  test_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO test_ids FROM profiles WHERE email IN ('tom@ppltok.com');
  IF test_ids IS NULL THEN test_ids := '{}'; END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles WHERE created_at <= period_end AND id != ALL(test_ids)),
    'new_users', (SELECT COUNT(*) FROM profiles WHERE created_at BETWEEN period_start AND period_end AND id != ALL(test_ids)),
    'onboarded_users', (SELECT COUNT(*) FROM profiles WHERE onboarding_completed = true AND created_at <= period_end AND id != ALL(test_ids)),
    'total_registries', (SELECT COUNT(*) FROM registries WHERE created_at <= period_end AND owner_id != ALL(test_ids)),
    'active_registries', (
      SELECT COUNT(DISTINCT r.id)
      FROM registries r JOIN items i ON i.registry_id = r.id
      WHERE i.created_at BETWEEN period_start AND period_end
      AND r.owner_id != ALL(test_ids)
    ),
    'total_items', (
      SELECT COUNT(*) FROM items i JOIN registries r ON i.registry_id = r.id
      WHERE i.created_at <= period_end AND r.owner_id != ALL(test_ids)
    ),
    'new_items', (
      SELECT COUNT(*) FROM items i JOIN registries r ON i.registry_id = r.id
      WHERE i.created_at BETWEEN period_start AND period_end AND r.owner_id != ALL(test_ids)
    ),
    'total_gifts', (
      SELECT COUNT(*) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id
      WHERE p.status = 'confirmed' AND p.confirmed_at <= period_end AND r.owner_id != ALL(test_ids)
    ),
    'new_gifts', (
      SELECT COUNT(*) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id
      WHERE p.status = 'confirmed' AND p.confirmed_at BETWEEN period_start AND period_end AND r.owner_id != ALL(test_ids)
    ),
    'platform_gmv', (
      SELECT COALESCE(SUM(i.price * i.quantity_received), 0)
      FROM items i JOIN registries r ON i.registry_id = r.id
      WHERE r.owner_id != ALL(test_ids)
    ),
    'period_gmv', (
      SELECT COALESCE(SUM(i.price * p.quantity_purchased), 0)
      FROM items i JOIN purchases p ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id
      WHERE p.status = 'confirmed' AND p.confirmed_at BETWEEN period_start AND period_end AND r.owner_id != ALL(test_ids)
    ),
    'avg_registry_value', (
      SELECT ROUND(AVG(reg_total)::numeric, 2)
      FROM (
        SELECT SUM(i.price * i.quantity) AS reg_total
        FROM items i JOIN registries r ON i.registry_id = r.id
        WHERE r.owner_id != ALL(test_ids)
        GROUP BY i.registry_id HAVING COUNT(*) >= 1
      ) sub
    ),
    'avg_items_per_registry', (
      SELECT ROUND(AVG(item_count)::numeric, 1)
      FROM (
        SELECT COUNT(*) AS item_count FROM items i JOIN registries r ON i.registry_id = r.id
        WHERE r.owner_id != ALL(test_ids) GROUP BY i.registry_id
      ) sub
    ),
    'completion_rate', (
      SELECT CASE WHEN SUM(quantity) > 0
        THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1)
        ELSE 0 END
      FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids)
    ),
    'north_star_30d', (
      SELECT COUNT(DISTINCT r.id)
      FROM registries r JOIN items i ON i.registry_id = r.id JOIN purchases p ON p.item_id = i.id
      WHERE p.status = 'confirmed' AND p.confirmed_at >= NOW() - INTERVAL '30 days'
      AND r.owner_id != ALL(test_ids)
    ),
    'extension_users', (
      SELECT COUNT(DISTINCT r.owner_id)
      FROM registries r JOIN items i ON i.registry_id = r.id
      WHERE i.original_url IS NOT NULL AND i.store_name != 'ידני'
      AND r.owner_id != ALL(test_ids)
    ),
    'total_users_with_items', (
      SELECT COUNT(DISTINCT r.owner_id)
      FROM registries r
      WHERE EXISTS (SELECT 1 FROM items WHERE registry_id = r.id)
      AND r.owner_id != ALL(test_ids)
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. REGISTRY ECONOMICS
CREATE OR REPLACE FUNCTION get_registry_economics()
RETURNS JSON AS $$
DECLARE
  result JSON;
  test_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO test_ids FROM profiles WHERE email IN ('tom@ppltok.com');
  IF test_ids IS NULL THEN test_ids := '{}'; END IF;

  SELECT json_build_object(
    'total_gmv', (
      SELECT COALESCE(SUM(i.price * i.quantity_received), 0)
      FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids)
    ),
    'avg_registry_value', (
      SELECT ROUND(AVG(reg_total)::numeric, 2)
      FROM (SELECT SUM(i.price * i.quantity) AS reg_total FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids) GROUP BY i.registry_id HAVING COUNT(*) >= 1) sub
    ),
    'median_registry_value', (
      SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY reg_total)::numeric, 2)
      FROM (SELECT SUM(i.price * i.quantity) AS reg_total FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids) GROUP BY i.registry_id HAVING COUNT(*) >= 1) sub
    ),
    'avg_gift_value', (
      SELECT ROUND(AVG(i.price)::numeric, 2) FROM items i JOIN registries r ON i.registry_id = r.id WHERE i.quantity_received > 0 AND r.owner_id != ALL(test_ids)
    ),
    'avg_items_per_registry', (
      SELECT ROUND(AVG(cnt)::numeric, 1)
      FROM (SELECT COUNT(*) AS cnt FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids) GROUP BY i.registry_id) sub
    ),
    'avg_gifts_per_registry', (
      SELECT ROUND(AVG(gifts)::numeric, 1)
      FROM (SELECT SUM(i.quantity_received) AS gifts FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids) GROUP BY i.registry_id) sub
    ),
    'completion_rate', (
      SELECT CASE WHEN SUM(quantity) > 0 THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1) ELSE 0 END
      FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids)
    ),
    'total_registries_with_items', (
      SELECT COUNT(DISTINCT i.registry_id) FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids)
    ),
    'total_gifts_given', (
      SELECT COUNT(*) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE p.status = 'confirmed' AND r.owner_id != ALL(test_ids)
    ),
    'unique_gift_givers', (
      SELECT COUNT(DISTINCT p.buyer_email) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE p.status = 'confirmed' AND r.owner_id != ALL(test_ids)
    ),
    'value_distribution', (
      SELECT json_agg(row_to_json(d)) FROM (
        SELECT bucket, COUNT(*) AS registry_count FROM (
          SELECT CASE
            WHEN reg_total < 2000 THEN '0-2K'
            WHEN reg_total < 5000 THEN '2K-5K'
            WHEN reg_total < 10000 THEN '5K-10K'
            WHEN reg_total < 20000 THEN '10K-20K'
            ELSE '20K+'
          END AS bucket
          FROM (SELECT SUM(i.price * i.quantity) AS reg_total FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids) GROUP BY i.registry_id HAVING COUNT(*) >= 1) totals
        ) bucketed GROUP BY bucket ORDER BY CASE bucket WHEN '0-2K' THEN 1 WHEN '2K-5K' THEN 2 WHEN '5K-10K' THEN 3 WHEN '10K-20K' THEN 4 WHEN '20K+' THEN 5 END
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. EXTENSION METRICS
CREATE OR REPLACE FUNCTION get_extension_metrics()
RETURNS JSON AS $$
DECLARE
  result JSON;
  test_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO test_ids FROM profiles WHERE email IN ('tom@ppltok.com');
  IF test_ids IS NULL THEN test_ids := '{}'; END IF;

  WITH ext_users AS (
    SELECT DISTINCT r.owner_id FROM registries r JOIN items i ON i.registry_id = r.id
    WHERE i.original_url IS NOT NULL AND i.store_name != 'ידני' AND r.owner_id != ALL(test_ids)
  ),
  non_ext_users AS (
    SELECT DISTINCT r.owner_id FROM registries r
    WHERE EXISTS (SELECT 1 FROM items WHERE registry_id = r.id)
    AND r.owner_id NOT IN (SELECT owner_id FROM ext_users)
    AND r.owner_id != ALL(test_ids)
  )
  SELECT json_build_object(
    'extension_users', (SELECT COUNT(*) FROM ext_users),
    'non_extension_users', (SELECT COUNT(*) FROM non_ext_users),
    'items_via_extension', (SELECT COUNT(*) FROM items i JOIN registries r ON i.registry_id = r.id WHERE i.original_url IS NOT NULL AND i.store_name != 'ידני' AND r.owner_id != ALL(test_ids)),
    'items_manual', (SELECT COUNT(*) FROM items i JOIN registries r ON i.registry_id = r.id WHERE (i.original_url IS NULL OR i.store_name = 'ידני') AND r.owner_id != ALL(test_ids)),
    'ext_avg_items', (SELECT ROUND(AVG(cnt)::numeric, 1) FROM (SELECT COUNT(*) AS cnt FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id IN (SELECT owner_id FROM ext_users) GROUP BY i.registry_id) sub),
    'non_ext_avg_items', (SELECT ROUND(AVG(cnt)::numeric, 1) FROM (SELECT COUNT(*) AS cnt FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id IN (SELECT owner_id FROM non_ext_users) GROUP BY i.registry_id) sub),
    'ext_avg_value', (SELECT ROUND(AVG(val)::numeric, 2) FROM (SELECT SUM(i.price * i.quantity) AS val FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id IN (SELECT owner_id FROM ext_users) GROUP BY i.registry_id) sub),
    'non_ext_avg_value', (SELECT ROUND(AVG(val)::numeric, 2) FROM (SELECT SUM(i.price * i.quantity) AS val FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id IN (SELECT owner_id FROM non_ext_users) GROUP BY i.registry_id) sub),
    'ext_completion_rate', (SELECT CASE WHEN SUM(quantity) > 0 THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1) ELSE 0 END FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id IN (SELECT owner_id FROM ext_users)),
    'non_ext_completion_rate', (SELECT CASE WHEN SUM(quantity) > 0 THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1) ELSE 0 END FROM items i JOIN registries r ON i.registry_id = r.id WHERE r.owner_id IN (SELECT owner_id FROM non_ext_users))
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. GIFT GIVER INSIGHTS (excluding test account purchases)
CREATE OR REPLACE FUNCTION get_gift_giver_insights()
RETURNS JSON AS $$
DECLARE
  result JSON;
  test_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO test_ids FROM profiles WHERE email IN ('tom@ppltok.com');
  IF test_ids IS NULL THEN test_ids := '{}'; END IF;

  SELECT json_build_object(
    'total_purchases', (SELECT COUNT(*) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids)),
    'confirmed', (SELECT COUNT(*) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE p.status = 'confirmed' AND r.owner_id != ALL(test_ids)),
    'pending', (SELECT COUNT(*) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE p.status = 'pending' AND r.owner_id != ALL(test_ids)),
    'cancelled', (SELECT COUNT(*) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE p.status = 'cancelled' AND r.owner_id != ALL(test_ids)),
    'expired', (SELECT COUNT(*) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE p.status = 'expired' AND r.owner_id != ALL(test_ids)),
    'confirmation_rate', (
      SELECT ROUND((COUNT(*) FILTER (WHERE p.status = 'confirmed')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1)
      FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids)
    ),
    'avg_hours_to_confirm', (
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (p.confirmed_at - p.created_at)) / 3600)::numeric, 1)
      FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id
      WHERE p.status = 'confirmed' AND p.confirmed_at IS NOT NULL AND r.owner_id != ALL(test_ids)
    ),
    'surprise_rate', (
      SELECT ROUND((COUNT(*) FILTER (WHERE p.is_surprise = true)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1)
      FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids)
    ),
    'message_rate', (
      SELECT ROUND((COUNT(*) FILTER (WHERE p.gift_message IS NOT NULL AND p.gift_message != '')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1)
      FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE r.owner_id != ALL(test_ids)
    ),
    'unique_givers', (
      SELECT COUNT(DISTINCT p.buyer_email) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE p.status = 'confirmed' AND r.owner_id != ALL(test_ids)
    ),
    'avg_gifts_per_giver', (
      SELECT ROUND(AVG(cnt)::numeric, 1)
      FROM (SELECT COUNT(*) AS cnt FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id WHERE p.status = 'confirmed' AND r.owner_id != ALL(test_ids) GROUP BY p.buyer_email) sub
    ),
    'gift_category_distribution', (
      SELECT json_agg(row_to_json(d)) FROM (
        SELECT i.category, COUNT(*) AS gift_count
        FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id
        WHERE p.status = 'confirmed' AND r.owner_id != ALL(test_ids)
        GROUP BY i.category ORDER BY gift_count DESC
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. PREGNANCY TIMELINE (excluding test accounts)
CREATE OR REPLACE FUNCTION get_pregnancy_timeline()
RETURNS JSON AS $$
DECLARE
  result JSON;
  test_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO test_ids FROM profiles WHERE email IN ('tom@ppltok.com');
  IF test_ids IS NULL THEN test_ids := '{}'; END IF;

  SELECT json_build_object(
    'items_by_week', (
      SELECT json_agg(row_to_json(d)) FROM (
        SELECT FLOOR(EXTRACT(EPOCH FROM (pr.due_date - i.created_at)) / (7 * 86400))::int AS weeks_before_due, COUNT(*) AS items_added
        FROM items i JOIN registries r ON i.registry_id = r.id JOIN profiles pr ON r.owner_id = pr.id
        WHERE pr.due_date IS NOT NULL AND pr.due_date > i.created_at AND r.owner_id != ALL(test_ids)
        GROUP BY weeks_before_due
        HAVING FLOOR(EXTRACT(EPOCH FROM (pr.due_date - i.created_at)) / (7 * 86400))::int BETWEEN 0 AND 40
        ORDER BY weeks_before_due DESC
      ) d
    ),
    'gifts_by_week', (
      SELECT json_agg(row_to_json(d)) FROM (
        SELECT FLOOR(EXTRACT(EPOCH FROM (pr.due_date - pu.confirmed_at)) / (7 * 86400))::int AS weeks_before_due, COUNT(*) AS gifts_received
        FROM purchases pu JOIN items i ON pu.item_id = i.id JOIN registries r ON i.registry_id = r.id JOIN profiles pr ON r.owner_id = pr.id
        WHERE pu.status = 'confirmed' AND pr.due_date IS NOT NULL AND pr.due_date > pu.confirmed_at AND r.owner_id != ALL(test_ids)
        GROUP BY weeks_before_due
        HAVING FLOOR(EXTRACT(EPOCH FROM (pr.due_date - pu.confirmed_at)) / (7 * 86400))::int BETWEEN 0 AND 40
        ORDER BY weeks_before_due DESC
      ) d
    ),
    'avg_first_item_week', (
      SELECT ROUND(AVG(weeks_before)::numeric, 1)
      FROM (
        SELECT FLOOR(EXTRACT(EPOCH FROM (pr.due_date - MIN(i.created_at))) / (7 * 86400)) AS weeks_before
        FROM items i JOIN registries r ON i.registry_id = r.id JOIN profiles pr ON r.owner_id = pr.id
        WHERE pr.due_date IS NOT NULL AND r.owner_id != ALL(test_ids)
        GROUP BY r.owner_id, pr.due_date HAVING MIN(i.created_at) < pr.due_date
      ) sub
    ),
    'due_date_distribution', (
      SELECT json_agg(row_to_json(d)) FROM (
        SELECT to_char(due_date, 'YYYY-MM') AS month, COUNT(*) AS user_count
        FROM profiles WHERE due_date IS NOT NULL AND id != ALL(test_ids)
        GROUP BY month ORDER BY month
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
