-- ============================================
-- DASHBOARD ACCESS TABLE
-- ============================================
-- Controls who can access the internal dashboard.
-- Only emails in this table can sign in.
-- Run this FIRST before any other dashboard SQL.

CREATE TABLE IF NOT EXISTS dashboard_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dashboard_access ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read the access list (to check their own access)
CREATE POLICY "Authenticated users can read access list"
  ON dashboard_access FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage access"
  ON dashboard_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_access
      WHERE email = auth.jwt()->>'email'
      AND role = 'admin'
    )
  );

-- Index for fast email lookups during auth
CREATE INDEX IF NOT EXISTS idx_dashboard_access_email ON dashboard_access(email);

COMMENT ON TABLE dashboard_access IS 'Email allowlist for internal dashboard access';
