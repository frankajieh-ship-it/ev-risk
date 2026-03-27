-- Phase 7: Pricing Optimization Tools
-- Creates pricing_insights table with two-stage engine output storage.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS pricing_insights (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Vehicle reference
  vehicle_id            UUID NOT NULL,        -- references dealer_inventory.id
  dealership_id         UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  -- Stage 1: Deterministic inputs (saved for transparency and re-use)
  asking_price_usd      INT NOT NULL,
  make                  TEXT NOT NULL,
  model                 TEXT NOT NULL,
  year                  INT,
  trim                  TEXT,
  mileage               INT,
  condition             TEXT,             -- "excellent" | "good" | "fair"
  zip_code              TEXT,

  -- Comparable sales (Stage 1 output)
  comp_count            INT DEFAULT 0,
  buyer_count           INT DEFAULT 0,    -- buyers researching this make/model in region
  price_percentile      INT,              -- 0-100: where asking sits in comp distribution
  market_avg_price_usd  INT,
  market_low_usd        INT,
  market_high_usd       INT,

  -- Stage 1: Suggested price range (deterministic)
  suggested_price_low_usd   INT,
  suggested_price_target_usd INT,
  suggested_price_high_usd  INT,

  -- Price sensitivity curve data (for chart)
  price_sensitivity     JSONB,
  -- Shape: {"buckets": [{"price": 45000, "estimated_buyers": 12}, ...]}

  -- Stage 2: LLM summarization output
  market_position       TEXT,             -- "below" | "at" | "above"
  confidence            INT,              -- 0-100
  explanation           JSONB,
  -- Shape: {"headline": str, "why": str, "action": str, "caveats": [str]}

  -- Metadata
  model_used            TEXT,             -- which LLM ran Stage 2
  stage1_ms             INT,
  stage2_ms             INT,
  refreshed_at          TIMESTAMPTZ,      -- last time this row was computed
  is_stale              BOOLEAN DEFAULT FALSE,  -- true if asking_price changed since last run

  UNIQUE (vehicle_id, dealership_id)
);

CREATE INDEX IF NOT EXISTS idx_pricing_insights_dealership
  ON pricing_insights (dealership_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_insights_vehicle
  ON pricing_insights (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_pricing_insights_stale
  ON pricing_insights (dealership_id, is_stale)
  WHERE is_stale = TRUE;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_pricing_insights_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pricing_insights_updated_at ON pricing_insights;
CREATE TRIGGER trg_pricing_insights_updated_at
  BEFORE UPDATE ON pricing_insights
  FOR EACH ROW EXECUTE FUNCTION update_pricing_insights_updated_at();
