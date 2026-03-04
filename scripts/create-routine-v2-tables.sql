-- EVRoutine V2 Schema
-- Run manually against Supabase SQL Editor
-- Creates 5 tables for routine reliability planner

-- ============================================
-- 1. vehicle_profiles — Curated EV presets (bands, not precision)
-- ============================================

CREATE TABLE IF NOT EXISTS vehicle_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,

  -- Range (band-based)
  usable_range_band TEXT NOT NULL CHECK (usable_range_band IN ('low', 'medium', 'high')),
  usable_range_mi_estimate INTEGER,
  epa_range_mi INTEGER,
  real_world_range_mi INTEGER,

  -- Charging speed (bands)
  dc_fast_band TEXT NOT NULL CHECK (dc_fast_band IN ('slow', 'okay', 'strong')),
  ac_home_charge_band TEXT NOT NULL CHECK (ac_home_charge_band IN ('slow', 'okay', 'strong')),

  -- Climate sensitivity
  winter_sensitivity_band TEXT NOT NULL CHECK (winter_sensitivity_band IN ('mild', 'moderate', 'strong')),

  -- Efficiency
  efficiency_band TEXT NOT NULL CHECK (efficiency_band IN ('low', 'medium', 'high')),

  -- Battery
  battery_kwh NUMERIC(5,1),
  chemistry TEXT,

  -- Connector profile
  connector_types TEXT[] DEFAULT '{}',

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  data_source TEXT DEFAULT 'range_delta_csv',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_profiles_make_model ON vehicle_profiles(make, model);
CREATE INDEX IF NOT EXISTS idx_vehicle_profiles_year ON vehicle_profiles(year DESC);

-- ============================================
-- 2. routine_profiles — User routine configuration
-- ============================================

CREATE TABLE IF NOT EXISTS routine_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  anon_session_id TEXT,

  -- Location (manual entry, no geolocation required)
  home_location_zip TEXT,
  work_location_zip TEXT,
  region TEXT DEFAULT 'US' CHECK (region IN ('US', 'UK')),

  -- Climate
  climate_band TEXT NOT NULL CHECK (climate_band IN ('winter', 'mild', 'hot')),
  climate_auto_detected BOOLEAN DEFAULT false,

  -- Charging
  home_charging TEXT NOT NULL CHECK (home_charging IN ('home', 'work', 'public')),

  -- Vehicle
  vehicle_profile_id UUID REFERENCES vehicle_profiles(id) ON DELETE SET NULL,
  vehicle_year INTEGER,
  vehicle_make TEXT,
  vehicle_model TEXT,

  -- Routine pattern
  weekly_miles INTEGER,
  commute_miles_roundtrip INTEGER,
  longest_day_pattern TEXT NOT NULL CHECK (longest_day_pattern IN ('once_a_week', 'monthly_trip', 'rare_road_trip')),

  -- Household
  shared_charger BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- At least one identity required
  CHECK (user_id IS NOT NULL OR anon_session_id IS NOT NULL),
  -- At least one mileage field required
  CHECK (weekly_miles IS NOT NULL OR commute_miles_roundtrip IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_routine_profiles_user ON routine_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_profiles_anon ON routine_profiles(anon_session_id);

-- ============================================
-- 3. saved_chargers — User's mapped chargers
-- ============================================

CREATE TABLE IF NOT EXISTS saved_chargers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  anon_session_id TEXT,

  -- Charger identity
  charger_source TEXT NOT NULL,
  external_id TEXT,
  name TEXT NOT NULL,

  -- Location
  lat NUMERIC(9,6) NOT NULL,
  lng NUMERIC(9,6) NOT NULL,
  address TEXT,

  -- Capabilities
  connector_types TEXT[] DEFAULT '{}',
  max_power_kw NUMERIC(5,1),
  level_type TEXT CHECK (level_type IN ('L2', 'DCFC', 'unknown')),

  -- Classification
  category TEXT DEFAULT 'occasional' CHECK (category IN ('anchor', 'backup', 'occasional')),
  reliability_rating TEXT DEFAULT 'unknown' CHECK (reliability_rating IN ('high', 'medium', 'low', 'unknown')),

  -- User annotations
  user_notes TEXT,
  is_favorite BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,

  CHECK (user_id IS NOT NULL OR anon_session_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_saved_chargers_user ON saved_chargers(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_chargers_anon ON saved_chargers(anon_session_id);

-- ============================================
-- 4. routine_runs — Each analysis run
-- ============================================

CREATE TABLE IF NOT EXISTS routine_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES routine_profiles(id) ON DELETE CASCADE,

  -- Run type
  run_type TEXT DEFAULT 'baseline' CHECK (run_type IN ('baseline', 'scenario')),
  scenario_name TEXT,

  -- Inputs snapshot (denormalized for reproducibility)
  inputs_json JSONB NOT NULL,

  -- Outputs
  outputs_json JSONB NOT NULL,

  -- Top-level metrics (for querying)
  friction_score INTEGER,
  fit_label TEXT,
  stress_level TEXT,
  break_first_id TEXT,
  break_first_reason TEXT,

  -- Confidence
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),

  -- API success flags
  weather_api_success BOOLEAN,
  charger_api_success BOOLEAN,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routine_runs_profile ON routine_runs(profile_id);
CREATE INDEX IF NOT EXISTS idx_routine_runs_label ON routine_runs(fit_label);
CREATE INDEX IF NOT EXISTS idx_routine_runs_created ON routine_runs(created_at DESC);

-- ============================================
-- 5. plan_b_cards — Generated Plan B recommendations
-- ============================================

CREATE TABLE IF NOT EXISTS plan_b_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES routine_runs(id) ON DELETE CASCADE,
  charger_id UUID REFERENCES saved_chargers(id) ON DELETE SET NULL,

  -- Plan summary
  plan_summary TEXT NOT NULL,
  anchor_charger_name TEXT,
  backup_charger_name TEXT,

  -- Impact assessment
  time_penalty_minutes INTEGER,
  stress_label TEXT CHECK (stress_label IN ('minimal', 'moderate', 'high')),

  -- Mitigation steps
  mitigation_steps TEXT[] DEFAULT '{}',
  buffer_rule TEXT,

  -- Ranking
  rank_score INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_b_cards_run ON plan_b_cards(run_id);

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- DROP TABLE IF EXISTS plan_b_cards;
-- DROP TABLE IF EXISTS routine_runs;
-- DROP TABLE IF EXISTS saved_chargers;
-- DROP TABLE IF EXISTS routine_profiles;
-- DROP TABLE IF EXISTS vehicle_profiles;
