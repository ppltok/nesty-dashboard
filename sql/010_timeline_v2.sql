-- 010: Enhanced pregnancy timeline with signup week, share week, actionable insights

CREATE OR REPLACE FUNCTION get_pregnancy_timeline()
RETURNS JSON AS $$
DECLARE
  result JSON;
  test_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO test_ids FROM profiles WHERE email IN ('tom@ppltok.com');
  IF test_ids IS NULL THEN test_ids := '{}'; END IF;

  SELECT json_build_object(
    -- Items added by pregnancy week (weeks before due)
    'items_by_week', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM (
        SELECT
          40 - FLOOR(EXTRACT(EPOCH FROM (pr.due_date - i.created_at)) / (7 * 86400))::int AS pregnancy_week,
          COUNT(*) AS items_added
        FROM items i
        JOIN registries r ON i.registry_id = r.id
        JOIN profiles pr ON r.owner_id = pr.id
        WHERE pr.due_date IS NOT NULL
          AND pr.due_date > i.created_at
          AND r.owner_id != ALL(test_ids)
        GROUP BY pregnancy_week
        HAVING (40 - FLOOR(EXTRACT(EPOCH FROM (pr.due_date - i.created_at)) / (7 * 86400))::int) BETWEEN 0 AND 42
        ORDER BY pregnancy_week
      ) d
    ),

    -- Gifts received by pregnancy week
    'gifts_by_week', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM (
        SELECT
          40 - FLOOR(EXTRACT(EPOCH FROM (pr.due_date - pu.confirmed_at)) / (7 * 86400))::int AS pregnancy_week,
          COUNT(*) AS gifts_received
        FROM purchases pu
        JOIN items i ON pu.item_id = i.id
        JOIN registries r ON i.registry_id = r.id
        JOIN profiles pr ON r.owner_id = pr.id
        WHERE pu.status = 'confirmed'
          AND pr.due_date IS NOT NULL
          AND pr.due_date > pu.confirmed_at
          AND r.owner_id != ALL(test_ids)
        GROUP BY pregnancy_week
        HAVING (40 - FLOOR(EXTRACT(EPOCH FROM (pr.due_date - pu.confirmed_at)) / (7 * 86400))::int) BETWEEN 0 AND 42
        ORDER BY pregnancy_week
      ) d
    ),

    -- Signups by pregnancy week (what week do users typically sign up?)
    'signups_by_week', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM (
        SELECT
          40 - FLOOR(EXTRACT(EPOCH FROM (pr.due_date - pr.created_at)) / (7 * 86400))::int AS pregnancy_week,
          COUNT(*) AS signups
        FROM profiles pr
        WHERE pr.due_date IS NOT NULL
          AND pr.due_date > pr.created_at
          AND pr.id != ALL(test_ids)
        GROUP BY pregnancy_week
        HAVING (40 - FLOOR(EXTRACT(EPOCH FROM (pr.due_date - pr.created_at)) / (7 * 86400))::int) BETWEEN 0 AND 42
        ORDER BY pregnancy_week
      ) d
    ),

    -- Key milestones (averages)
    'milestones', json_build_object(
      -- Average pregnancy week at signup
      'avg_signup_week', (
        SELECT ROUND(AVG(40 - FLOOR(EXTRACT(EPOCH FROM (pr.due_date - pr.created_at)) / (7 * 86400)))::numeric, 1)
        FROM profiles pr
        WHERE pr.due_date IS NOT NULL AND pr.due_date > pr.created_at AND pr.id != ALL(test_ids)
      ),
      -- Average pregnancy week at first item added
      'avg_first_item_week', (
        SELECT ROUND(AVG(pw)::numeric, 1) FROM (
          SELECT 40 - FLOOR(EXTRACT(EPOCH FROM (pr.due_date - MIN(i.created_at))) / (7 * 86400)) AS pw
          FROM items i JOIN registries r ON i.registry_id = r.id JOIN profiles pr ON r.owner_id = pr.id
          WHERE pr.due_date IS NOT NULL AND r.owner_id != ALL(test_ids)
          GROUP BY r.owner_id, pr.due_date
          HAVING pr.due_date > MIN(i.created_at)
        ) sub
      ),
      -- Average pregnancy week when first gift arrives
      'avg_first_gift_week', (
        SELECT ROUND(AVG(pw)::numeric, 1) FROM (
          SELECT 40 - FLOOR(EXTRACT(EPOCH FROM (pr.due_date - MIN(pu.confirmed_at))) / (7 * 86400)) AS pw
          FROM purchases pu JOIN items i ON pu.item_id = i.id JOIN registries r ON i.registry_id = r.id JOIN profiles pr ON r.owner_id = pr.id
          WHERE pu.status = 'confirmed' AND pr.due_date IS NOT NULL AND r.owner_id != ALL(test_ids)
          GROUP BY r.owner_id, pr.due_date
          HAVING pr.due_date > MIN(pu.confirmed_at)
        ) sub
      ),
      -- Recommended share week (week when most gifts start arriving - 2 weeks)
      'recommended_share_week', (
        SELECT CASE WHEN MIN(pregnancy_week) IS NOT NULL THEN GREATEST(MIN(pregnancy_week) - 2, 12) ELSE NULL END
        FROM (
          SELECT 40 - FLOOR(EXTRACT(EPOCH FROM (pr.due_date - pu.confirmed_at)) / (7 * 86400))::int AS pregnancy_week
          FROM purchases pu JOIN items i ON pu.item_id = i.id JOIN registries r ON i.registry_id = r.id JOIN profiles pr ON r.owner_id = pr.id
          WHERE pu.status = 'confirmed' AND pr.due_date IS NOT NULL AND pr.due_date > pu.confirmed_at AND r.owner_id != ALL(test_ids)
        ) sub
      ),
      -- Users with due date
      'users_with_due_date', (
        SELECT COUNT(*) FROM profiles WHERE due_date IS NOT NULL AND id != ALL(test_ids)
      )
    ),

    -- Due date distribution by month
    'due_date_distribution', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM (
        SELECT to_char(due_date, 'YYYY-MM') AS month, COUNT(*) AS user_count
        FROM profiles WHERE due_date IS NOT NULL AND id != ALL(test_ids)
        GROUP BY month ORDER BY month
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
