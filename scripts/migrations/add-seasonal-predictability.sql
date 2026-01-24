-- P0/P1 Migration: Add seasonal sensitivity, predictability, and planning tolerance fields
-- Run date: 2025-01
--
-- Prerequisites: evroutine_sessions table must exist (see create-evroutine-sessions.sql)

-- ============================================
-- NEW ENUM TYPES
-- ============================================

DO $$ BEGIN
  CREATE TYPE climate_seasonality_enum AS ENUM (
    'MILD', 'COLD_WINTER', 'HOT_SUMMER', 'MIXED', 'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE winter_long_days_enum AS ENUM (
    'RARE', 'MONTHLY', 'WEEKLY', 'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parked_outside_enum AS ENUM (
    'YES', 'NO', 'SOMETIMES', 'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE seasonal_sensitivity_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE predictability_level_enum AS ENUM ('HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE charging_anchor_enum AS ENUM (
    'HOME', 'WORK', 'DESTINATION', 'PUBLIC_ANCHOR', 'NONE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE backup_option_enum AS ENUM (
    'YES_RELIABLE', 'MAYBE', 'NONE', 'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE planning_tolerance_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE thread_type_enum AS ENUM (
    'first_ev', 'no_home_charging', 'comparison', 'relocation',
    'winter', 'battery_health', 'company_car', 'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- ALTER SESSIONS TABLE - ADD NEW COLUMNS
-- ============================================

-- Seasonal Inputs
ALTER TABLE evroutine_sessions
  ADD COLUMN IF NOT EXISTS climate_seasonality climate_seasonality_enum;

ALTER TABLE evroutine_sessions
  ADD COLUMN IF NOT EXISTS winter_long_days winter_long_days_enum;

ALTER TABLE evroutine_sessions
  ADD COLUMN IF NOT EXISTS parked_outside parked_outside_enum;

-- Seasonal Outputs
ALTER TABLE evroutine_sessions
  ADD COLUMN IF NOT EXISTS seasonal_sensitivity seasonal_sensitivity_enum;

ALTER TABLE evroutine_sessions
  ADD COLUMN IF NOT EXISTS seasonal_trigger_tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Predictability Inputs
ALTER TABLE evroutine_sessions
  ADD COLUMN IF NOT EXISTS charging_anchor_type charging_anchor_enum;

ALTER TABLE evroutine_sessions
  ADD COLUMN IF NOT EXISTS backup_option backup_option_enum;

ALTER TABLE evroutine_sessions
  ADD COLUMN IF NOT EXISTS public_anchor_reliability TEXT;

-- Predictability Outputs
ALTER TABLE evroutine_sessions
  ADD COLUMN IF NOT EXISTS predictability_level predictability_level_enum;

-- Planning Tolerance
ALTER TABLE evroutine_sessions
  ADD COLUMN IF NOT EXISTS planning_tolerance planning_tolerance_enum;

-- Thread Type (upgrade from TEXT to enum for analytics)
-- Note: thread_type already exists as TEXT in original schema, leave as-is for compatibility

-- ============================================
-- INDEXES FOR NEW COLUMNS
-- ============================================

CREATE INDEX IF NOT EXISTS evroutine_sessions_seasonal_sensitivity_idx
  ON evroutine_sessions (seasonal_sensitivity);

CREATE INDEX IF NOT EXISTS evroutine_sessions_predictability_level_idx
  ON evroutine_sessions (predictability_level);

CREATE INDEX IF NOT EXISTS evroutine_sessions_planning_tolerance_idx
  ON evroutine_sessions (planning_tolerance);

CREATE INDEX IF NOT EXISTS evroutine_sessions_climate_seasonality_idx
  ON evroutine_sessions (climate_seasonality);

-- ============================================
-- ALTER COMPARISONS TABLE - ADD SAME COLUMNS
-- ============================================

ALTER TABLE evroutine_comparisons
  ADD COLUMN IF NOT EXISTS climate_seasonality climate_seasonality_enum;

ALTER TABLE evroutine_comparisons
  ADD COLUMN IF NOT EXISTS seasonal_sensitivity seasonal_sensitivity_enum;

ALTER TABLE evroutine_comparisons
  ADD COLUMN IF NOT EXISTS predictability_level predictability_level_enum;

ALTER TABLE evroutine_comparisons
  ADD COLUMN IF NOT EXISTS planning_tolerance planning_tolerance_enum;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN evroutine_sessions.climate_seasonality IS
  'User climate zone: MILD, COLD_WINTER, HOT_SUMMER, MIXED, or UNKNOWN';

COMMENT ON COLUMN evroutine_sessions.winter_long_days IS
  'Frequency of long driving days in winter: RARE, MONTHLY, WEEKLY, UNKNOWN';

COMMENT ON COLUMN evroutine_sessions.parked_outside IS
  'Cold-soak sensitivity proxy: YES, NO, SOMETIMES, UNKNOWN';

COMMENT ON COLUMN evroutine_sessions.seasonal_sensitivity IS
  'Engine output: LOW, MEDIUM, or HIGH seasonal friction sensitivity';

COMMENT ON COLUMN evroutine_sessions.seasonal_trigger_tags IS
  'Array of tags: WINTER_BUFFER_COMPRESSION, COLD_RECOVERY_RISK, etc.';

COMMENT ON COLUMN evroutine_sessions.charging_anchor_type IS
  'Primary charging anchor: HOME, WORK, DESTINATION, PUBLIC_ANCHOR, or NONE';

COMMENT ON COLUMN evroutine_sessions.backup_option IS
  'Backup charging reliability: YES_RELIABLE, MAYBE, NONE, UNKNOWN';

COMMENT ON COLUMN evroutine_sessions.predictability_level IS
  'Engine output: HIGH, MEDIUM, or LOW charging predictability';

COMMENT ON COLUMN evroutine_sessions.planning_tolerance IS
  'Derived from exec/downtime tolerance: LOW, MEDIUM, or HIGH';
