-- 008: Fix platform_gmv consistency + add previous-period comparison for trends
-- platform_gmv now uses price * quantity (total wishlist value) to match avg_registry_value
-- Adds prev_* fields for period-over-period trend indicators

CREATE OR REPLACE FUNCTION get_dashboard_overview(
  period_start TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  period_end TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  test_ids UUID[];
  period_length INTERVAL;
  prev_start TIMESTAMPTZ;
  prev_end TIMESTAMPTZ;
BEGIN
  SELECT array_agg(id) INTO test_ids FROM profiles WHERE email IN ('tom@ppltok.com');
  IF test_ids IS NULL THEN test_ids := '{}'; END IF;

  -- Calculate previous period of same length
  period_length := period_end - period_start;
  prev_end := period_start;
  prev_start := period_start - period_length;

  SELECT json_build_object(
    -- Current period metrics
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
    -- FIXED: platform_gmv now uses price * quantity (wishlist value) to be consistent with avg_registry_value
    'platform_gmv', (
      SELECT COALESCE(SUM(i.price * i.quantity), 0)
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
    ),

    -- Previous period metrics for trend comparison
    'prev_total_users', (SELECT COUNT(*) FROM profiles WHERE created_at <= prev_end AND id != ALL(test_ids)),
    'prev_new_users', (SELECT COUNT(*) FROM profiles WHERE created_at BETWEEN prev_start AND prev_end AND id != ALL(test_ids)),
    'prev_active_registries', (
      SELECT COUNT(DISTINCT r.id)
      FROM registries r JOIN items i ON i.registry_id = r.id
      WHERE i.created_at BETWEEN prev_start AND prev_end
      AND r.owner_id != ALL(test_ids)
    ),
    'prev_new_items', (
      SELECT COUNT(*) FROM items i JOIN registries r ON i.registry_id = r.id
      WHERE i.created_at BETWEEN prev_start AND prev_end AND r.owner_id != ALL(test_ids)
    ),
    'prev_new_gifts', (
      SELECT COUNT(*) FROM purchases p JOIN items i ON p.item_id = i.id JOIN registries r ON i.registry_id = r.id
      WHERE p.status = 'confirmed' AND p.confirmed_at BETWEEN prev_start AND prev_end AND r.owner_id != ALL(test_ids)
    ),
    'prev_platform_gmv', (
      SELECT COALESCE(SUM(i.price * i.quantity), 0)
      FROM items i JOIN registries r ON i.registry_id = r.id
      WHERE i.created_at <= prev_end AND r.owner_id != ALL(test_ids)
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
