-- curated_deals v2: add structured listing metadata columns
-- Run in Supabase SQL editor

ALTER TABLE curated_deals
  ADD COLUMN IF NOT EXISTS vin TEXT,
  ADD COLUMN IF NOT EXISTS title_status TEXT,   -- 'clean' | 'salvage' | 'rebuilt' | 'unknown'
  ADD COLUMN IF NOT EXISTS battery_report TEXT, -- 'yes' | 'no' | null (unknown)
  ADD COLUMN IF NOT EXISTS service_records TEXT; -- 'yes' | 'no' | null (unknown)
