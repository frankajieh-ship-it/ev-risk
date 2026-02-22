-- Migration: Create shared_receipts table for QR share feature
-- Run in Supabase SQL editor before deploying

CREATE TABLE IF NOT EXISTS shared_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_slug TEXT UNIQUE NOT NULL,
  receipt_id UUID NOT NULL REFERENCES receipts(id),
  snapshot_summary_json JSONB NOT NULL,
  creator_receipt_token TEXT NULL,
  view_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_receipts_slug ON shared_receipts(share_slug);
CREATE INDEX IF NOT EXISTS idx_shared_receipts_receipt_id ON shared_receipts(receipt_id);
