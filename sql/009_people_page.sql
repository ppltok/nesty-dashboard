-- 009: People page — per-user aggregated data for CRM-like view

CREATE OR REPLACE FUNCTION get_people_list()
RETURNS JSON AS $$
DECLARE
  result JSON;
  test_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO test_ids FROM profiles WHERE email IN ('tom@ppltok.com');
  IF test_ids IS NULL THEN test_ids := '{}'; END IF;

  WITH user_data AS (
    SELECT
      p.id,
      p.email,
      COALESCE(NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), p.email) AS display_name,
      p.first_name,
      p.last_name,
      p.due_date,
      p.is_first_time_parent,
      p.feeling,
      p.onboarding_completed,
      p.email_notifications,
      p.marketing_emails,
      p.created_at AS signed_up_at,
      r.id AS registry_id,
      r.slug AS registry_slug,
      r.title AS registry_title,
      COALESCE(item_agg.item_count, 0) AS item_count,
      COALESCE(item_agg.registry_value, 0) AS registry_value,
      COALESCE(item_agg.gifts_received, 0) AS gifts_received,
      COALESCE(item_agg.gift_value, 0) AS gift_value,
      COALESCE(item_agg.total_wanted, 0) AS total_wanted,
      COALESCE(item_agg.total_received, 0) AS total_received,
      COALESCE(purchase_agg.unique_givers, 0) AS unique_givers,
      CASE
        WHEN p.due_date IS NOT NULL AND p.due_date > CURRENT_DATE
        THEN 40 - FLOOR(EXTRACT(EPOCH FROM (p.due_date::timestamp - CURRENT_DATE::timestamp)) / (7 * 86400))::int
        WHEN p.due_date IS NOT NULL AND p.due_date <= CURRENT_DATE
        THEN 40 + FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE::timestamp - p.due_date::timestamp)) / (7 * 86400))::int
        ELSE NULL
      END AS pregnancy_week,
      CASE
        WHEN COALESCE(item_agg.total_wanted, 0) > 0
        THEN ROUND((COALESCE(item_agg.total_received, 0)::numeric / item_agg.total_wanted::numeric) * 100, 1)
        ELSE 0
      END AS completion_pct,
      item_agg.top_items,
      item_agg.last_item_at
    FROM profiles p
    LEFT JOIN registries r ON r.owner_id = p.id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) AS item_count,
        COALESCE(SUM(i.price * i.quantity), 0) AS registry_value,
        COALESCE(SUM(i.quantity_received), 0) AS gifts_received,
        COALESCE(SUM(i.price * i.quantity_received), 0) AS gift_value,
        SUM(i.quantity) AS total_wanted,
        SUM(i.quantity_received) AS total_received,
        MAX(i.created_at) AS last_item_at,
        (
          SELECT json_agg(row_to_json(t))
          FROM (
            SELECT i2.name, i2.price, i2.category, i2.store_name,
                   i2.quantity, i2.quantity_received, i2.image_url, i2.original_url
            FROM items i2
            WHERE i2.registry_id = r.id
            ORDER BY i2.price DESC
            LIMIT 5
          ) t
        ) AS top_items
      FROM items i
      WHERE i.registry_id = r.id
    ) item_agg ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT pu.buyer_email) AS unique_givers
      FROM purchases pu
      JOIN items i ON pu.item_id = i.id
      WHERE i.registry_id = r.id AND pu.status = 'confirmed'
    ) purchase_agg ON true
    WHERE p.id != ALL(test_ids)
  )
  SELECT json_build_object(
    'summary', json_build_object(
      'total_users', (SELECT COUNT(*) FROM user_data),
      'users_with_items', (SELECT COUNT(*) FROM user_data WHERE item_count > 0),
      'users_with_gifts', (SELECT COUNT(*) FROM user_data WHERE gifts_received > 0),
      'avg_registry_value', (SELECT COALESCE(ROUND(AVG(registry_value)::numeric, 0), 0) FROM user_data WHERE item_count > 0),
      'avg_items', (SELECT COALESCE(ROUND(AVG(item_count)::numeric, 1), 0) FROM user_data WHERE item_count > 0),
      'avg_completion', (SELECT COALESCE(ROUND(AVG(completion_pct)::numeric, 1), 0) FROM user_data WHERE item_count > 0)
    ),
    'users', (SELECT COALESCE(json_agg(row_to_json(u) ORDER BY u.signed_up_at DESC), '[]'::json) FROM user_data u)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
