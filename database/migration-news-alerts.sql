-- News Alert Tracking Migration
-- Adds news_alerts opt-in column to crm_email_preferences
-- and a news_alert_dispatches dedup table to prevent re-sending the same article
-- to the same user across daily runs.
--
-- Run in Supabase SQL Editor — safe to re-run (all idempotent).

-- 1. Per-sequence opt-in column for news alerts (separate from recall NHTSA alerts)
ALTER TABLE crm_email_preferences
  ADD COLUMN IF NOT EXISTS news_alerts BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Dedup table: one row per (user_id, article_id) — prevents re-alerting same article
--    Separate from crm_email_sends because news alerts are high-volume and keyed on
--    article_id + user_id rather than an event UUID.
CREATE TABLE IF NOT EXISTS news_alert_dispatches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id     UUID        NOT NULL,
  article_id  TEXT        NOT NULL,  -- daily_routine_news.article_id (sha256 dedup key)
  email       TEXT        NOT NULL,
  digest_date DATE        NOT NULL,  -- calendar date the digest covered (for daily grouping)
  UNIQUE (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_news_alert_dispatches_user
  ON news_alert_dispatches(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_alert_dispatches_date
  ON news_alert_dispatches(digest_date DESC);
