-- Add category column to daily_routine_news
-- Run in Supabase SQL Editor — safe to re-run (IF NOT EXISTS / idempotent).
--
-- Categories:
--   routine_impact    — charging access, battery, range, daily ownership
--   recall            — NHTSA recalls, safety defects, OTA safety fixes
--   used_market       — used EV prices, depreciation, CPO, auction data
--   charging_network  — charger outages, network expansions, DCFC availability

ALTER TABLE daily_routine_news
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'routine_impact'
  CHECK (category IN ('routine_impact', 'recall', 'used_market', 'charging_network'));

CREATE INDEX IF NOT EXISTS idx_daily_routine_news_category
  ON daily_routine_news(category);

-- Backfill existing rows: articles with 'recall' in key_routine_effects → recall category
UPDATE daily_routine_news
SET category = 'recall'
WHERE 'recall' = ANY(key_routine_effects)
  AND category = 'routine_impact';
