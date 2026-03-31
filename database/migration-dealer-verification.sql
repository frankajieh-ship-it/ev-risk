-- Dealer verification workflow
-- Adds status column + contact_name to dealerships table
-- Run in Supabase SQL editor

ALTER TABLE dealerships
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

-- Backfill: existing dealers with is_verified=true → approved, others → approved
-- (so existing accounts aren't broken by the new gate)
UPDATE dealerships SET status = 'approved' WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dealerships_status ON dealerships(status, created_at DESC);
