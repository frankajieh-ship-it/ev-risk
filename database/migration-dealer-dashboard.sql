-- Dealer Dashboard: Demand Analytics Infrastructure
-- Adds dealer_metrics_cache table and geo columns on user_events.
-- Run in Supabase SQL Editor or via migration runner.

BEGIN;

-- 1. dealer_metrics_cache
-- Pre-aggregated demand signals per dealership.
-- Upsert by (dealership_id, metric_key) to refresh stale data.
CREATE TABLE IF NOT EXISTS dealer_metrics_cache (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id  UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  metric_key     TEXT NOT NULL,       -- e.g. "weekly_high_intent", "top_models_30d"
  metric_value   JSONB NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dealership_id, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_dealer_metrics_cache_dealership
  ON dealer_metrics_cache (dealership_id, metric_key);

-- 2. Geo columns on user_events
-- Populated lazily on event ingestion via IP-to-metro lookup.
-- Existing rows remain NULL; no backfill required.
ALTER TABLE user_events
  ADD COLUMN IF NOT EXISTS geo_metro TEXT,    -- e.g. "Chicago, IL"
  ADD COLUMN IF NOT EXISTS geo_state TEXT,    -- e.g. "IL"
  ADD COLUMN IF NOT EXISTS geo_lat  NUMERIC,
  ADD COLUMN IF NOT EXISTS geo_lon  NUMERIC;

CREATE INDEX IF NOT EXISTS idx_events_geo_metro
  ON user_events (geo_metro) WHERE geo_metro IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_geo_state
  ON user_events (geo_state) WHERE geo_state IS NOT NULL;

COMMIT;
