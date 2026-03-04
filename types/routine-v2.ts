/**
 * EVRoutine V2 Types
 *
 * Extended types for the routine reliability planner.
 * Imports core scoring types from types/v2.ts.
 */

import type { MinimumViableRoutine, RoutineFitScore } from "./v2";

// ============================================
// VEHICLE PROFILE (Preset)
// ============================================

export interface VehicleProfile {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;

  // Bands (no fake precision)
  usable_range_band: "low" | "medium" | "high";
  usable_range_mi_estimate: number;
  dc_fast_band: "slow" | "okay" | "strong";
  ac_home_charge_band: "slow" | "okay" | "strong";
  winter_sensitivity_band: "mild" | "moderate" | "strong";
  efficiency_band: "low" | "medium" | "high";

  // Technical
  battery_kwh?: number;
  chemistry?: string;
  connector_types: string[];

  // Reference data
  epa_range_mi?: number;
  real_world_range_mi?: number;

  // Meta
  is_active: boolean;
  data_source: string;
  created_at: string;
}

// ============================================
// WEATHER DATA
// ============================================

export type TemperatureBand = "freezing" | "cold" | "mild" | "warm" | "hot";

export interface WeatherData {
  source: "openweathermap" | "manual_override";

  // Current conditions
  current_temp_f: number;
  current_conditions: string;
  feels_like_f: number;

  // Temperature band (for scoring)
  temperature_band: TemperatureBand;

  // Forecast summary
  forecast_low_f: number;
  forecast_high_f: number;

  // Confidence
  weather_confidence_band: "high" | "medium" | "low";

  // Metadata
  location_used: string;
  fetched_at: string;
}

// ============================================
// CHARGER DATA
// ============================================

export interface ChargerSearchResult {
  id: string;
  source: "nrel" | "ocm" | "manual";
  external_id?: string;
  name: string;

  // Location
  lat: number;
  lng: number;
  address: string;
  distance_mi?: number;

  // Capabilities
  connector_types: string[];
  max_power_kw?: number;
  level_type: "L2" | "DCFC" | "unknown";

  // Network
  network?: string;
  access_type?: "public" | "private" | "semi-public";

  // Status (if available)
  status?: "available" | "in_use" | "offline" | "unknown";

  // Hours
  hours_24?: boolean;
  hours_description?: string;
}

export interface SavedCharger extends ChargerSearchResult {
  user_id?: string;
  anon_session_id?: string;
  category: "anchor" | "backup" | "occasional";
  reliability_rating: "high" | "medium" | "low" | "unknown";
  user_notes?: string;
  is_favorite: boolean;
  created_at: string;
  last_used_at?: string;
}

// ============================================
// ROUTINE PROFILE
// ============================================

export interface RoutineProfile {
  id: string;
  user_id?: string;
  anon_session_id?: string;

  // Location (manual entry — no geolocation required)
  home_location_zip?: string;
  work_location_zip?: string;
  region: "US" | "UK";

  // Climate
  climate_band: "winter" | "mild" | "hot";
  climate_auto_detected: boolean;

  // Charging
  home_charging: "home" | "work" | "public";

  // Vehicle
  vehicle_profile_id?: string;
  vehicle_year?: number;
  vehicle_make?: string;
  vehicle_model?: string;

  // Routine pattern (MVR fields)
  weekly_miles?: number;
  commute_miles_roundtrip?: number;
  longest_day_pattern: "once_a_week" | "monthly_trip" | "rare_road_trip";

  // Household
  shared_charger?: boolean;

  created_at: string;
  updated_at: string;
}

// ============================================
// ROUTINE RUN
// ============================================

export interface RoutineRunInputs {
  routine: MinimumViableRoutine;
  vehicle?: VehicleProfile;
  weather?: WeatherData;
  saved_chargers?: SavedCharger[];
}

export interface RoutineRunResult {
  id: string;
  profile_id?: string;
  run_type: "baseline" | "scenario";
  scenario_name?: string;

  inputs_json: RoutineRunInputs;
  outputs_json: RoutineFitScore;

  // Top-level metrics (for querying)
  friction_score: number;
  fit_label: string;
  stress_level: string;
  break_first_id: string;
  break_first_reason: string;
  confidence_level: "high" | "medium" | "low";

  // API success flags
  weather_api_success: boolean;
  charger_api_success: boolean;

  created_at: string;
}

// ============================================
// PLAN B CARD
// ============================================

export interface PlanBCard {
  id: string;
  run_id: string;
  charger_id?: string;

  plan_summary: string;
  anchor_charger_name?: string;
  backup_charger_name?: string;

  time_penalty_minutes: number;
  stress_label: "minimal" | "moderate" | "high";

  mitigation_steps: string[];
  buffer_rule: string;

  rank_score: number;

  created_at: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface RoutineRunResponse {
  run_id: string;
  fit_score: RoutineFitScore;
  plan_b: Omit<PlanBCard, "id" | "run_id" | "created_at">;
  weather_data?: WeatherData;
  nearby_chargers: ChargerSearchResult[];
}
