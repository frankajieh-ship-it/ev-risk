-- Phase 1: Add preference filter fields to vehicle_profiles
-- Run this against your local Supabase instance before testing.
-- Apply via: Supabase Dashboard → SQL Editor, or psql

ALTER TABLE vehicle_profiles
  ADD COLUMN IF NOT EXISTS seating_capacity  INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS body_type         TEXT CHECK (body_type IN ('suv','sedan','hatchback','crossover','truck','van','coupe')),
  ADD COLUMN IF NOT EXISTS has_heat_pump     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS towing_capacity_lbs INTEGER;

-- Backfill known values for existing rows
-- Body type + seating + heat pump + towing per model

-- Tesla
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=true  WHERE make='Tesla' AND model LIKE 'Model 3%';
UPDATE vehicle_profiles SET body_type='suv',   seating_capacity=5, has_heat_pump=true  WHERE make='Tesla' AND model LIKE 'Model Y%';
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=true  WHERE make='Tesla' AND model LIKE 'Model S%';
UPDATE vehicle_profiles SET body_type='suv',   seating_capacity=7, has_heat_pump=true  WHERE make='Tesla' AND model LIKE 'Model X%';
UPDATE vehicle_profiles SET body_type='truck', seating_capacity=5, has_heat_pump=true, towing_capacity_lbs=11000 WHERE make='Tesla' AND model LIKE 'Cybertruck%';

-- Chevrolet
UPDATE vehicle_profiles SET body_type='hatchback', seating_capacity=5, has_heat_pump=false WHERE make='Chevrolet' AND model LIKE 'Bolt EV%';
UPDATE vehicle_profiles SET body_type='suv',       seating_capacity=5, has_heat_pump=false WHERE make='Chevrolet' AND model LIKE 'Bolt EUV%';
UPDATE vehicle_profiles SET body_type='suv',       seating_capacity=5, has_heat_pump=false WHERE make='Chevrolet' AND model LIKE 'Equinox%';
UPDATE vehicle_profiles SET body_type='suv',       seating_capacity=5, has_heat_pump=false WHERE make='Chevrolet' AND model LIKE 'Blazer%';

-- Ford
UPDATE vehicle_profiles SET body_type='suv',   seating_capacity=5, has_heat_pump=false, towing_capacity_lbs=3500  WHERE make='Ford' AND model LIKE 'Mustang Mach-E%';
UPDATE vehicle_profiles SET body_type='truck',  seating_capacity=5, has_heat_pump=false, towing_capacity_lbs=10000 WHERE make='Ford' AND model LIKE 'F-150 Lightning%';
UPDATE vehicle_profiles SET body_type='hatchback', seating_capacity=5, has_heat_pump=false WHERE make='Ford' AND model LIKE 'Focus Electric%';

-- Hyundai
UPDATE vehicle_profiles SET body_type='suv',   seating_capacity=5, has_heat_pump=true  WHERE make='Hyundai' AND model LIKE 'Ioniq 5%';
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=true  WHERE make='Hyundai' AND model LIKE 'Ioniq 6%';
UPDATE vehicle_profiles SET body_type='suv',   seating_capacity=5, has_heat_pump=false WHERE make='Hyundai' AND model LIKE 'Kona%';
UPDATE vehicle_profiles SET body_type='hatchback', seating_capacity=5, has_heat_pump=false WHERE make='Hyundai' AND model LIKE 'Ioniq Electric%';

-- Kia
UPDATE vehicle_profiles SET body_type='suv',  seating_capacity=5, has_heat_pump=true  WHERE make='Kia' AND model LIKE 'EV6%';
UPDATE vehicle_profiles SET body_type='suv',  seating_capacity=7, has_heat_pump=true  WHERE make='Kia' AND model LIKE 'EV9%';
UPDATE vehicle_profiles SET body_type='suv',  seating_capacity=5, has_heat_pump=false WHERE make='Kia' AND model LIKE 'Soul EV%';

-- Volkswagen
UPDATE vehicle_profiles SET body_type='suv',      seating_capacity=5, has_heat_pump=false WHERE make='Volkswagen' AND model LIKE 'ID.4%';
UPDATE vehicle_profiles SET body_type='van',       seating_capacity=7, has_heat_pump=false WHERE make='Volkswagen' AND model LIKE 'ID.Buzz%';
UPDATE vehicle_profiles SET body_type='hatchback', seating_capacity=5, has_heat_pump=false WHERE make='Volkswagen' AND model LIKE 'e-Golf%';

-- Nissan
UPDATE vehicle_profiles SET body_type='hatchback', seating_capacity=5, has_heat_pump=false WHERE make='Nissan' AND model LIKE 'Leaf%';
UPDATE vehicle_profiles SET body_type='suv',       seating_capacity=5, has_heat_pump=false WHERE make='Nissan' AND model LIKE 'Ariya%';

-- Rivian
UPDATE vehicle_profiles SET body_type='truck', seating_capacity=5, has_heat_pump=false, towing_capacity_lbs=11000 WHERE make='Rivian' AND model LIKE 'R1T%';
UPDATE vehicle_profiles SET body_type='suv',   seating_capacity=7, has_heat_pump=false, towing_capacity_lbs=7700  WHERE make='Rivian' AND model LIKE 'R1S%';

-- BMW
UPDATE vehicle_profiles SET body_type='suv',   seating_capacity=5, has_heat_pump=false WHERE make='BMW' AND model LIKE 'iX%';
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=false WHERE make='BMW' AND model LIKE 'i4%';
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=false WHERE make='BMW' AND model LIKE 'i5%';

-- Mercedes
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=false WHERE make='Mercedes' AND model LIKE 'EQS%';
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=false WHERE make='Mercedes' AND model LIKE 'EQE%';

-- Lucid
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=false WHERE make='Lucid' AND model LIKE 'Air%';

-- Polestar
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=false WHERE make='Polestar' AND model LIKE 'Polestar 2%';
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=false WHERE make='Polestar' AND model LIKE '2%';

-- Honda
UPDATE vehicle_profiles SET body_type='suv', seating_capacity=5, has_heat_pump=false WHERE make='Honda' AND model LIKE 'Prologue%';

-- Genesis
UPDATE vehicle_profiles SET body_type='suv',   seating_capacity=5, has_heat_pump=true WHERE make='Genesis' AND model LIKE 'GV60%';
UPDATE vehicle_profiles SET body_type='suv',   seating_capacity=5, has_heat_pump=true WHERE make='Genesis' AND model LIKE 'GV70%';

-- Subaru
UPDATE vehicle_profiles SET body_type='suv', seating_capacity=5, has_heat_pump=false WHERE make='Subaru' AND model LIKE 'Solterra%';

-- Toyota
UPDATE vehicle_profiles SET body_type='suv', seating_capacity=5, has_heat_pump=false WHERE make='Toyota' AND model LIKE 'bZ4X%';

-- Cadillac
UPDATE vehicle_profiles SET body_type='suv', seating_capacity=5, has_heat_pump=false WHERE make='Cadillac' AND model LIKE 'Lyriq%';

-- Volvo
UPDATE vehicle_profiles SET body_type='suv', seating_capacity=5, has_heat_pump=false WHERE make='Volvo' AND model LIKE 'XC40%';
UPDATE vehicle_profiles SET body_type='suv', seating_capacity=5, has_heat_pump=false WHERE make='Volvo' AND model LIKE 'C40%';

-- Porsche
UPDATE vehicle_profiles SET body_type='sedan', seating_capacity=5, has_heat_pump=false WHERE make='Porsche' AND model LIKE 'Taycan%';

-- Audi
UPDATE vehicle_profiles SET body_type='suv', seating_capacity=5, has_heat_pump=false WHERE make='Audi' AND model LIKE 'Q4%';
UPDATE vehicle_profiles SET body_type='suv', seating_capacity=5, has_heat_pump=false WHERE make='Audi' AND model LIKE 'Q8%';

-- Mini
UPDATE vehicle_profiles SET body_type='hatchback', seating_capacity=4, has_heat_pump=false WHERE make='Mini';
