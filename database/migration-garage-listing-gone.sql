-- Garage listing-gone alert migration
-- Tracks when a saved vehicle's listing disappears from the market.
-- Run in Supabase dashboard after deploying listing-gone alert feature.

-- 1. Listing status columns on garage_vehicles
ALTER TABLE garage_vehicles
  ADD COLUMN IF NOT EXISTS listing_is_gone BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS listing_gone_detected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_gone_alert_sent_at TIMESTAMPTZ;

-- 2. Add listing_gone preference to CRM opt-out table
ALTER TABLE crm_email_preferences
  ADD COLUMN IF NOT EXISTS listing_gone BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Index to support daily scanner query
CREATE INDEX IF NOT EXISTS idx_garage_listing_gone_scan
  ON garage_vehicles (listing_url, listing_is_gone, is_owned_ev)
  WHERE listing_url IS NOT NULL AND is_owned_ev = FALSE AND listing_is_gone = FALSE;
