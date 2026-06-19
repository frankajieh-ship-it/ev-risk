-- Phase 2b: Additional safety/comfort/physical spec columns
-- Run this in the Supabase SQL editor after migration-vehicle-profiles-phase2.sql

ALTER TABLE vehicle_profiles
  ADD COLUMN IF NOT EXISTS has_tilt_wheel        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_am_fm_radio        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_immobilizer        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_active_seatbelts   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_passenger_airbag   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS doors                  SMALLINT;

-- Backfill doors (most EVs are 4-door; MINI Cooper SE is 3-door hatchback counted as 2)
UPDATE vehicle_profiles SET doors = 2 WHERE make = 'Mini';
UPDATE vehicle_profiles SET doors = 4 WHERE doors IS NULL;

-- All boolean safety/comfort cols already default to true for modern EVs (2018+)
-- No further backfill needed for has_tilt_wheel, has_am_fm_radio, has_immobilizer,
-- has_active_seatbelts, has_passenger_airbag
