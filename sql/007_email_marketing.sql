-- ============================================
-- EMAIL MARKETING INFRASTRUCTURE
-- ============================================
-- Part 1: email_logs table for tracking all outbound emails
-- Part 2: RPC function for dashboard metrics

-- ============================================
-- PART 1: EMAIL LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Who received the email
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Email classification
  email_type TEXT NOT NULL CHECK (email_type IN (
    'confirmation',           -- Gift purchase confirmation
    'nudge_onboarding',       -- Reminder to complete onboarding
    'nudge_first_item',       -- Reminder to add first item
    'nudge_share_registry',   -- Reminder to share registry
    'nudge_incomplete',       -- Reminder for incomplete registry
    'welcome',                -- Welcome email after signup
    'weekly_digest',          -- Weekly activity summary
    'gift_notification',      -- Notify owner someone bought a gift
    'marketing',              -- General marketing/promo
    'price_alert'             -- Price drop notification
  )),

  -- Email content
  subject TEXT,
  template_id TEXT,           -- Reference to email template

  -- Delivery status
  status TEXT DEFAULT 'sent' CHECK (status IN (
    'queued',       -- In send queue
    'sent',         -- Sent to email provider
    'delivered',    -- Confirmed delivered
    'opened',       -- Recipient opened
    'clicked',      -- Recipient clicked a link
    'bounced',      -- Email bounced
    'failed',       -- Send failed
    'unsubscribed'  -- User unsubscribed via this email
  )),

  -- Tracking timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,

  -- Link tracking
  click_url TEXT,             -- Which link was clicked

  -- Provider metadata
  provider TEXT DEFAULT 'supabase',  -- supabase, sendgrid, resend, etc.
  provider_message_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(recipient_user_id);

-- RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Dashboard admins can view all email logs
CREATE POLICY "Dashboard admins can view email logs"
  ON email_logs FOR SELECT
  USING (
    auth.jwt()->>'email' IN (SELECT email FROM dashboard_access)
  );

-- Service role can insert (for Edge Functions / backend)
CREATE POLICY "Service can insert email logs"
  ON email_logs FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE email_logs IS 'Tracks all outbound emails: confirmations, nudges, marketing campaigns';

-- ============================================
-- PART 2: Migrate existing confirmation emails
-- ============================================
-- Backfill email_logs from existing purchases.confirmation_sent_at
INSERT INTO email_logs (recipient_email, recipient_user_id, email_type, subject, status, sent_at)
SELECT
  p.buyer_email,
  NULL,
  'confirmation',
  'Confirm your gift purchase',
  CASE
    WHEN p.status = 'confirmed' THEN 'clicked'
    WHEN p.status = 'expired' THEN 'sent'
    WHEN p.status = 'cancelled' THEN 'sent'
    ELSE 'sent'
  END,
  COALESCE(p.confirmation_sent_at, p.created_at)
FROM purchases p
WHERE p.confirmation_sent_at IS NOT NULL
   OR p.status IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================
-- PART 3: EMAIL METRICS RPC FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_email_metrics(period_start timestamptz, period_end timestamptz)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    -- Total emails sent in period
    'total_sent', COALESCE((
      SELECT COUNT(*) FROM email_logs
      WHERE sent_at BETWEEN period_start AND period_end
    ), 0),

    -- By type breakdown
    'by_type', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'type', sub.email_type,
        'count', sub.cnt
      ))
      FROM (
        SELECT email_type, COUNT(*) as cnt
        FROM email_logs
        WHERE sent_at BETWEEN period_start AND period_end
        GROUP BY email_type
        ORDER BY cnt DESC
      ) sub
    ), '[]'::jsonb),

    -- Delivery stats
    'delivered', COALESCE((
      SELECT COUNT(*) FROM email_logs
      WHERE sent_at BETWEEN period_start AND period_end
        AND status IN ('delivered', 'opened', 'clicked')
    ), 0),

    'opened', COALESCE((
      SELECT COUNT(*) FROM email_logs
      WHERE sent_at BETWEEN period_start AND period_end
        AND status IN ('opened', 'clicked')
    ), 0),

    'clicked', COALESCE((
      SELECT COUNT(*) FROM email_logs
      WHERE sent_at BETWEEN period_start AND period_end
        AND status = 'clicked'
    ), 0),

    'bounced', COALESCE((
      SELECT COUNT(*) FROM email_logs
      WHERE sent_at BETWEEN period_start AND period_end
        AND status = 'bounced'
    ), 0),

    'failed', COALESCE((
      SELECT COUNT(*) FROM email_logs
      WHERE sent_at BETWEEN period_start AND period_end
        AND status = 'failed'
    ), 0),

    -- Rates
    'open_rate', COALESCE((
      SELECT ROUND(
        COUNT(*) FILTER (WHERE status IN ('opened', 'clicked'))::numeric /
        NULLIF(COUNT(*) FILTER (WHERE status NOT IN ('failed', 'bounced')), 0) * 100, 1
      )
      FROM email_logs
      WHERE sent_at BETWEEN period_start AND period_end
    ), 0),

    'click_rate', COALESCE((
      SELECT ROUND(
        COUNT(*) FILTER (WHERE status = 'clicked')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE status IN ('opened', 'clicked')), 0) * 100, 1
      )
      FROM email_logs
      WHERE sent_at BETWEEN period_start AND period_end
    ), 0),

    'bounce_rate', COALESCE((
      SELECT ROUND(
        COUNT(*) FILTER (WHERE status = 'bounced')::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
      )
      FROM email_logs
      WHERE sent_at BETWEEN period_start AND period_end
    ), 0),

    -- Unique recipients in period
    'unique_recipients', COALESCE((
      SELECT COUNT(DISTINCT recipient_email)
      FROM email_logs
      WHERE sent_at BETWEEN period_start AND period_end
    ), 0),

    -- Opt-in stats (from profiles)
    'notification_opt_in', COALESCE((
      SELECT ROUND(
        COUNT(*) FILTER (WHERE email_notifications = true)::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
      )
      FROM profiles
      WHERE email != 'tom@ppltok.com'
    ), 0),

    'marketing_opt_in', COALESCE((
      SELECT ROUND(
        COUNT(*) FILTER (WHERE marketing_emails = true)::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
      )
      FROM profiles
      WHERE email != 'tom@ppltok.com'
    ), 0),

    -- Daily send volume for trend chart
    'daily_sends', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'day', sub.day::text,
        'sent', sub.sent,
        'opened', sub.opened,
        'clicked', sub.clicked
      ) ORDER BY sub.day)
      FROM (
        SELECT
          DATE_TRUNC('day', sent_at)::date as day,
          COUNT(*) as sent,
          COUNT(*) FILTER (WHERE status IN ('opened', 'clicked')) as opened,
          COUNT(*) FILTER (WHERE status = 'clicked') as clicked
        FROM email_logs
        WHERE sent_at BETWEEN period_start AND period_end
        GROUP BY DATE_TRUNC('day', sent_at)::date
      ) sub
    ), '[]'::jsonb),

    -- Nudge effectiveness: users who completed action after nudge
    'nudge_stats', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'type', sub.email_type,
        'sent', sub.total_sent,
        'acted', sub.acted_after
      ))
      FROM (
        SELECT
          e.email_type,
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE e.status IN ('opened', 'clicked')) as acted_after
        FROM email_logs e
        WHERE e.email_type LIKE 'nudge_%'
          AND e.sent_at BETWEEN period_start AND period_end
        GROUP BY e.email_type
      ) sub
    ), '[]'::jsonb)

  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_email_metrics(timestamptz, timestamptz) TO authenticated;
