-- ============================================================================
-- VIN Decode Columns — Migration for receipts table
-- ============================================================================
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).
-- All statements are idempotent — safe to re-run.
-- ============================================================================

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vin TEXT NULL;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vin_decode_status TEXT NULL
  CHECK (vin_decode_status IN ('pending', 'success', 'failed', 'invalid_vin'));
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vin_decode JSONB NULL;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vin_checked_at TIMESTAMPTZ NULL;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vin_mismatch_flags JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_vin ON receipts(vin);
