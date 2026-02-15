-- Email checklist deliveries table
-- Tracks emails sent with receipt/evroutine checklists
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS email_checklist_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('receipt', 'evroutine')),
  scenario_id UUID NOT NULL,
  email_hash TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scenario_type, scenario_id, email_hash)
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_created
  ON email_checklist_deliveries(created_at);

-- Verify
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'email_checklist_deliveries'
  ) THEN
    RAISE NOTICE '[OK] email_checklist_deliveries table exists';
  ELSE
    RAISE WARNING '[MISSING] email_checklist_deliveries table';
  END IF;
END $$;
