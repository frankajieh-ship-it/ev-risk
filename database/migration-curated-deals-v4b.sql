-- curated_deals v4b: physical vehicle spec fields from CSV export
-- These come from your CarGurus/CarMax CSV download format
-- Run in Supabase SQL editor

ALTER TABLE curated_deals
  ADD COLUMN IF NOT EXISTS drivetrain          TEXT,          -- 'FWD' | 'RWD' | 'AWD' | 'eAWD'
  ADD COLUMN IF NOT EXISTS interior_color      TEXT,          -- e.g. 'Black', 'White', 'Cream'
  ADD COLUMN IF NOT EXISTS doors               INT,           -- number of doors (2 | 4 | 5)
  ADD COLUMN IF NOT EXISTS front_legroom_in    NUMERIC(4,1),  -- front legroom inches
  ADD COLUMN IF NOT EXISTS rear_legroom_in     NUMERIC(4,1),  -- rear legroom inches
  ADD COLUMN IF NOT EXISTS cargo_volume_cuft   NUMERIC(5,1),  -- cargo volume cubic feet
  ADD COLUMN IF NOT EXISTS charge_time_notes   TEXT,          -- raw charge time string, e.g. '8h on L2 / 45min DC'
  ADD COLUMN IF NOT EXISTS additional_notes    TEXT;          -- raw additional features text from listing

-- Index for drivetrain filtering (common EVRoutine fit query)
CREATE INDEX IF NOT EXISTS idx_curated_deals_drivetrain
  ON curated_deals(drivetrain, deal_quality_score DESC)
  WHERE is_active = TRUE;
