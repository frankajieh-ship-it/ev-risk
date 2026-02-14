-- ============================================================================
-- OFFO — Consolidated Database Migration
-- ============================================================================
-- Run this entire script in Supabase SQL Editor (Dashboard → SQL Editor).
-- All statements are idempotent (IF NOT EXISTS) — safe to re-run.
--
-- Tables created:
--   1. receipts              — generated receipt storage
--   2. receipt_events        — receipt-level analytics
--   3. receipt_requests      — idempotency cache (dedup rapid clicks)
--   4. purchases             — Stripe payment records
--   5. deep_dives            — cached paid content per scenario
--   6. pdf_exports           — cached PDF downloads
--   7. stripe_webhook_events — webhook dedup
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. receipts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NULL,
  session_id TEXT NULL,
  source TEXT NOT NULL DEFAULT 'receipt_page',
  listing_url TEXT NULL,
  url_domain TEXT NULL,
  listing_text TEXT NULL,
  input_json JSONB NOT NULL,
  output_json JSONB NOT NULL,
  mode TEXT NOT NULL DEFAULT 'single' CHECK (mode IN ('single', 'compare')),
  is_pro BOOLEAN DEFAULT FALSE,
  page_source TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_session ON receipts(session_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_page_source ON receipts(page_source);

-- ---------------------------------------------------------------------------
-- 2. receipt_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receipt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  receipt_id UUID NULL,
  user_id UUID NULL,
  session_id TEXT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    -- Server-side (receipt API)
    'generate', 'schema_fail', 'lint_fail',
    'generate_timeout', 'generate_fail', 'regen',
    -- Server-side (fetch API)
    'fetch_success', 'fetch_fail',
    -- Client-side (event API)
    'copy', 'paid_clicked',
    'receipt_result_viewed',
    'deep_dive_upsell_shown',
    'deep_dive_upsell_clicked'
  )),
  url_domain TEXT NULL,
  verdict TEXT NULL,
  price_label TEXT NULL,
  ip_hash TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipt_events_created ON receipt_events(created_at);
CREATE INDEX IF NOT EXISTS idx_receipt_events_session ON receipt_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_receipt_events_ip_hash ON receipt_events(ip_hash, created_at);

-- ---------------------------------------------------------------------------
-- 3. receipt_requests (idempotency cache)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receipt_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_hash TEXT NOT NULL,
  anon_id TEXT NOT NULL,
  ip_hash TEXT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  receipt_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  output_json JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_receipt_requests_hash
  ON receipt_requests(input_hash, created_at);

-- ---------------------------------------------------------------------------
-- 4. purchases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
  purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  scenario_type TEXT NOT NULL
    CHECK (scenario_type IN ('receipt', 'evroutine')),
  base_scenario_id UUID NOT NULL,
  compare_credit_total INT NOT NULL DEFAULT 1,
  compare_credit_used INT NOT NULL DEFAULT 0,
  compare_scenario_id UUID NULL,
  anon_id TEXT NOT NULL,
  user_id UUID NULL,
  price_variant TEXT NOT NULL,
  amount INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  page_source TEXT NULL,
  utm_source TEXT NULL,
  utm_medium TEXT NULL,
  utm_campaign TEXT NULL,
  utm_content TEXT NULL,
  utm_term TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_scenario
  ON purchases(base_scenario_id, scenario_type);
CREATE INDEX IF NOT EXISTS idx_purchases_anon
  ON purchases(anon_id, created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe
  ON purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status
  ON purchases(status, created_at);

-- ---------------------------------------------------------------------------
-- 5. deep_dives (cached paid content per scenario)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deep_dives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_type TEXT NOT NULL
    CHECK (scenario_type IN ('receipt', 'evroutine')),
  scenario_id UUID NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scenario_type, scenario_id)
);

-- ---------------------------------------------------------------------------
-- 6. pdf_exports (cached PDF downloads)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pdf_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_type TEXT NOT NULL,
  scenario_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. stripe_webhook_events (dedup)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
  required_tables TEXT[] := ARRAY[
    'receipts', 'receipt_events', 'receipt_requests',
    'purchases', 'deep_dives', 'pdf_exports', 'stripe_webhook_events'
  ];
BEGIN
  FOREACH tbl IN ARRAY required_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE '  [OK] Table % exists', tbl;
    ELSE
      RAISE WARNING '  [MISSING] Table % was not created!', tbl;
    END IF;
  END LOOP;
END $$;
