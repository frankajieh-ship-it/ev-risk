-- Phase 4: Shopper → Dealer Conversion Funnel
-- 1. Track which receipt triggered a dealer inquiry
-- 2. Track referral source when a dealer signs up

-- Add receipt attribution to inquiries (nullable — existing rows unaffected)
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES receipts(id);

-- Index for funnel queries: which inquiries came from which receipt
CREATE INDEX IF NOT EXISTS idx_inquiries_receipt_id ON inquiries(receipt_id) WHERE receipt_id IS NOT NULL;

-- Add referral attribution to dealerships
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS referral_source TEXT;
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES auth.users(id);
