-- User Journey Timing Metrics
-- Computes median/average days between key user milestones
-- and pregnancy-week distributions for sharing & gifting

CREATE OR REPLACE FUNCTION get_user_journey_timing()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH test_emails AS (
    SELECT unnest(ARRAY['tom@ppltok.com']) AS email
  ),

  -- Base: all non-test users with onboarding completed
  users AS (
    SELECT
      p.id,
      p.email,
      p.created_at AS signup_at,
      p.due_date,
      p.onboarding_completed
    FROM profiles p
    WHERE p.email NOT IN (SELECT email FROM test_emails)
  ),

  -- First checklist interaction per user
  first_checklist AS (
    SELECT
      cp.user_id,
      MIN(cp.created_at) AS first_checklist_at
    FROM checklist_preferences cp
    JOIN users u ON u.id = cp.user_id
    GROUP BY cp.user_id
  ),

  -- First item added per user (via registry)
  first_item AS (
    SELECT
      r.owner_id AS user_id,
      MIN(i.created_at) AS first_item_at
    FROM items i
    JOIN registries r ON r.id = i.registry_id
    JOIN users u ON u.id = r.owner_id
    GROUP BY r.owner_id
  ),

  -- First share: proxy = registry has title AND at least one item (user completed setup for sharing)
  first_share AS (
    SELECT
      r.owner_id AS user_id,
      r.created_at AS shared_at,
      u.due_date
    FROM registries r
    JOIN users u ON u.id = r.owner_id
    WHERE r.title IS NOT NULL
      AND r.title != ''
      AND EXISTS (SELECT 1 FROM items i WHERE i.registry_id = r.id)
  ),

  -- First gift received per user
  first_gift AS (
    SELECT
      r.owner_id AS user_id,
      MIN(COALESCE(pu.confirmed_at, pu.created_at)) AS first_gift_at,
      u.due_date
    FROM purchases pu
    JOIN items i ON i.id = pu.item_id
    JOIN registries r ON r.id = i.registry_id
    JOIN users u ON u.id = r.owner_id
    WHERE pu.status = 'confirmed'
    GROUP BY r.owner_id, u.due_date
  ),

  -- === TIMING METRICS (days between milestones) ===

  signup_to_checklist AS (
    SELECT
      EXTRACT(EPOCH FROM (fc.first_checklist_at - u.signup_at)) / 86400.0 AS days
    FROM users u
    JOIN first_checklist fc ON fc.user_id = u.id
  ),

  signup_to_first_item AS (
    SELECT
      EXTRACT(EPOCH FROM (fi.first_item_at - u.signup_at)) / 86400.0 AS days
    FROM users u
    JOIN first_item fi ON fi.user_id = u.id
  ),

  checklist_to_first_item AS (
    SELECT
      EXTRACT(EPOCH FROM (fi.first_item_at - fc.first_checklist_at)) / 86400.0 AS days
    FROM first_checklist fc
    JOIN first_item fi ON fi.user_id = fc.user_id
  ),

  -- === PREGNANCY WEEK DISTRIBUTIONS ===

  -- When do users share their registry (by pregnancy week)?
  share_by_week AS (
    SELECT
      40 - EXTRACT(DAY FROM (fs.due_date - fs.shared_at::date)) / 7 AS pregnancy_week,
      COUNT(*) AS users_shared
    FROM first_share fs
    WHERE fs.due_date IS NOT NULL
    GROUP BY pregnancy_week
    HAVING 40 - EXTRACT(DAY FROM (fs.due_date - fs.shared_at::date)) / 7 BETWEEN 0 AND 42
    ORDER BY pregnancy_week
  ),

  -- When do users receive first gift (by pregnancy week)?
  gift_by_week AS (
    SELECT
      40 - EXTRACT(DAY FROM (fg.due_date - fg.first_gift_at::date)) / 7 AS pregnancy_week,
      COUNT(*) AS users_gifted
    FROM first_gift fg
    WHERE fg.due_date IS NOT NULL
    GROUP BY pregnancy_week
    HAVING 40 - EXTRACT(DAY FROM (fg.due_date - fg.first_gift_at::date)) / 7 BETWEEN 0 AND 42
    ORDER BY pregnancy_week
  ),

  -- === AGGREGATE STATS ===

  timing_stats AS (
    SELECT
      -- Signup → Checklist
      (SELECT ROUND(AVG(days)::numeric, 1) FROM signup_to_checklist) AS avg_days_signup_to_checklist,
      (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days)::numeric, 1) FROM signup_to_checklist) AS median_days_signup_to_checklist,
      (SELECT COUNT(*) FROM signup_to_checklist) AS users_with_checklist,

      -- Signup → First Item
      (SELECT ROUND(AVG(days)::numeric, 1) FROM signup_to_first_item) AS avg_days_signup_to_first_item,
      (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days)::numeric, 1) FROM signup_to_first_item) AS median_days_signup_to_first_item,
      (SELECT COUNT(*) FROM signup_to_first_item) AS users_with_items,

      -- Checklist → First Item
      (SELECT ROUND(AVG(days)::numeric, 1) FROM checklist_to_first_item) AS avg_days_checklist_to_first_item,
      (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days)::numeric, 1) FROM checklist_to_first_item) AS median_days_checklist_to_first_item,
      (SELECT COUNT(*) FROM checklist_to_first_item) AS users_checklist_then_item,

      -- Total users for context
      (SELECT COUNT(*) FROM users) AS total_users
  ),

  -- Days-to-action distribution buckets (for histogram)
  signup_to_checklist_dist AS (
    SELECT
      CASE
        WHEN days < 0.042 THEN 'Same session'
        WHEN days < 1 THEN 'Same day'
        WHEN days < 3 THEN '1-2 days'
        WHEN days < 7 THEN '3-6 days'
        WHEN days < 14 THEN '1-2 weeks'
        WHEN days < 30 THEN '2-4 weeks'
        ELSE '30+ days'
      END AS bucket,
      CASE
        WHEN days < 0.042 THEN 1
        WHEN days < 1 THEN 2
        WHEN days < 3 THEN 3
        WHEN days < 7 THEN 4
        WHEN days < 14 THEN 5
        WHEN days < 30 THEN 6
        ELSE 7
      END AS bucket_order,
      COUNT(*) AS users
    FROM signup_to_checklist
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  ),

  signup_to_item_dist AS (
    SELECT
      CASE
        WHEN days < 0.042 THEN 'Same session'
        WHEN days < 1 THEN 'Same day'
        WHEN days < 3 THEN '1-2 days'
        WHEN days < 7 THEN '3-6 days'
        WHEN days < 14 THEN '1-2 weeks'
        WHEN days < 30 THEN '2-4 weeks'
        ELSE '30+ days'
      END AS bucket,
      CASE
        WHEN days < 0.042 THEN 1
        WHEN days < 1 THEN 2
        WHEN days < 3 THEN 3
        WHEN days < 7 THEN 4
        WHEN days < 14 THEN 5
        WHEN days < 30 THEN 6
        ELSE 7
      END AS bucket_order,
      COUNT(*) AS users
    FROM signup_to_first_item
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  )

  SELECT jsonb_build_object(
    'timing', (SELECT row_to_json(timing_stats)::jsonb FROM timing_stats),
    'signup_to_checklist_distribution', (SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', bucket, 'users', users) ORDER BY bucket_order), '[]'::jsonb) FROM signup_to_checklist_dist),
    'signup_to_item_distribution', (SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', bucket, 'users', users) ORDER BY bucket_order), '[]'::jsonb) FROM signup_to_item_dist),
    'share_by_pregnancy_week', (SELECT COALESCE(jsonb_agg(jsonb_build_object('pregnancy_week', pregnancy_week, 'users', users_shared) ORDER BY pregnancy_week), '[]'::jsonb) FROM share_by_week),
    'gift_by_pregnancy_week', (SELECT COALESCE(jsonb_agg(jsonb_build_object('pregnancy_week', pregnancy_week, 'users', users_gifted) ORDER BY pregnancy_week), '[]'::jsonb) FROM gift_by_week)
  ) INTO result;

  RETURN result;
END;
$$;
