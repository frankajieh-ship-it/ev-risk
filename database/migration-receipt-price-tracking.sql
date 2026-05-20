-- Phase 2: Listing age and price drift tracking on receipts
-- Enables "how long has this been listed" and "did the price drop" signals

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_price_cents INT,        -- extracted listing price in cents
  ADD COLUMN IF NOT EXISTS price_drop_cents INT,        -- positive = price dropped by this amount
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE; -- false when listing is gone/sold

-- Index for price monitoring job (finds active listings with a URL to re-check)
CREATE INDEX IF NOT EXISTS idx_receipts_is_active ON receipts (is_active, last_seen_at)
  WHERE is_active = TRUE AND listing_url IS NOT NULL;

-- Index for listing-age badge queries
CREATE INDEX IF NOT EXISTS idx_receipts_listing_url ON receipts (listing_url)
  WHERE listing_url IS NOT NULL;
