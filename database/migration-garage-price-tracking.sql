-- Garage price tracking: capture listing URL + price at save time for drop alerts
-- Run in Supabase SQL editor

ALTER TABLE garage_vehicles
  ADD COLUMN IF NOT EXISTS listing_url TEXT,
  ADD COLUMN IF NOT EXISTS listing_price_at_save INT,  -- cents, at time of garage save
  ADD COLUMN IF NOT EXISTS price_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_drop_cents INT;        -- latest drop vs save price (positive = dropped)

CREATE INDEX IF NOT EXISTS idx_garage_price_tracking
  ON garage_vehicles(listing_url, price_last_checked_at)
  WHERE listing_url IS NOT NULL AND is_owned_ev = FALSE;
