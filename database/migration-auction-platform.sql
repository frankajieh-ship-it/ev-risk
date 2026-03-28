-- Auction Intelligence Platform — Database Migration
-- Phase 1: Copart + unified auction backend foundation
--
-- Creates:
--   auction_analyses       — unified analysis records (replaces auction_lots + auction_eval_reports)
--   auction_ai_runs        — per-step AI model run log
--
-- Modifies:
--   garage_vehicles        — adds auction source fields for auction-sourced vehicles
--   saved_vehicles         — adds auction source metadata (if table exists)

-- ── auction_analyses ──────────────────────────────────────────────────────────
-- Single table that owns the full lifecycle: raw provider data → final report.
-- Replaces the two-table auction_lots + auction_eval_reports design.
-- result_id is the stable external identifier (returned in API responses).

CREATE TABLE IF NOT EXISTS auction_analyses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id             text UNIQUE NOT NULL,
  auction_source        text NOT NULL CHECK (auction_source IN ('copart', 'iaai', 'manheim')),
  lot_number            text,
  vin                   text,
  input_hash            text NOT NULL,
  -- Source layer
  raw_data              jsonb NOT NULL,       -- NormalizedAuctionLot from adapter
  -- Enrichment layer
  vehicle_data          jsonb,               -- Auto.dev VIN decode + market comps
  recall_data           jsonb,               -- NHTSA recall array
  routine_context       jsonb,               -- MinimumViableRoutine if provided
  -- Scoring layer (deterministic — no AI)
  deterministic_metrics jsonb,               -- salvage_risk, title_risk, mileage_adj, etc.
  -- AI layer
  ai_output             jsonb,               -- merged output from all AI steps
  -- Final
  final_report          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Session / access
  receipt_token         text,
  user_id               uuid,
  is_paid               boolean NOT NULL DEFAULT false,
  -- Cache
  cache_expires_at      timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_analyses_source_lot
  ON auction_analyses (auction_source, lot_number)
  WHERE lot_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auction_analyses_vin
  ON auction_analyses (vin)
  WHERE vin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auction_analyses_token
  ON auction_analyses (receipt_token)
  WHERE receipt_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auction_analyses_user
  ON auction_analyses (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auction_analyses_cache_expires
  ON auction_analyses (auction_source, lot_number, cache_expires_at DESC)
  WHERE lot_number IS NOT NULL;

-- ── auction_ai_runs ───────────────────────────────────────────────────────────
-- One row per model call per analysis. Used for cost tracking, debugging,
-- and circuit-breaker health data.

CREATE TABLE IF NOT EXISTS auction_ai_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_analysis_id   uuid REFERENCES auction_analyses (id) ON DELETE CASCADE,
  step_name             text NOT NULL, -- 'classify' | 'routine_impact' | 'repair_cost' | 'polish'
  model_name            text NOT NULL, -- 'grok' | 'gemini' | 'openai'
  status                text NOT NULL CHECK (status IN ('success', 'failed', 'skipped', 'cancelled')),
  latency_ms            int,
  raw_output            text,
  parsed_output         jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_ai_runs_analysis
  ON auction_ai_runs (auction_analysis_id);

-- ── garage_vehicles — auction source columns ──────────────────────────────────

ALTER TABLE garage_vehicles
  ADD COLUMN IF NOT EXISTS source               text DEFAULT 'listing',
  ADD COLUMN IF NOT EXISTS lot_number           text,
  ADD COLUMN IF NOT EXISTS damage_type          text,
  ADD COLUMN IF NOT EXISTS title_status         text,
  ADD COLUMN IF NOT EXISTS auction_source       text,
  ADD COLUMN IF NOT EXISTS source_metadata      jsonb,
  ADD COLUMN IF NOT EXISTS auction_analysis_id  uuid REFERENCES auction_analyses (id);

-- ── saved_vehicles — auction source columns (add if table exists) ─────────────
-- saved_vehicles may not exist in all deployments; use DO block for safety.

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'saved_vehicles') THEN
    EXECUTE 'ALTER TABLE saved_vehicles
      ADD COLUMN IF NOT EXISTS source          text DEFAULT ''listing'',
      ADD COLUMN IF NOT EXISTS lot_number      text,
      ADD COLUMN IF NOT EXISTS damage_type     text,
      ADD COLUMN IF NOT EXISTS title_status    text,
      ADD COLUMN IF NOT EXISTS auction_source  text,
      ADD COLUMN IF NOT EXISTS source_metadata jsonb';
  END IF;
END $$;
