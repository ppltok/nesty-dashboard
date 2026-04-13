-- 011: Prepare email_logs for Resend sync

-- Add unique constraint on provider_message_id for upsert
CREATE UNIQUE INDEX IF NOT EXISTS email_logs_provider_message_id_idx
ON email_logs (provider_message_id)
WHERE provider_message_id IS NOT NULL;

-- Drop the old restrictive CHECK constraint on email_type and replace with a broader one
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_email_type_check;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_email_type_check
CHECK (email_type IN (
  'confirmation', 'welcome', 'thank_you', 'purchase_notification',
  'gift_notification', 'weekly_update', 'weekly_digest',
  'nudge_checklist', 'nudge_share', 'nudge_onboarding',
  'nudge_first_item', 'nudge_incomplete',
  'marketing', 'price_alert', 'contact', 'admin_new_user', 'other'
));
