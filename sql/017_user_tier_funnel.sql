-- 017: User-tier funnel + behavioral flag matrix
--
-- Implements the 5-tier user funnel + 5 orthogonal behavioral flags from
-- Nesty-Obsidian/Product/User-Tiers.md. Each user has exactly one tier (depth
-- nested) and any combination of flags.
--
-- Tiers (strictly nested):
--   1 user        — signed up
--   2 started     — ≥1 item
--   3 active      — ≥2 items
--   4 super       — ≥5 items
--   5 champion    — ≥1 item received (quantity_received > 0)
--
-- Flags (orthogonal):
--   has_coparent     — any registry has partner_id IS NOT NULL
--   sharer           — has explicit share_clicked event OR inbound visit with
--                      share-link UTM. Today only the UTM path is wired; the
--                      share_events table is a planned follow-up.
--   network_reached  — ≥1 confirmed purchase where buyer_email differs from
--                      owner AND partner emails (case-insensitive)
--   self_fulfiller   — ≥1 confirmed purchase where buyer_email matches owner
--                      OR partner email
--   gift_received    — ≥1 item with quantity_received > 0 backed by a purchase
--                      from external buyer

-- ---------------------------------------------------------------------------
-- Per-user segments — returns one row per user with their tier + flag set.
-- Heavy query, but cached as a materialized view below.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_segments()
RETURNS TABLE (
  user_id        UUID,
  email          TEXT,
  created_at     TIMESTAMPTZ,
  tier           TEXT,
  tier_order     INT,
  item_count     INT,
  received_count INT,
  has_coparent   BOOLEAN,
  sharer         BOOLEAN,
  network_reached BOOLEAN,
  self_fulfiller BOOLEAN,
  gift_received  BOOLEAN
) AS $$
DECLARE
  test_emails TEXT[] := ARRAY[
    'tom@ppltok.com',
    'ortalgoldi@gmail.com',
    'kehalim.michael@gmail.com',
    'michael.kehalim@gmail.com'
  ];
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      p.id        AS user_id,
      p.email     AS email,
      p.created_at,
      COALESCE(item_agg.item_count, 0)::int AS item_count,
      COALESCE(item_agg.received_count, 0)::int AS received_count,
      EXISTS (
        SELECT 1 FROM registries r
        WHERE r.owner_id = p.id AND r.partner_id IS NOT NULL
      ) AS has_coparent,
      -- Sharer: today inferred only from utm_source flag on the profile.
      -- Once a share_events table exists this should also check for any
      -- explicit share_clicked events for this user.
      (LOWER(COALESCE(p.utm_source, '')) IN ('share', 'share_link', 'whatsapp_share')) AS sharer,
      EXISTS (
        SELECT 1
        FROM registries r
        JOIN items i ON i.registry_id = r.id
        JOIN purchases pu ON pu.item_id = i.id
        LEFT JOIN profiles partner ON partner.id = r.partner_id
        WHERE r.owner_id = p.id
          AND pu.status = 'confirmed'
          AND LOWER(pu.buyer_email) <> LOWER(p.email)
          AND (partner.email IS NULL OR LOWER(pu.buyer_email) <> LOWER(partner.email))
      ) AS network_reached,
      EXISTS (
        SELECT 1
        FROM registries r
        JOIN items i ON i.registry_id = r.id
        JOIN purchases pu ON pu.item_id = i.id
        LEFT JOIN profiles partner ON partner.id = r.partner_id
        WHERE r.owner_id = p.id
          AND pu.status = 'confirmed'
          AND (
            LOWER(pu.buyer_email) = LOWER(p.email)
            OR (partner.email IS NOT NULL AND LOWER(pu.buyer_email) = LOWER(partner.email))
          )
      ) AS self_fulfiller,
      EXISTS (
        SELECT 1
        FROM registries r
        JOIN items i ON i.registry_id = r.id
        JOIN purchases pu ON pu.item_id = i.id
        LEFT JOIN profiles partner ON partner.id = r.partner_id
        WHERE r.owner_id = p.id
          AND pu.status = 'confirmed'
          AND i.quantity_received > 0
          AND LOWER(pu.buyer_email) <> LOWER(p.email)
          AND (partner.email IS NULL OR LOWER(pu.buyer_email) <> LOWER(partner.email))
      ) AS gift_received
    FROM profiles p
    LEFT JOIN LATERAL (
      SELECT
        COUNT(i.id) AS item_count,
        COALESCE(SUM(i.quantity_received), 0) AS received_count
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      WHERE r.owner_id = p.id
    ) item_agg ON true
    WHERE p.email IS NULL OR p.email <> ALL(test_emails)
  )
  SELECT
    b.user_id,
    b.email,
    b.created_at,
    CASE
      WHEN b.received_count >= 1 THEN 'champion'
      WHEN b.item_count >= 5     THEN 'super'
      WHEN b.item_count >= 2     THEN 'active'
      WHEN b.item_count >= 1     THEN 'started'
      ELSE 'user'
    END AS tier,
    CASE
      WHEN b.received_count >= 1 THEN 5
      WHEN b.item_count >= 5     THEN 4
      WHEN b.item_count >= 2     THEN 3
      WHEN b.item_count >= 1     THEN 2
      ELSE 1
    END AS tier_order,
    b.item_count,
    b.received_count,
    b.has_coparent,
    b.sharer,
    b.network_reached,
    b.self_fulfiller,
    b.gift_received
  FROM base b;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- Aggregate RPC for the dashboard Funnel page — single round-trip,
-- returns the 5-tier funnel + flag prevalence + a flag-by-tier matrix.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_tier_funnel()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH segs AS (
    SELECT * FROM get_user_segments()
  ),
  tier_counts AS (
    SELECT
      tier,
      tier_order,
      COUNT(*) AS users
    FROM segs
    GROUP BY tier, tier_order
  ),
  totals AS (
    SELECT COUNT(*) AS total FROM segs
  ),
  flag_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE has_coparent)    AS has_coparent,
      COUNT(*) FILTER (WHERE sharer)          AS sharer,
      COUNT(*) FILTER (WHERE network_reached) AS network_reached,
      COUNT(*) FILTER (WHERE self_fulfiller)  AS self_fulfiller,
      COUNT(*) FILTER (WHERE gift_received)   AS gift_received
    FROM segs
  ),
  -- Flag prevalence per tier — for the matrix view
  flag_by_tier AS (
    SELECT
      tier,
      tier_order,
      COUNT(*)::int AS users,
      COUNT(*) FILTER (WHERE has_coparent)::int    AS has_coparent,
      COUNT(*) FILTER (WHERE sharer)::int          AS sharer,
      COUNT(*) FILTER (WHERE network_reached)::int AS network_reached,
      COUNT(*) FILTER (WHERE self_fulfiller)::int  AS self_fulfiller,
      COUNT(*) FILTER (WHERE gift_received)::int   AS gift_received
    FROM segs
    GROUP BY tier, tier_order
  )
  SELECT json_build_object(
    'total_users', (SELECT total FROM totals),
    'tiers', (
      SELECT json_agg(json_build_object(
        'tier', tier,
        'tier_order', tier_order,
        'users', users
      ) ORDER BY tier_order)
      FROM tier_counts
    ),
    'flags_overall', (
      SELECT json_build_object(
        'has_coparent', has_coparent,
        'sharer', sharer,
        'network_reached', network_reached,
        'self_fulfiller', self_fulfiller,
        'gift_received', gift_received
      )
      FROM flag_counts
    ),
    'flag_by_tier', (
      SELECT json_agg(json_build_object(
        'tier', tier,
        'tier_order', tier_order,
        'users', users,
        'has_coparent', has_coparent,
        'sharer', sharer,
        'network_reached', network_reached,
        'self_fulfiller', self_fulfiller,
        'gift_received', gift_received
      ) ORDER BY tier_order)
      FROM flag_by_tier
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_user_segments() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tier_funnel() TO authenticated;
