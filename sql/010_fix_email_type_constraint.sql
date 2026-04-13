-- 010: Fix email_type CHECK constraint to match actual edge function email types
-- The original constraint was too restrictive and didn't match the types used by
-- send-email, send-weekly-emails, and send-nudge-emails functions.

-- Drop the old constraint
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_email_type_check;

-- Add new constraint with ALL actual email types used by edge functions
ALTER TABLE email_logs ADD CONSTRAINT email_logs_email_type_check CHECK (email_type IN (
  -- From send-email function
  'welcome',                 -- Welcome email after onboarding
  'purchase_notification',   -- Registry owner: someone bought a gift
  'thank_you',              -- Gift buyer: purchase confirmation
  'admin_new_user',         -- Admin notification: new signup
  'contact',                -- Contact form forwarding

  -- From send-weekly-emails function
  'weekly_update',          -- Pregnancy weekly update (weeks 12-39)
  'week40_celebration',     -- Due date celebration email
  'postpartum_weekly',      -- Postpartum weekly update (weeks 1-12)

  -- From send-nudge-emails function
  'nudge_checklist',        -- 7+ days after onboarding, no checklist activity
  'nudge_share',            -- 3+ items but hasn't shared registry

  -- Legacy types (from backfill)
  'confirmation',           -- Gift purchase confirmation (backfilled from purchases)

  -- Future types
  'marketing',              -- General marketing/promo
  'price_alert'             -- Price drop notification
));

-- Also add auto-refresh cron job for materialized views
-- This creates a pg_cron job to refresh views daily at 3:00 AM UTC (6:00 AM Israel time)
-- Note: pg_cron must be enabled in Supabase Dashboard > Database > Extensions > pg_cron

-- Enable pg_cron extension if not already
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily refresh at 3:00 UTC = 6:00 Israel time
SELECT cron.schedule(
  'refresh-dashboard-views',
  '0 3 * * *',
  $$SELECT refresh_dashboard_views()$$
);
