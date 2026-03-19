-- ============================================
-- SEED DASHBOARD ACCESS
-- ============================================
-- Add the initial admin user(s).
-- Edit this file to include your team's emails before running.

INSERT INTO dashboard_access (email, display_name, role)
VALUES
  ('tom@ppltok.com', 'Tom', 'admin'),
  ('yaniv.bl@gmail.com', 'Yaniv', 'admin')
ON CONFLICT (email) DO NOTHING;
