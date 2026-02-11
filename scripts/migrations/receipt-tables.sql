-- OFFO Listing Receipt Tables
-- Run against Supabase SQL Editor

-- Receipts table (stores generated receipts)
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
  is_pro BOOLEAN DEFAULT FALSE
);

-- Receipt events table (analytics)
CREATE TABLE IF NOT EXISTS receipt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  receipt_id UUID NULL,
  user_id UUID NULL,
  session_id TEXT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'generate', 'copy', 'paid_clicked', 'fetch_success',
    'fetch_fail', 'lint_fail', 'regen'
  )),
  url_domain TEXT NULL,
  verdict TEXT NULL,
  price_label TEXT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_receipt_events_created ON receipt_events(created_at);
CREATE INDEX IF NOT EXISTS idx_receipt_events_session ON receipt_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_session ON receipts(session_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON receipts(created_at);

-- Verify
DO $$
DECLARE
  tbl TEXT;
  required_tables TEXT[] := ARRAY['receipts', 'receipt_events'];
BEGIN
  FOREACH tbl IN ARRAY required_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      RAISE NOTICE '  [OK] Table % exists', tbl;
    ELSE
      RAISE WARNING '  [MISSING] Table % was not created!', tbl;
    END IF;
  END LOOP;
END $$;
