-- Curated Deals: OFFO-analyzed public listings surfaced on /deals
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS curated_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_url TEXT NOT NULL UNIQUE,
  url_domain TEXT,
  vehicle_label TEXT NOT NULL,          -- e.g. "2022 Tesla Model 3 Long Range"
  year INT,
  make TEXT,
  model TEXT,
  trim TEXT,
  price INT,                            -- USD
  mileage INT,
  location TEXT,
  verdict TEXT,                         -- GREEN | YELLOW | RED
  evidence_score INT,                   -- 0-100
  fit_score INT,                        -- 0-100
  risk_points INT,                      -- 0-10 (V2 scoring)
  deal_quality_score NUMERIC(5,2),      -- composite ranking score 0-100
  risk_flags TEXT[],                    -- top risk flag labels (max 3)
  receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
  photo_url TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  last_analyzed_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Primary ranking index
CREATE INDEX IF NOT EXISTS idx_curated_deals_ranking
  ON curated_deals(deal_quality_score DESC, is_active)
  WHERE is_active = TRUE;

-- Verdict filter index
CREATE INDEX IF NOT EXISTS idx_curated_deals_verdict
  ON curated_deals(verdict, is_active, deal_quality_score DESC)
  WHERE is_active = TRUE;

-- Make/model filter index
CREATE INDEX IF NOT EXISTS idx_curated_deals_make_model
  ON curated_deals(make, model, deal_quality_score DESC)
  WHERE is_active = TRUE;
