-- curated_deals v4c: body type and towing capacity from CSV export
-- Run in Supabase SQL editor after v4b

ALTER TABLE curated_deals
  ADD COLUMN IF NOT EXISTS body_type            TEXT,    -- 'Sedan' | 'SUV' | 'Hatchback' | 'Crossover' | 'Truck' | 'Van'
  ADD COLUMN IF NOT EXISTS towing_capacity_lbs  INT;     -- towing capacity in pounds
