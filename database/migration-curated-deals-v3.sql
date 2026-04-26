-- curated_deals v3: VinAudit summary + extracted signals columns
-- Run in Supabase SQL editor

ALTER TABLE curated_deals
  ADD COLUMN IF NOT EXISTS vin_audit_summary JSONB,
  -- shape: { salvage: bool, theft: bool, accident_count: int, sale_count: int }
  ADD COLUMN IF NOT EXISTS extracted_signals TEXT[];
  -- signals derived from VIN audit + NHTSA (no AI)
  -- e.g. ["vin_decoded", "clean_title_explicit", "dcfc_confirmed", "battery_health_estimated"]
