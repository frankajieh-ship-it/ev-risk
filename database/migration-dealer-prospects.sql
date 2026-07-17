-- Dealer Prospects: Outreach Tracking
-- Extends dealerships to support cold-outreach prospects (dealers not yet signed up)
-- and tracks per-dealer email outreach state.
--
-- Run AFTER migration-dealer-verification.sql (which adds the status column).

-- 1. Expand the status CHECK to include 'prospect'
ALTER TABLE dealerships DROP CONSTRAINT IF EXISTS dealerships_status_check;
ALTER TABLE dealerships
  ADD CONSTRAINT dealerships_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'prospect'));

-- 2. Outreach tracking columns on dealerships
ALTER TABLE dealerships
  ADD COLUMN IF NOT EXISTS outreach_step TEXT,           -- null | 'intro' | 'followup'
  ADD COLUMN IF NOT EXISTS outreach_sent_at TIMESTAMPTZ, -- when the last outreach email was sent
  ADD COLUMN IF NOT EXISTS outreach_replied_at TIMESTAMPTZ, -- if they replied / clicked signup
  ADD COLUMN IF NOT EXISTS prospect_source TEXT,         -- 'csv_import' | 'cargurus' | 'carscom' | 'autotrader'
  ADD COLUMN IF NOT EXISTS prospect_notes TEXT;          -- free-form notes from the CSV or operator

-- 3. dealer_outreach log — one row per email sent to a prospect dealer
CREATE TABLE IF NOT EXISTS dealer_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('intro', 'followup')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_email_id TEXT,      -- Resend message ID for bounce/open tracking
  idempotency_key TEXT UNIQUE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dealer_outreach_dealership ON dealer_outreach(dealership_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_outreach_step ON dealer_outreach(step, sent_at DESC);

-- 4. Index for prospect queries
CREATE INDEX IF NOT EXISTS idx_dealerships_prospect ON dealerships(status, outreach_step, outreach_sent_at)
  WHERE status = 'prospect';
