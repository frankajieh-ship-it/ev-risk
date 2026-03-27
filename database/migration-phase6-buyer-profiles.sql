-- Phase 6: Expanded Buyer Profiles
-- Creates buyer_profiles table with deterministic match scoring.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS buyer_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Stable anonymized identifier (sha256 of user_id:dealership_id, 16-char hex)
  -- Not a FK — computed at query time per dealership.
  profile_id            TEXT NOT NULL,
  dealership_id         UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  -- Vehicle being researched
  garage_vehicle_id     UUID,   -- FK to garage_vehicles.id (nullable if deleted)
  vehicle_make          TEXT NOT NULL,
  vehicle_model         TEXT NOT NULL,
  vehicle_year          INT,

  -- Deterministic match score (0–100)
  -- Components: vehicle_similarity(35) + charging_compat(20) +
  --             commute_fit(20) + winter_suitability(15) + engagement_strength(10)
  inventory_match_score INT,
  score_breakdown       JSONB,   -- {"vehicle_similarity": 30, "charging_compat": 20, ...}

  -- Routine / lifestyle fit
  home_charging         BOOLEAN,
  weekly_miles          INT,
  fit_score             INT,     -- from saved_scenarios.scenario_data.fit_score
  buyer_type_tags       TEXT[],  -- normalized tags: ["daily_commuter", "road_tripper", ...]

  -- Anonymized summary for dealer (no PII, no raw quotes)
  anonymized_summary    TEXT,    -- template-based: "Buyer researching 2024 Model 3 with home charging..."
  routine_fit           TEXT,    -- "Good fit — daily commute within range, home charging available"
  key_routine_details   JSONB,   -- {"commute_miles": 35, "road_trips": true, "cold_climate": false}

  -- AI chat signals (aggregated from chat_messages.extracted_signals)
  ai_chat_signals       JSONB,   -- {"signals": [...], "signal_strength": "high", "last_extracted_at": ...}
  signal_strength       TEXT,    -- "high" | "medium" | "low" | "none" — denormalized for fast filter

  -- Geo
  geo_metro             TEXT,

  -- Timestamps
  last_active_at        TIMESTAMPTZ,

  UNIQUE (profile_id, dealership_id, vehicle_make, vehicle_model)
);

CREATE INDEX IF NOT EXISTS idx_buyer_profiles_dealership
  ON buyer_profiles (dealership_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_buyer_profiles_score
  ON buyer_profiles (dealership_id, inventory_match_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_buyer_profiles_signal_strength
  ON buyer_profiles (dealership_id, signal_strength)
  WHERE signal_strength IN ('high', 'medium');

CREATE INDEX IF NOT EXISTS idx_buyer_profiles_profile_id
  ON buyer_profiles (profile_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_buyer_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_buyer_profiles_updated_at ON buyer_profiles;
CREATE TRIGGER trg_buyer_profiles_updated_at
  BEFORE UPDATE ON buyer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_buyer_profiles_updated_at();
