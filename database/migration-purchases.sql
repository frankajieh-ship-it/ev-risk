-- OFFO Decision Pack: Purchases & Payment Schema
-- Supports both receipt and evroutine scenario types
-- Includes compare credit system and deep dive content storage

-- 1. Purchases table
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

-- 2. Deep dives table (cached paid content per scenario)
CREATE TABLE IF NOT EXISTS deep_dives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_type TEXT NOT NULL
    CHECK (scenario_type IN ('receipt', 'evroutine')),
  scenario_id UUID NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scenario_type, scenario_id)
);

-- 3. PDF exports table (optional, for cached PDF downloads)
CREATE TABLE IF NOT EXISTS pdf_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_type TEXT NOT NULL,
  scenario_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Stripe webhook events dedup table
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
