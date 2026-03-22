-- compare_sessions table
-- Stores a lightweight record so Stripe checkout can validate the scenario.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS compare_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id TEXT NULL,
  label_a TEXT NULL,
  label_b TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compare_sessions_anon
  ON compare_sessions(anon_id, created_at DESC);
