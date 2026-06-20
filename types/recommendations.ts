/**
 * Vehicle Recommendation Types
 *
 * Used by /api/recommendations and the VehicleRecommendations UI component.
 */

import type { RoutineFitScore, OffoScore } from "./v2";
import type { OwnershipCost5Y } from "@/lib/ownership-cost";

export interface ScoreImprovement {
  type: "routine_change" | "vehicle_selection" | "optimized";
  suggestion: string;
  score_delta: number;
  dimension: string;
  priority: number;
}

export interface DealerListingMatch {
  dealer_name: string;
  dealer_slug: string;
  dealer_city: string;
  dealer_state: string;
  listing_count: number;
  price_range_cents?: { min: number; max: number };
}

/** Per-dimension fit scores (0–100 each) from compute-routine-fit.ts */
export interface FitDimensions {
  charging: number;
  range: number;
  recovery: number;
  climate: number;
  budget?: number;
  utility?: number;
}

/** Bucketed chip labels for the tie-break comparison UI */
export interface TieChips {
  buffer:   "strong" | "ok" | "tight";
  charging: "low" | "medium" | "high";    // charging burden (inverted from score)
  winter:   "safe" | "moderate" | "tight";
  budget:   "likely" | "uncertain";
  space:    "compact" | "midsize" | "large";
}

export interface VehicleRecommendation {
  /** Full model name from range_delta.csv, e.g. "Tesla Model 3 Long Range" */
  model: string;
  year: number;
  epa_range_mi: number;
  real_world_range_mi: number;
  battery_kwh: number;
  chemistry: string;

  /** Fit scoring outputs */
  fit_score: number;
  fit_label: RoutineFitScore["label"];
  mental_load: RoutineFitScore["mental_load"];
  top_stress_flag?: string;

  /** Individual dimension scores — used for tie-breaking and chip display */
  dimensions?: FitDimensions;

  /** Bucketed chip labels derived from dimensions — shown in tie-break comparison */
  tie_chips?: TieChips;

  /** Parsed from model string */
  make: string;
  model_short: string;
  sub_category: string;

  /** Matched dealer inventory */
  dealer_listings: DealerListingMatch[];

  /** Score improvement suggestions */
  score_improvements?: ScoreImprovement[];

  /** 5-year total cost of ownership estimate */
  ownership_cost_5y?: OwnershipCost5Y;

  /** Computed MSRP — carried through from scoring data for ownership cost */
  msrp_usd?: number;

  /** Peak DC fast-charge rate in kW (from vehicle catalog) */
  dc_fast_kw?: number;

  /** Whether this vehicle is currently eligible for the federal $7,500 new-EV tax credit */
  incentive_new?: boolean;

  /** Maximum seating capacity */
  seating_capacity?: number;
  /** Cargo volume behind rear seats (cu ft) */
  cargo_volume_cuft?: number;
  /** Combined system horsepower */
  hp_combined?: number;
  /** 0–60 mph time in seconds */
  zero_to_60_sec?: number;
  /** Actual max tow rating in lbs (0 = not rated) */
  tow_capacity_lbs?: number;
  /** Battery warranty in years */
  battery_warranty_years?: number;
  /** Whether this vehicle has a factory heat pump */
  has_heat_pump?: boolean;
  /** One-liner explaining why this vehicle fits the user's routine */
  fit_reason?: string;
  /** Body style classification */
  body_type?: "suv" | "sedan" | "hatchback" | "crossover" | "truck" | "van" | "coupe";
  /** Unified OFFO score for this vehicle in retail context */
  offo_score?: OffoScore;

  /** Closest matching curated deals from the DB (populated server-side for fit_score >= 70) */
  matched_deals?: Array<{
    id: string;
    listing_url: string;
    vehicle_label: string;
    make: string | null;
    model: string | null;
    year: number | null;
    price: number | null;
    mileage: number | null;
    receipt_id: string | null;
    photo_url: string | null;
    url_domain: string | null;
  }>;

  /** Live MarketCheck listings fetched at request time (top 5 recs only) */
  live_listings?: Array<{
    id: string;
    vin: string;
    price?: number;
    miles?: number;
    vdp_url?: string;
    source?: string;
    exterior_color?: string;
    carfax_clean_title?: boolean;
    dealer?: { name?: string; city?: string; state?: string };
  }>;

  // Phase 2 rich specs (carried from vehicle_profiles)
  drivetrain?: "awd" | "rwd" | "fwd";
  charge_time_l2_hours?: number;
  has_carplay?: boolean;
  has_android_auto?: boolean;
  has_keyless_entry?: boolean;
  has_alarm?: boolean;
  has_satellite_radio?: boolean;

  // Phase 2b rich specs
  has_ac?: boolean;
  has_power_windows?: boolean;
  has_power_locks?: boolean;
  has_power_steering?: boolean;
  has_tilt_wheel?: boolean;
  has_am_fm_radio?: boolean;
  has_immobilizer?: boolean;
  has_active_seatbelts?: boolean;
  has_passenger_airbag?: boolean;
  has_dual_airbags?: boolean;
  has_side_airbags?: boolean;
  has_abs?: boolean;
  doors?: number;
  front_legroom_in?: number;
  rear_legroom_in?: number;
  exterior_colors?: string[];
  interior_colors?: string[];
}

export interface CuratedDealMatch {
  id: string;
  listing_url: string;
  vehicle_label: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  price: number | null;
  mileage: number | null;
  location: string | null;
  photo_url: string | null;
  receipt_id: string | null;
  url_domain: string | null;
  body_type: string | null;
  drivetrain: string | null;
  epa_range_mi: number | null;
  exterior_color: string | null;
  interior_color: string | null;
  match_score: number;
  fit_label: string;
  match_reasons: string[];
}

export interface MarketCheckFallback {
  id: string;
  vin: string;
  heading: string;
  price: number | null;
  miles: number | null;
  vdp_url: string | null;
  exterior_color: string | null;
  photo_url: string | null;
  dealer_name: string | null;
  dealer_city: string | null;
  dealer_state: string | null;
}

export interface DealsMatchResponse {
  success: boolean;
  matches: CuratedDealMatch[];
  total_matched: number;
  filters_applied: string[];
  fallback_listings?: MarketCheckFallback[];
}

export interface DataSources {
  weather_live: boolean;
  chargers_live: boolean;
  weather_temp_f?: number;
  weather_condition?: string;
  charger_count: number;
  location_name?: string;
}

export interface RecommendationsResponse {
  success: boolean;
  recommendations: VehicleRecommendation[];
  dealer_questions: {
    top_3: string[];
    full_list: string[];
    walk_away_triggers: string[];
  };
  routine_summary: {
    charging_access: string;
    weekly_miles: number;
    climate: string;
  };
  data_sources?: DataSources;
  user_zip_code?: string | null;
}
