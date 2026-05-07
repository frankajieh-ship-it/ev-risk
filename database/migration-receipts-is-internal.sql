-- Add is_internal flag to receipts so internal/tester sessions are excluded from analytics
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_receipts_is_internal ON receipts(is_internal) WHERE is_internal = true;
