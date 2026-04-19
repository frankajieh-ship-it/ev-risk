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
  budget: number;
  utility: number;
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
    verdict: "GREEN" | "YELLOW" | "RED" | null;
    risk_flags: string[] | null;
    deal_quality_score: number | null;
    receipt_id: string | null;
    photo_url: string | null;
    url_domain: string | null;
    last_analyzed_at: string | null;
  }>;
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
