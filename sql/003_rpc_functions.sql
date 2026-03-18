-- ============================================
-- DASHBOARD RPC FUNCTIONS
-- ============================================
-- These functions provide the dashboard API.
-- All use SECURITY DEFINER to bypass RLS (dashboard needs cross-user data).
-- Access control is handled at the application level (email allowlist).
-- Run this AFTER 002_materialized_views.sql.


-- ============================================
-- 1. DASHBOARD OVERVIEW
-- ============================================
-- Returns top-level KPIs for the Overview page.
-- Accepts date range for period filtering and comparison.

CREATE OR REPLACE FUNCTION get_dashboard_overview(
  period_start TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  period_end TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    -- User metrics
    'total_users', (SELECT COUNT(*) FROM profiles WHERE created_at <= period_end),
    'new_users', (SELECT COUNT(*) FROM profiles WHERE created_at BETWEEN period_start AND period_end),
    'onboarded_users', (SELECT COUNT(*) FROM profiles WHERE onboarding_completed = true AND created_at <= period_end),

    -- Registry metrics
    'total_registries', (SELECT COUNT(*) FROM registries WHERE created_at <= period_end),
    'active_registries', (
      SELECT COUNT(DISTINCT r.id)
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      WHERE i.created_at BETWEEN period_start AND period_end
    ),

    -- Item metrics
    'total_items', (SELECT COUNT(*) FROM items WHERE created_at <= period_end),
    'new_items', (SELECT COUNT(*) FROM items WHERE created_at BETWEEN period_start AND period_end),

    -- Gift metrics
    'total_gifts', (SELECT COUNT(*) FROM purchases WHERE status = 'confirmed' AND confirmed_at <= period_end),
    'new_gifts', (
      SELECT COUNT(*) FROM purchases
      WHERE status = 'confirmed'
      AND confirmed_at BETWEEN period_start AND period_end
    ),

    -- Economics
    'platform_gmv', (
      SELECT COALESCE(SUM(i.price * i.quantity_received), 0)
      FROM items i
    ),
    'period_gmv', (
      SELECT COALESCE(SUM(i.price * p.quantity_purchased), 0)
      FROM items i
      JOIN purchases p ON p.item_id = i.id
      WHERE p.status = 'confirmed'
      AND p.confirmed_at BETWEEN period_start AND period_end
    ),
    'avg_registry_value', (
      SELECT ROUND(AVG(reg_total)::numeric, 2)
      FROM (
        SELECT SUM(i.price * i.quantity) AS reg_total
        FROM items i GROUP BY i.registry_id HAVING COUNT(*) >= 1
      ) sub
    ),
    'avg_items_per_registry', (
      SELECT ROUND(AVG(item_count)::numeric, 1)
      FROM (SELECT COUNT(*) AS item_count FROM items GROUP BY registry_id) sub
    ),
    'completion_rate', (
      SELECT CASE
        WHEN SUM(quantity) > 0
        THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1)
        ELSE 0
      END FROM items
    ),

    -- North Star
    'north_star_30d', (
      SELECT COUNT(DISTINCT r.id)
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      JOIN purchases p ON p.item_id = i.id
      WHERE p.status = 'confirmed'
      AND p.confirmed_at >= NOW() - INTERVAL '30 days'
    ),

    -- Extension
    'extension_users', (
      SELECT COUNT(DISTINCT r.owner_id)
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      WHERE i.original_url IS NOT NULL AND i.store_name != 'ידני'
    ),
    'total_users_with_items', (
      SELECT COUNT(DISTINCT r.owner_id)
      FROM registries r
      WHERE EXISTS (SELECT 1 FROM items WHERE registry_id = r.id)
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 2. REGISTRY ECONOMICS
-- ============================================
-- Detailed economics data for the Economics page.

CREATE OR REPLACE FUNCTION get_registry_economics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_gmv', (
      SELECT COALESCE(SUM(price * quantity_received), 0) FROM items
    ),
    'avg_registry_value', (
      SELECT ROUND(AVG(reg_total)::numeric, 2)
      FROM (
        SELECT SUM(price * quantity) AS reg_total
        FROM items GROUP BY registry_id HAVING COUNT(*) >= 1
      ) sub
    ),
    'median_registry_value', (
      SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY reg_total)::numeric, 2)
      FROM (
        SELECT SUM(price * quantity) AS reg_total
        FROM items GROUP BY registry_id HAVING COUNT(*) >= 1
      ) sub
    ),
    'avg_gift_value', (
      SELECT ROUND(AVG(price)::numeric, 2) FROM items WHERE quantity_received > 0
    ),
    'avg_items_per_registry', (
      SELECT ROUND(AVG(cnt)::numeric, 1)
      FROM (SELECT COUNT(*) AS cnt FROM items GROUP BY registry_id) sub
    ),
    'avg_gifts_per_registry', (
      SELECT ROUND(AVG(gifts)::numeric, 1)
      FROM (SELECT SUM(quantity_received) AS gifts FROM items GROUP BY registry_id) sub
    ),
    'completion_rate', (
      SELECT CASE
        WHEN SUM(quantity) > 0
        THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1)
        ELSE 0
      END FROM items
    ),
    'total_registries_with_items', (
      SELECT COUNT(DISTINCT registry_id) FROM items
    ),
    'total_gifts_given', (
      SELECT COUNT(*) FROM purchases WHERE status = 'confirmed'
    ),
    'unique_gift_givers', (
      SELECT COUNT(DISTINCT buyer_email) FROM purchases WHERE status = 'confirmed'
    ),
    'value_distribution', (
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT bucket, COUNT(*) AS registry_count
        FROM (
          SELECT CASE
            WHEN reg_total < 2000 THEN '0-2K'
            WHEN reg_total < 5000 THEN '2K-5K'
            WHEN reg_total < 10000 THEN '5K-10K'
            WHEN reg_total < 20000 THEN '10K-20K'
            ELSE '20K+'
          END AS bucket
          FROM (
            SELECT SUM(price * quantity) AS reg_total
            FROM items GROUP BY registry_id HAVING COUNT(*) >= 1
          ) totals
        ) bucketed
        GROUP BY bucket
        ORDER BY CASE bucket
          WHEN '0-2K' THEN 1 WHEN '2K-5K' THEN 2 WHEN '5K-10K' THEN 3
          WHEN '10K-20K' THEN 4 WHEN '20K+' THEN 5
        END
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 3. EXTENSION METRICS
-- ============================================
-- Chrome extension adoption and impact comparison.

CREATE OR REPLACE FUNCTION get_extension_metrics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH ext_users AS (
    SELECT DISTINCT r.owner_id
    FROM registries r
    JOIN items i ON i.registry_id = r.id
    WHERE i.original_url IS NOT NULL AND i.store_name != 'ידני'
  ),
  non_ext_users AS (
    SELECT DISTINCT r.owner_id
    FROM registries r
    WHERE EXISTS (SELECT 1 FROM items WHERE registry_id = r.id)
    AND r.owner_id NOT IN (SELECT owner_id FROM ext_users)
  )
  SELECT json_build_object(
    'extension_users', (SELECT COUNT(*) FROM ext_users),
    'non_extension_users', (SELECT COUNT(*) FROM non_ext_users),
    'items_via_extension', (
      SELECT COUNT(*) FROM items WHERE original_url IS NOT NULL AND store_name != 'ידני'
    ),
    'items_manual', (
      SELECT COUNT(*) FROM items WHERE original_url IS NULL OR store_name = 'ידני'
    ),
    'ext_avg_items', (
      SELECT ROUND(AVG(cnt)::numeric, 1)
      FROM (
        SELECT COUNT(*) AS cnt FROM items i
        JOIN registries r ON i.registry_id = r.id
        WHERE r.owner_id IN (SELECT owner_id FROM ext_users)
        GROUP BY i.registry_id
      ) sub
    ),
    'non_ext_avg_items', (
      SELECT ROUND(AVG(cnt)::numeric, 1)
      FROM (
        SELECT COUNT(*) AS cnt FROM items i
        JOIN registries r ON i.registry_id = r.id
        WHERE r.owner_id IN (SELECT owner_id FROM non_ext_users)
        GROUP BY i.registry_id
      ) sub
    ),
    'ext_avg_value', (
      SELECT ROUND(AVG(val)::numeric, 2)
      FROM (
        SELECT SUM(i.price * i.quantity) AS val FROM items i
        JOIN registries r ON i.registry_id = r.id
        WHERE r.owner_id IN (SELECT owner_id FROM ext_users)
        GROUP BY i.registry_id
      ) sub
    ),
    'non_ext_avg_value', (
      SELECT ROUND(AVG(val)::numeric, 2)
      FROM (
        SELECT SUM(i.price * i.quantity) AS val FROM items i
        JOIN registries r ON i.registry_id = r.id
        WHERE r.owner_id IN (SELECT owner_id FROM non_ext_users)
        GROUP BY i.registry_id
      ) sub
    ),
    'ext_completion_rate', (
      SELECT CASE WHEN SUM(quantity) > 0
        THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1)
        ELSE 0 END
      FROM items i JOIN registries r ON i.registry_id = r.id
      WHERE r.owner_id IN (SELECT owner_id FROM ext_users)
    ),
    'non_ext_completion_rate', (
      SELECT CASE WHEN SUM(quantity) > 0
        THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1)
        ELSE 0 END
      FROM items i JOIN registries r ON i.registry_id = r.id
      WHERE r.owner_id IN (SELECT owner_id FROM non_ext_users)
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 4. GIFT GIVER INSIGHTS
-- ============================================
-- Purchase confirmation funnel and gift giver behavior.

CREATE OR REPLACE FUNCTION get_gift_giver_insights()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_purchases', (SELECT COUNT(*) FROM purchases),
    'confirmed', (SELECT COUNT(*) FROM purchases WHERE status = 'confirmed'),
    'pending', (SELECT COUNT(*) FROM purchases WHERE status = 'pending'),
    'cancelled', (SELECT COUNT(*) FROM purchases WHERE status = 'cancelled'),
    'expired', (SELECT COUNT(*) FROM purchases WHERE status = 'expired'),
    'confirmation_rate', (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE status = 'confirmed')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1
      ) FROM purchases
    ),
    'avg_hours_to_confirm', (
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 3600)::numeric, 1)
      FROM purchases WHERE status = 'confirmed' AND confirmed_at IS NOT NULL
    ),
    'surprise_rate', (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE is_surprise = true)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1
      ) FROM purchases
    ),
    'message_rate', (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE gift_message IS NOT NULL AND gift_message != '')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1
      ) FROM purchases
    ),
    'unique_givers', (
      SELECT COUNT(DISTINCT buyer_email) FROM purchases WHERE status = 'confirmed'
    ),
    'avg_gifts_per_giver', (
      SELECT ROUND(AVG(cnt)::numeric, 1)
      FROM (
        SELECT COUNT(*) AS cnt FROM purchases
        WHERE status = 'confirmed'
        GROUP BY buyer_email
      ) sub
    ),
    'gift_category_distribution', (
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT i.category, COUNT(*) AS gift_count
        FROM purchases p
        JOIN items i ON p.item_id = i.id
        WHERE p.status = 'confirmed'
        GROUP BY i.category
        ORDER BY gift_count DESC
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 5. PREGNANCY TIMELINE
-- ============================================
-- Activity relative to due date (weeks before due).

CREATE OR REPLACE FUNCTION get_pregnancy_timeline()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'items_by_week', (
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT
          FLOOR(EXTRACT(EPOCH FROM (p.due_date - i.created_at)) / (7 * 86400))::int AS weeks_before_due,
          COUNT(*) AS items_added
        FROM items i
        JOIN registries r ON i.registry_id = r.id
        JOIN profiles p ON r.owner_id = p.id
        WHERE p.due_date IS NOT NULL AND p.due_date > i.created_at
        GROUP BY weeks_before_due
        HAVING FLOOR(EXTRACT(EPOCH FROM (p.due_date - i.created_at)) / (7 * 86400))::int BETWEEN 0 AND 40
        ORDER BY weeks_before_due DESC
      ) d
    ),
    'gifts_by_week', (
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT
          FLOOR(EXTRACT(EPOCH FROM (p.due_date - pu.confirmed_at)) / (7 * 86400))::int AS weeks_before_due,
          COUNT(*) AS gifts_received
        FROM purchases pu
        JOIN items i ON pu.item_id = i.id
        JOIN registries r ON i.registry_id = r.id
        JOIN profiles p ON r.owner_id = p.id
        WHERE pu.status = 'confirmed'
        AND p.due_date IS NOT NULL AND p.due_date > pu.confirmed_at
        GROUP BY weeks_before_due
        HAVING FLOOR(EXTRACT(EPOCH FROM (p.due_date - pu.confirmed_at)) / (7 * 86400))::int BETWEEN 0 AND 40
        ORDER BY weeks_before_due DESC
      ) d
    ),
    'avg_first_item_week', (
      SELECT ROUND(AVG(weeks_before)::numeric, 1)
      FROM (
        SELECT FLOOR(EXTRACT(EPOCH FROM (p.due_date - MIN(i.created_at))) / (7 * 86400)) AS weeks_before
        FROM items i
        JOIN registries r ON i.registry_id = r.id
        JOIN profiles p ON r.owner_id = p.id
        WHERE p.due_date IS NOT NULL
        GROUP BY r.owner_id, p.due_date
        HAVING MIN(i.created_at) < p.due_date
      ) sub
    ),
    'due_date_distribution', (
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT
          to_char(due_date, 'YYYY-MM') AS month,
          COUNT(*) AS user_count
        FROM profiles
        WHERE due_date IS NOT NULL
        GROUP BY month
        ORDER BY month
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
