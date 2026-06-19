-- Phase 2: Add rich spec fields to vehicle_profiles
-- Run via: Supabase Dashboard → SQL Editor
-- Adds drivetrain, cargo volume, charge time, legroom, comfort features, colors

ALTER TABLE vehicle_profiles
  ADD COLUMN IF NOT EXISTS drivetrain            TEXT CHECK (drivetrain IN ('awd','rwd','fwd')),
  ADD COLUMN IF NOT EXISTS cargo_volume_cuft     NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS charge_time_l2_hours  NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS front_legroom_in      NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS rear_legroom_in       NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS has_ac                BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_power_windows     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_power_locks       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_power_steering    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_keyless_entry     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_alarm             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_satellite_radio   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_dual_airbags      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_side_airbags      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_abs               BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_carplay           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_android_auto      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS exterior_colors       TEXT[],
  ADD COLUMN IF NOT EXISTS interior_colors       TEXT[];

-- ============================================================
-- DRIVETRAIN
-- ============================================================

-- Tesla
UPDATE vehicle_profiles SET drivetrain='rwd'
  WHERE make='Tesla' AND model LIKE 'Model 3%'
    AND model NOT LIKE '%AWD%' AND model NOT LIKE '%Performance%' AND model NOT LIKE '%Dual%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Tesla' AND model LIKE 'Model 3%'
    AND (model LIKE '%AWD%' OR model LIKE '%Performance%' OR model LIKE '%Dual%');
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Tesla' AND model LIKE 'Model Y%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Tesla' AND model LIKE 'Model S%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Tesla' AND model LIKE 'Model X%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Tesla' AND model LIKE 'Cybertruck%';

-- Chevrolet
UPDATE vehicle_profiles SET drivetrain='fwd'
  WHERE make='Chevrolet' AND model LIKE 'Bolt EV%';
UPDATE vehicle_profiles SET drivetrain='fwd'
  WHERE make='Chevrolet' AND model LIKE 'Bolt EUV%';
UPDATE vehicle_profiles SET drivetrain='fwd'
  WHERE make='Chevrolet' AND (model LIKE 'Equinox%' OR model LIKE 'Blazer%');

-- Ford
UPDATE vehicle_profiles SET drivetrain='rwd'
  WHERE make='Ford' AND model LIKE 'Mustang Mach-E%' AND model NOT LIKE '%AWD%' AND model NOT LIKE '%eAWD%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Ford' AND model LIKE 'Mustang Mach-E%' AND (model LIKE '%AWD%' OR model LIKE '%eAWD%');
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Ford' AND model LIKE 'F-150 Lightning%';
UPDATE vehicle_profiles SET drivetrain='fwd'
  WHERE make='Ford' AND model LIKE 'Focus Electric%';

-- Hyundai
UPDATE vehicle_profiles SET drivetrain='rwd'
  WHERE make='Hyundai' AND model LIKE 'Ioniq 5%' AND model NOT LIKE '%AWD%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Hyundai' AND model LIKE 'Ioniq 5%' AND model LIKE '%AWD%';
UPDATE vehicle_profiles SET drivetrain='rwd'
  WHERE make='Hyundai' AND model LIKE 'Ioniq 6%' AND model NOT LIKE '%AWD%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Hyundai' AND model LIKE 'Ioniq 6%' AND model LIKE '%AWD%';
UPDATE vehicle_profiles SET drivetrain='fwd'
  WHERE make='Hyundai' AND (model LIKE 'Kona%' OR model LIKE 'Ioniq Electric%');

-- Kia
UPDATE vehicle_profiles SET drivetrain='rwd'
  WHERE make='Kia' AND model LIKE 'EV6%' AND model NOT LIKE '%AWD%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Kia' AND model LIKE 'EV6%' AND model LIKE '%AWD%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Kia' AND model LIKE 'EV9%';
UPDATE vehicle_profiles SET drivetrain='fwd'
  WHERE make='Kia' AND model LIKE 'Soul EV%';

-- Volkswagen
UPDATE vehicle_profiles SET drivetrain='rwd'
  WHERE make='Volkswagen' AND model LIKE 'ID.4%' AND model NOT LIKE '%AWD%' AND model NOT LIKE '%4Motion%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Volkswagen' AND model LIKE 'ID.4%' AND (model LIKE '%AWD%' OR model LIKE '%4Motion%');
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Volkswagen' AND model LIKE 'ID.Buzz%';
UPDATE vehicle_profiles SET drivetrain='fwd'
  WHERE make='Volkswagen' AND model LIKE 'e-Golf%';

-- Nissan
UPDATE vehicle_profiles SET drivetrain='fwd'
  WHERE make='Nissan' AND model LIKE 'Leaf%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Nissan' AND model LIKE 'Ariya%' AND model LIKE '%e-4ORCE%';
UPDATE vehicle_profiles SET drivetrain='fwd'
  WHERE make='Nissan' AND model LIKE 'Ariya%' AND model NOT LIKE '%e-4ORCE%';

-- Rivian
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Rivian';

-- BMW
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='BMW' AND (model LIKE 'iX%' OR model LIKE 'i7%');
UPDATE vehicle_profiles SET drivetrain='rwd'
  WHERE make='BMW' AND model LIKE 'i4%' AND model NOT LIKE '%xDrive%' AND model NOT LIKE '%M50%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='BMW' AND model LIKE 'i4%' AND (model LIKE '%xDrive%' OR model LIKE '%M50%');
UPDATE vehicle_profiles SET drivetrain='rwd'
  WHERE make='BMW' AND model LIKE 'i5%' AND model NOT LIKE '%xDrive%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='BMW' AND model LIKE 'i5%' AND model LIKE '%xDrive%';

-- Mercedes
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Mercedes' AND (model LIKE '%4MATIC%' OR model LIKE '%EQS SUV%' OR model LIKE '%EQB%');
UPDATE vehicle_profiles SET drivetrain='rwd'
  WHERE make='Mercedes' AND model NOT LIKE '%4MATIC%' AND model NOT LIKE '%SUV%' AND model NOT LIKE '%EQB%';

-- Lucid
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Lucid';

-- Polestar
UPDATE vehicle_profiles SET drivetrain='rwd'
  WHERE make='Polestar' AND (model LIKE 'Polestar 2%' OR model LIKE '2%') AND model NOT LIKE '%AWD%' AND model NOT LIKE '%Dual%';
UPDATE vehicle_profiles SET drivetrain='awd'
  WHERE make='Polestar' AND (model LIKE '%AWD%' OR model LIKE '%Dual%');

-- Others
UPDATE vehicle_profiles SET drivetrain='awd'  WHERE make='Honda'    AND model LIKE 'Prologue%';
UPDATE vehicle_profiles SET drivetrain='awd'  WHERE make='Subaru'   AND model LIKE 'Solterra%';
UPDATE vehicle_profiles SET drivetrain='awd'  WHERE make='Toyota'   AND model LIKE 'bZ4X%';
UPDATE vehicle_profiles SET drivetrain='rwd'  WHERE make='Cadillac' AND model LIKE 'Lyriq%';
UPDATE vehicle_profiles SET drivetrain='rwd'  WHERE make='Volvo'    AND model LIKE 'C40%' AND model NOT LIKE '%Twin%' AND model NOT LIKE '%AWD%';
UPDATE vehicle_profiles SET drivetrain='awd'  WHERE make='Volvo'    AND (model LIKE '%Twin%' OR (model LIKE 'XC40%' AND model NOT LIKE '%Single%'));
UPDATE vehicle_profiles SET drivetrain='rwd'  WHERE make='Porsche'  AND model LIKE 'Taycan%' AND model NOT LIKE '%4%' AND model NOT LIKE '%Turbo%';
UPDATE vehicle_profiles SET drivetrain='awd'  WHERE make='Porsche'  AND model LIKE 'Taycan%' AND (model LIKE '%4%' OR model LIKE '%Turbo%');
UPDATE vehicle_profiles SET drivetrain='awd'  WHERE make='Audi'     AND (model LIKE 'Q4%' OR model LIKE 'Q8%');
UPDATE vehicle_profiles SET drivetrain='awd'  WHERE make='Genesis'  AND (model LIKE 'GV60%' OR model LIKE 'GV70%');
UPDATE vehicle_profiles SET drivetrain='fwd'  WHERE make='Mini';

-- ============================================================
-- CARPLAY / ANDROID AUTO
-- ============================================================
-- Tesla: no CarPlay or Android Auto (uses Tesla's own system)
UPDATE vehicle_profiles SET has_carplay=false, has_android_auto=false
  WHERE make='Tesla';

-- Most 2019+ non-Tesla EVs support both
UPDATE vehicle_profiles SET has_carplay=true, has_android_auto=true
  WHERE year >= 2019
    AND make IN ('Hyundai','Kia','Ford','Volkswagen','BMW','Audi','Volvo',
                 'Porsche','Mercedes','Genesis','Rivian','Honda','Subaru',
                 'Toyota','Cadillac','Polestar','Nissan','Chevrolet','Lucid','Mini');

-- Older Chevrolet Bolt EVs (pre-2020) had CarPlay but not Android Auto
UPDATE vehicle_profiles SET has_carplay=true, has_android_auto=false
  WHERE make='Chevrolet' AND model LIKE 'Bolt EV%' AND year < 2020;

-- Nissan Leaf — CarPlay from 2020, Android Auto from 2021
UPDATE vehicle_profiles SET has_carplay=true,  has_android_auto=false WHERE make='Nissan' AND model LIKE 'Leaf%' AND year = 2020;
UPDATE vehicle_profiles SET has_carplay=true,  has_android_auto=true  WHERE make='Nissan' AND model LIKE 'Leaf%' AND year >= 2021;

-- ============================================================
-- SATELLITE RADIO
-- ============================================================
UPDATE vehicle_profiles SET has_satellite_radio=true
  WHERE year >= 2020
    AND make IN ('Tesla','Hyundai','Kia','Ford','Volkswagen','BMW','Audi','Volvo',
                 'Porsche','Mercedes','Genesis','Rivian','Honda','Subaru',
                 'Toyota','Cadillac','Polestar','Nissan','Chevrolet','Lucid');

-- ============================================================
-- ALARM
-- ============================================================
UPDATE vehicle_profiles SET has_alarm=true
  WHERE make IN ('Tesla','BMW','Audi','Porsche','Mercedes','Rivian','Lucid','Genesis','Polestar','Cadillac')
    AND year >= 2019;

-- ============================================================
-- CARGO VOLUME (cu ft behind rear seats, EPA/manufacturer spec)
-- ============================================================
UPDATE vehicle_profiles SET cargo_volume_cuft=15.1 WHERE make='Tesla'      AND model LIKE 'Model 3%';
UPDATE vehicle_profiles SET cargo_volume_cuft=68.0 WHERE make='Tesla'      AND model LIKE 'Model Y%';  -- with frunk
UPDATE vehicle_profiles SET cargo_volume_cuft=26.3 WHERE make='Tesla'      AND model LIKE 'Model S%';
UPDATE vehicle_profiles SET cargo_volume_cuft=88.1 WHERE make='Tesla'      AND model LIKE 'Model X%';
UPDATE vehicle_profiles SET cargo_volume_cuft=100.0 WHERE make='Tesla'     AND model LIKE 'Cybertruck%';  -- bed+vault

UPDATE vehicle_profiles SET cargo_volume_cuft=20.0 WHERE make='Chevrolet'  AND model LIKE 'Bolt EV%';
UPDATE vehicle_profiles SET cargo_volume_cuft=16.3 WHERE make='Chevrolet'  AND model LIKE 'Bolt EUV%';
UPDATE vehicle_profiles SET cargo_volume_cuft=27.8 WHERE make='Chevrolet'  AND model LIKE 'Equinox EV%';
UPDATE vehicle_profiles SET cargo_volume_cuft=17.7 WHERE make='Chevrolet'  AND model LIKE 'Blazer EV%';

UPDATE vehicle_profiles SET cargo_volume_cuft=29.0 WHERE make='Ford'       AND model LIKE 'Mustang Mach-E%';
UPDATE vehicle_profiles SET cargo_volume_cuft=55.0 WHERE make='Ford'       AND model LIKE 'F-150 Lightning%';

UPDATE vehicle_profiles SET cargo_volume_cuft=22.0 WHERE make='Hyundai'    AND model LIKE 'Ioniq 5%';
UPDATE vehicle_profiles SET cargo_volume_cuft=9.9  WHERE make='Hyundai'    AND model LIKE 'Ioniq 6%';
UPDATE vehicle_profiles SET cargo_volume_cuft=19.2 WHERE make='Hyundai'    AND model LIKE 'Kona%';

UPDATE vehicle_profiles SET cargo_volume_cuft=24.4 WHERE make='Kia'        AND model LIKE 'EV6%';
UPDATE vehicle_profiles SET cargo_volume_cuft=20.0 WHERE make='Kia'        AND model LIKE 'EV9%';  -- 3rd row folded

UPDATE vehicle_profiles SET cargo_volume_cuft=19.3 WHERE make='Volkswagen' AND model LIKE 'ID.4%';
UPDATE vehicle_profiles SET cargo_volume_cuft=8.8  WHERE make='Volkswagen' AND model LIKE 'e-Golf%';

UPDATE vehicle_profiles SET cargo_volume_cuft=23.6 WHERE make='Nissan'     AND model LIKE 'Ariya%';
UPDATE vehicle_profiles SET cargo_volume_cuft=23.6 WHERE make='Nissan'     AND model LIKE 'Leaf%';

UPDATE vehicle_profiles SET cargo_volume_cuft=68.0 WHERE make='Rivian'     AND model LIKE 'R1T%';   -- bed+tunnel
UPDATE vehicle_profiles SET cargo_volume_cuft=104.7 WHERE make='Rivian'    AND model LIKE 'R1S%';   -- all rows folded

UPDATE vehicle_profiles SET cargo_volume_cuft=35.1 WHERE make='BMW'        AND model LIKE 'iX%';
UPDATE vehicle_profiles SET cargo_volume_cuft=15.1 WHERE make='BMW'        AND model LIKE 'i4%';
UPDATE vehicle_profiles SET cargo_volume_cuft=17.0 WHERE make='BMW'        AND model LIKE 'i5%';

UPDATE vehicle_profiles SET cargo_volume_cuft=22.5 WHERE make='Mercedes'   AND model LIKE 'EQS%' AND model NOT LIKE '%SUV%';
UPDATE vehicle_profiles SET cargo_volume_cuft=16.5 WHERE make='Mercedes'   AND model LIKE 'EQE%' AND model NOT LIKE '%SUV%';

UPDATE vehicle_profiles SET cargo_volume_cuft=10.0 WHERE make='Lucid'      AND model LIKE 'Air%';

UPDATE vehicle_profiles SET cargo_volume_cuft=14.3 WHERE make='Polestar'   AND (model LIKE 'Polestar 2%' OR model LIKE '2%');
UPDATE vehicle_profiles SET cargo_volume_cuft=21.8 WHERE make='Polestar'   AND model LIKE 'Polestar 3%';

UPDATE vehicle_profiles SET cargo_volume_cuft=13.1 WHERE make='Porsche'    AND model LIKE 'Taycan%';

UPDATE vehicle_profiles SET cargo_volume_cuft=25.1 WHERE make='Audi'       AND model LIKE 'Q4%';
UPDATE vehicle_profiles SET cargo_volume_cuft=29.3 WHERE make='Audi'       AND model LIKE 'Q8%';

UPDATE vehicle_profiles SET cargo_volume_cuft=28.9 WHERE make='Cadillac'   AND model LIKE 'Lyriq%';

UPDATE vehicle_profiles SET cargo_volume_cuft=20.9 WHERE make='Volvo'      AND model LIKE 'XC40%';
UPDATE vehicle_profiles SET cargo_volume_cuft=14.1 WHERE make='Volvo'      AND model LIKE 'C40%';

UPDATE vehicle_profiles SET cargo_volume_cuft=25.0 WHERE make='Genesis'    AND model LIKE 'GV60%';
UPDATE vehicle_profiles SET cargo_volume_cuft=31.0 WHERE make='Genesis'    AND model LIKE 'GV70%';

UPDATE vehicle_profiles SET cargo_volume_cuft=19.0 WHERE make='Honda'      AND model LIKE 'Prologue%';
UPDATE vehicle_profiles SET cargo_volume_cuft=28.8 WHERE make='Subaru'     AND model LIKE 'Solterra%';
UPDATE vehicle_profiles SET cargo_volume_cuft=28.0 WHERE make='Toyota'     AND model LIKE 'bZ4X%';

UPDATE vehicle_profiles SET cargo_volume_cuft=8.7  WHERE make='Mini';

-- ============================================================
-- L2 CHARGE TIME (0–80%, hours, on a 7.2kW L2 EVSE)
-- ============================================================
UPDATE vehicle_profiles SET charge_time_l2_hours=7.5  WHERE make='Tesla'      AND model LIKE 'Model 3%' AND battery_kwh <= 60;
UPDATE vehicle_profiles SET charge_time_l2_hours=9.0  WHERE make='Tesla'      AND model LIKE 'Model 3%' AND battery_kwh >  60;
UPDATE vehicle_profiles SET charge_time_l2_hours=8.0  WHERE make='Tesla'      AND model LIKE 'Model Y%' AND battery_kwh <= 75;
UPDATE vehicle_profiles SET charge_time_l2_hours=10.0 WHERE make='Tesla'      AND model LIKE 'Model Y%' AND battery_kwh >  75;
UPDATE vehicle_profiles SET charge_time_l2_hours=10.0 WHERE make='Tesla'      AND model LIKE 'Model S%';
UPDATE vehicle_profiles SET charge_time_l2_hours=11.0 WHERE make='Tesla'      AND model LIKE 'Model X%';
UPDATE vehicle_profiles SET charge_time_l2_hours=12.0 WHERE make='Tesla'      AND model LIKE 'Cybertruck%';

UPDATE vehicle_profiles SET charge_time_l2_hours=7.0  WHERE make='Chevrolet'  AND model LIKE 'Bolt EV%';
UPDATE vehicle_profiles SET charge_time_l2_hours=7.0  WHERE make='Chevrolet'  AND model LIKE 'Bolt EUV%';
UPDATE vehicle_profiles SET charge_time_l2_hours=7.5  WHERE make='Chevrolet'  AND model LIKE 'Equinox EV%';
UPDATE vehicle_profiles SET charge_time_l2_hours=8.5  WHERE make='Chevrolet'  AND model LIKE 'Blazer EV%';

UPDATE vehicle_profiles SET charge_time_l2_hours=8.5  WHERE make='Ford'       AND model LIKE 'Mustang Mach-E%';
UPDATE vehicle_profiles SET charge_time_l2_hours=10.0 WHERE make='Ford'       AND model LIKE 'F-150 Lightning%';

UPDATE vehicle_profiles SET charge_time_l2_hours=7.0  WHERE make='Hyundai'    AND model LIKE 'Ioniq 5%';
UPDATE vehicle_profiles SET charge_time_l2_hours=6.5  WHERE make='Hyundai'    AND model LIKE 'Ioniq 6%';
UPDATE vehicle_profiles SET charge_time_l2_hours=9.0  WHERE make='Hyundai'    AND model LIKE 'Kona%';

UPDATE vehicle_profiles SET charge_time_l2_hours=6.5  WHERE make='Kia'        AND model LIKE 'EV6%';
UPDATE vehicle_profiles SET charge_time_l2_hours=9.0  WHERE make='Kia'        AND model LIKE 'EV9%';
UPDATE vehicle_profiles SET charge_time_l2_hours=8.0  WHERE make='Kia'        AND model LIKE 'Soul EV%';

UPDATE vehicle_profiles SET charge_time_l2_hours=7.5  WHERE make='Volkswagen' AND model LIKE 'ID.4%';
UPDATE vehicle_profiles SET charge_time_l2_hours=5.0  WHERE make='Volkswagen' AND model LIKE 'e-Golf%';

UPDATE vehicle_profiles SET charge_time_l2_hours=8.0  WHERE make='Nissan'     AND model LIKE 'Leaf%' AND battery_kwh <= 40;
UPDATE vehicle_profiles SET charge_time_l2_hours=11.5 WHERE make='Nissan'     AND model LIKE 'Leaf%' AND battery_kwh >  40;
UPDATE vehicle_profiles SET charge_time_l2_hours=8.0  WHERE make='Nissan'     AND model LIKE 'Ariya%';

UPDATE vehicle_profiles SET charge_time_l2_hours=12.0 WHERE make='Rivian'     AND model LIKE 'R1T%';
UPDATE vehicle_profiles SET charge_time_l2_hours=12.0 WHERE make='Rivian'     AND model LIKE 'R1S%';

UPDATE vehicle_profiles SET charge_time_l2_hours=11.0 WHERE make='BMW'        AND model LIKE 'iX%';
UPDATE vehicle_profiles SET charge_time_l2_hours=8.5  WHERE make='BMW'        AND model LIKE 'i4%';
UPDATE vehicle_profiles SET charge_time_l2_hours=9.5  WHERE make='BMW'        AND model LIKE 'i5%';

UPDATE vehicle_profiles SET charge_time_l2_hours=13.0 WHERE make='Mercedes'   AND model LIKE 'EQS%';
UPDATE vehicle_profiles SET charge_time_l2_hours=10.0 WHERE make='Mercedes'   AND model LIKE 'EQE%';

UPDATE vehicle_profiles SET charge_time_l2_hours=12.0 WHERE make='Lucid'      AND model LIKE 'Air%';

UPDATE vehicle_profiles SET charge_time_l2_hours=8.0  WHERE make='Polestar'   AND (model LIKE 'Polestar 2%' OR model LIKE '2%');
UPDATE vehicle_profiles SET charge_time_l2_hours=9.0  WHERE make='Porsche'    AND model LIKE 'Taycan%';

UPDATE vehicle_profiles SET charge_time_l2_hours=8.0  WHERE make='Audi'       AND model LIKE 'Q4%';
UPDATE vehicle_profiles SET charge_time_l2_hours=10.0 WHERE make='Audi'       AND model LIKE 'Q8%';

UPDATE vehicle_profiles SET charge_time_l2_hours=9.0  WHERE make='Cadillac'   AND model LIKE 'Lyriq%';
UPDATE vehicle_profiles SET charge_time_l2_hours=8.0  WHERE make='Volvo'      AND (model LIKE 'XC40%' OR model LIKE 'C40%');
UPDATE vehicle_profiles SET charge_time_l2_hours=7.0  WHERE make='Genesis'    AND (model LIKE 'GV60%' OR model LIKE 'GV70%');
UPDATE vehicle_profiles SET charge_time_l2_hours=8.0  WHERE make='Honda'      AND model LIKE 'Prologue%';
UPDATE vehicle_profiles SET charge_time_l2_hours=11.0 WHERE make='Subaru'     AND model LIKE 'Solterra%';
UPDATE vehicle_profiles SET charge_time_l2_hours=11.0 WHERE make='Toyota'     AND model LIKE 'bZ4X%';
UPDATE vehicle_profiles SET charge_time_l2_hours=4.0  WHERE make='Mini';

-- ============================================================
-- LEGROOM (inches, EPA front/rear)
-- ============================================================
UPDATE vehicle_profiles SET front_legroom_in=42.7, rear_legroom_in=35.2 WHERE make='Tesla'      AND model LIKE 'Model 3%';
UPDATE vehicle_profiles SET front_legroom_in=41.8, rear_legroom_in=40.5 WHERE make='Tesla'      AND model LIKE 'Model Y%';
UPDATE vehicle_profiles SET front_legroom_in=42.7, rear_legroom_in=35.4 WHERE make='Tesla'      AND model LIKE 'Model S%';
UPDATE vehicle_profiles SET front_legroom_in=40.0, rear_legroom_in=40.4 WHERE make='Tesla'      AND model LIKE 'Model X%';
UPDATE vehicle_profiles SET front_legroom_in=41.8, rear_legroom_in=35.0 WHERE make='Tesla'      AND model LIKE 'Cybertruck%';

UPDATE vehicle_profiles SET front_legroom_in=42.0, rear_legroom_in=36.5 WHERE make='Chevrolet'  AND model LIKE 'Bolt EV%';
UPDATE vehicle_profiles SET front_legroom_in=42.0, rear_legroom_in=37.8 WHERE make='Chevrolet'  AND model LIKE 'Bolt EUV%';
UPDATE vehicle_profiles SET front_legroom_in=41.9, rear_legroom_in=39.1 WHERE make='Chevrolet'  AND model LIKE 'Equinox EV%';

UPDATE vehicle_profiles SET front_legroom_in=40.7, rear_legroom_in=38.1 WHERE make='Ford'       AND model LIKE 'Mustang Mach-E%';
UPDATE vehicle_profiles SET front_legroom_in=43.9, rear_legroom_in=43.7 WHERE make='Ford'       AND model LIKE 'F-150 Lightning%';

UPDATE vehicle_profiles SET front_legroom_in=42.3, rear_legroom_in=38.4 WHERE make='Hyundai'    AND model LIKE 'Ioniq 5%';
UPDATE vehicle_profiles SET front_legroom_in=42.3, rear_legroom_in=35.7 WHERE make='Hyundai'    AND model LIKE 'Ioniq 6%';

UPDATE vehicle_profiles SET front_legroom_in=41.9, rear_legroom_in=38.0 WHERE make='Kia'        AND model LIKE 'EV6%';
UPDATE vehicle_profiles SET front_legroom_in=42.6, rear_legroom_in=38.6 WHERE make='Kia'        AND model LIKE 'EV9%';

UPDATE vehicle_profiles SET front_legroom_in=41.1, rear_legroom_in=35.2 WHERE make='Volkswagen' AND model LIKE 'ID.4%';

UPDATE vehicle_profiles SET front_legroom_in=42.1, rear_legroom_in=33.5 WHERE make='Nissan'     AND model LIKE 'Leaf%';
UPDATE vehicle_profiles SET front_legroom_in=42.6, rear_legroom_in=38.0 WHERE make='Nissan'     AND model LIKE 'Ariya%';

UPDATE vehicle_profiles SET front_legroom_in=42.9, rear_legroom_in=38.7 WHERE make='Rivian'     AND model LIKE 'R1T%';
UPDATE vehicle_profiles SET front_legroom_in=42.9, rear_legroom_in=38.7 WHERE make='Rivian'     AND model LIKE 'R1S%';

UPDATE vehicle_profiles SET front_legroom_in=41.5, rear_legroom_in=37.4 WHERE make='BMW'        AND model LIKE 'iX%';
UPDATE vehicle_profiles SET front_legroom_in=42.0, rear_legroom_in=35.2 WHERE make='BMW'        AND model LIKE 'i4%';
UPDATE vehicle_profiles SET front_legroom_in=42.0, rear_legroom_in=37.2 WHERE make='BMW'        AND model LIKE 'i5%';

UPDATE vehicle_profiles SET front_legroom_in=44.3, rear_legroom_in=40.8 WHERE make='Mercedes'   AND model LIKE 'EQS%' AND model NOT LIKE '%SUV%';
UPDATE vehicle_profiles SET front_legroom_in=41.5, rear_legroom_in=38.0 WHERE make='Mercedes'   AND model LIKE 'EQE%' AND model NOT LIKE '%SUV%';

UPDATE vehicle_profiles SET front_legroom_in=42.8, rear_legroom_in=38.4 WHERE make='Lucid'      AND model LIKE 'Air%';

UPDATE vehicle_profiles SET front_legroom_in=41.7, rear_legroom_in=35.6 WHERE make='Polestar'   AND (model LIKE 'Polestar 2%' OR model LIKE '2%');
UPDATE vehicle_profiles SET front_legroom_in=41.5, rear_legroom_in=35.2 WHERE make='Porsche'    AND model LIKE 'Taycan%';

UPDATE vehicle_profiles SET front_legroom_in=40.3, rear_legroom_in=35.0 WHERE make='Audi'       AND model LIKE 'Q4%';
UPDATE vehicle_profiles SET front_legroom_in=41.8, rear_legroom_in=36.5 WHERE make='Audi'       AND model LIKE 'Q8%';

UPDATE vehicle_profiles SET front_legroom_in=41.3, rear_legroom_in=38.7 WHERE make='Cadillac'   AND model LIKE 'Lyriq%';
UPDATE vehicle_profiles SET front_legroom_in=41.1, rear_legroom_in=36.8 WHERE make='Volvo'      AND (model LIKE 'XC40%' OR model LIKE 'C40%');
UPDATE vehicle_profiles SET front_legroom_in=42.0, rear_legroom_in=38.0 WHERE make='Genesis'    AND model LIKE 'GV60%';
UPDATE vehicle_profiles SET front_legroom_in=42.0, rear_legroom_in=38.5 WHERE make='Genesis'    AND model LIKE 'GV70%';
UPDATE vehicle_profiles SET front_legroom_in=41.4, rear_legroom_in=39.0 WHERE make='Honda'      AND model LIKE 'Prologue%';
UPDATE vehicle_profiles SET front_legroom_in=41.4, rear_legroom_in=37.4 WHERE make='Subaru'     AND model LIKE 'Solterra%';
UPDATE vehicle_profiles SET front_legroom_in=41.4, rear_legroom_in=36.0 WHERE make='Toyota'     AND model LIKE 'bZ4X%';
UPDATE vehicle_profiles SET front_legroom_in=39.5, rear_legroom_in=31.5 WHERE make='Mini';
