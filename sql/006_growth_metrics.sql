-- ============================================
-- GROWTH METRICS RPC FUNCTION
-- ============================================
-- Adds activation rate, share rate, extension install rate,
-- and 7-day retention metrics for the Growth page.
-- Excludes test account (tom@ppltok.com).

CREATE OR REPLACE FUNCTION get_growth_metrics(period_start timestamptz, period_end timestamptz)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  test_owner_id uuid;
BEGIN
  -- Get test account ID to exclude
  SELECT id INTO test_owner_id FROM profiles WHERE email = 'tom@ppltok.com' LIMIT 1;

  SELECT jsonb_build_object(
    -- Activation rate: users who added first item within 7 days of signup
    'activation_rate', COALESCE((
      SELECT ROUND(
        COUNT(*) FILTER (WHERE first_item_delay <= 7)::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
      )
      FROM (
        SELECT
          p.id,
          EXTRACT(DAY FROM (MIN(i.created_at) - p.created_at)) AS first_item_delay
        FROM profiles p
        JOIN registries r ON r.owner_id = p.id
        JOIN items i ON i.registry_id = r.id
        WHERE p.id IS DISTINCT FROM test_owner_id
          AND p.created_at BETWEEN period_start AND period_end
        GROUP BY p.id, p.created_at
      ) sub
    ), 0),

    -- Activated users count (added item within 7 days)
    'activated_users', COALESCE((
      SELECT COUNT(*)
      FROM (
        SELECT p.id
        FROM profiles p
        JOIN registries r ON r.owner_id = p.id
        JOIN items i ON i.registry_id = r.id
        WHERE p.id IS DISTINCT FROM test_owner_id
          AND p.created_at BETWEEN period_start AND period_end
        GROUP BY p.id, p.created_at
        HAVING EXTRACT(DAY FROM (MIN(i.created_at) - p.created_at)) <= 7
      ) sub
    ), 0),

    -- Share rate: registries that have been shared (have a non-null slug used in a page view)
    -- Approximation: registries where owner completed onboarding (they get a shareable link)
    'share_rate', COALESCE((
      SELECT ROUND(
        COUNT(*) FILTER (WHERE p.onboarding_completed = true)::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
      )
      FROM profiles p
      WHERE p.id IS DISTINCT FROM test_owner_id
        AND p.created_at BETWEEN period_start AND period_end
    ), 0),

    -- Extension install rate: users who added at least one item via extension
    'extension_install_rate', COALESCE((
      SELECT ROUND(
        COUNT(DISTINCT r.owner_id) FILTER (WHERE i.store_name NOT IN ('ידני', 'manual'))::numeric /
        NULLIF(COUNT(DISTINCT r.owner_id), 0) * 100, 1
      )
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      JOIN profiles p ON p.id = r.owner_id
      WHERE r.owner_id IS DISTINCT FROM test_owner_id
        AND p.created_at BETWEEN period_start AND period_end
    ), 0),

    -- Extension users in period
    'extension_users_period', COALESCE((
      SELECT COUNT(DISTINCT r.owner_id)
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      JOIN profiles p ON p.id = r.owner_id
      WHERE r.owner_id IS DISTINCT FROM test_owner_id
        AND i.store_name NOT IN ('ידני', 'manual')
        AND p.created_at BETWEEN period_start AND period_end
    ), 0),

    -- 7-day retention: users who added an item 7+ days after signup
    'retention_7d', COALESCE((
      SELECT ROUND(
        COUNT(*) FILTER (WHERE has_activity_after_7d)::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
      )
      FROM (
        SELECT
          p.id,
          EXISTS (
            SELECT 1 FROM items i
            JOIN registries r ON r.id = i.registry_id
            WHERE r.owner_id = p.id
              AND i.created_at >= p.created_at + interval '7 days'
          ) AS has_activity_after_7d
        FROM profiles p
        WHERE p.id IS DISTINCT FROM test_owner_id
          AND p.created_at BETWEEN period_start AND period_end
          -- Only include users who signed up at least 7 days ago
          AND p.created_at <= NOW() - interval '7 days'
      ) sub
    ), 0),

    -- Avg time to first item (in hours)
    'avg_hours_to_first_item', COALESCE((
      SELECT ROUND(AVG(
        EXTRACT(EPOCH FROM (first_item_at - signup_at)) / 3600
      )::numeric, 1)
      FROM (
        SELECT
          p.created_at AS signup_at,
          MIN(i.created_at) AS first_item_at
        FROM profiles p
        JOIN registries r ON r.owner_id = p.id
        JOIN items i ON i.registry_id = r.id
        WHERE p.id IS DISTINCT FROM test_owner_id
          AND p.created_at BETWEEN period_start AND period_end
        GROUP BY p.id, p.created_at
      ) sub
    ), 0),

    -- Total signups in period
    'total_signups_period', COALESCE((
      SELECT COUNT(*)
      FROM profiles p
      WHERE p.id IS DISTINCT FROM test_owner_id
        AND p.created_at BETWEEN period_start AND period_end
    ), 0),

    -- Onboarded in period
    'onboarded_period', COALESCE((
      SELECT COUNT(*)
      FROM profiles p
      WHERE p.id IS DISTINCT FROM test_owner_id
        AND p.onboarding_completed = true
        AND p.created_at BETWEEN period_start AND period_end
    ), 0)

  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users (dashboard admins)
GRANT EXECUTE ON FUNCTION get_growth_metrics(timestamptz, timestamptz) TO authenticated;
