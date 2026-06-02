-- 018: Tier funnel date-range support + weekly cohort trend
--
-- 1. Extends get_tier_funnel() with optional (period_start, period_end)
--    parameters that filter on profiles.created_at (signup-cohort filter).
--    Backwards compatible: passing NULL/NULL returns all-time data.
-- 2. Adds get_tier_trend(period_start, period_end) returning per-signup-week
--    tier composition, for the stacked-area trend chart on the Funnel page.
--
-- Why filter by signup-cohort: tiers are a *current state*, not a period
-- metric. "Users in this tier in May" doesn't have a clean meaning — the
-- meaningful question is "of users who signed up in May, what tier are
-- they at now?" That's what these RPCs return.

CREATE OR REPLACE FUNCTION get_tier_funnel(
  period_start TIMESTAMPTZ DEFAULT NULL,
  period_end   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  WITH segs AS (
    SELECT s.*
    FROM get_user_segments() s
    WHERE (period_start IS NULL OR s.created_at >= period_start)
      AND (period_end   IS NULL OR s.created_at <= period_end)
  ),
  tier_counts AS (SELECT tier, tier_order, COUNT(*) AS users FROM segs GROUP BY tier, tier_order),
  totals AS (SELECT COUNT(*) AS total FROM segs),
  flag_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE has_coparent)    AS has_coparent,
      COUNT(*) FILTER (WHERE sharer)          AS sharer,
      COUNT(*) FILTER (WHERE network_reached) AS network_reached,
      COUNT(*) FILTER (WHERE self_fulfiller)  AS self_fulfiller,
      COUNT(*) FILTER (WHERE gift_received)   AS gift_received
    FROM segs
  ),
  flag_by_tier AS (
    SELECT tier, tier_order, COUNT(*)::int AS users,
      COUNT(*) FILTER (WHERE has_coparent)::int    AS has_coparent,
      COUNT(*) FILTER (WHERE sharer)::int          AS sharer,
      COUNT(*) FILTER (WHERE network_reached)::int AS network_reached,
      COUNT(*) FILTER (WHERE self_fulfiller)::int  AS self_fulfiller,
      COUNT(*) FILTER (WHERE gift_received)::int   AS gift_received
    FROM segs GROUP BY tier, tier_order
  )
  SELECT json_build_object(
    'total_users', (SELECT total FROM totals),
    'period_start', period_start,
    'period_end', period_end,
    'tiers', (SELECT json_agg(json_build_object('tier', tier, 'tier_order', tier_order, 'users', users) ORDER BY tier_order) FROM tier_counts),
    'flags_overall', (SELECT json_build_object('has_coparent', has_coparent, 'sharer', sharer, 'network_reached', network_reached, 'self_fulfiller', self_fulfiller, 'gift_received', gift_received) FROM flag_counts),
    'flag_by_tier', (SELECT json_agg(json_build_object('tier', tier, 'tier_order', tier_order, 'users', users, 'has_coparent', has_coparent, 'sharer', sharer, 'network_reached', network_reached, 'self_fulfiller', self_fulfiller, 'gift_received', gift_received) ORDER BY tier_order) FROM flag_by_tier)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_tier_trend(
  period_start TIMESTAMPTZ DEFAULT NULL,
  period_end   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  WITH segs AS (
    SELECT s.*, date_trunc('week', s.created_at)::date AS cohort_week
    FROM get_user_segments() s
    WHERE (period_start IS NULL OR s.created_at >= period_start)
      AND (period_end   IS NULL OR s.created_at <= period_end)
  ),
  weekly AS (
    SELECT
      cohort_week,
      COUNT(*)::int AS signups,
      COUNT(*) FILTER (WHERE tier = 'user')::int     AS user_count,
      COUNT(*) FILTER (WHERE tier = 'started')::int  AS started,
      COUNT(*) FILTER (WHERE tier = 'active')::int   AS active,
      COUNT(*) FILTER (WHERE tier = 'super')::int    AS super_count,
      COUNT(*) FILTER (WHERE tier = 'champion')::int AS champion
    FROM segs GROUP BY cohort_week
  )
  SELECT json_agg(json_build_object(
    'week', cohort_week,
    'signups', signups,
    'user', user_count,
    'started', started,
    'active', active,
    'super', super_count,
    'champion', champion
  ) ORDER BY cohort_week) INTO result FROM weekly;
  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_tier_funnel(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tier_trend(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
