-- Post-purchase Day 7 email migration
-- Adds opt-out preference column for the Day 7 "did you buy it?" check-in email.
-- Run in Supabase dashboard after deploying the post-purchase-day7 feature.

ALTER TABLE crm_email_preferences
  ADD COLUMN IF NOT EXISTS post_purchase_day7 BOOLEAN NOT NULL DEFAULT TRUE;
