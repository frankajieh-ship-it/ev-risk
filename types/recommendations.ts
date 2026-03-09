/**
 * Vehicle Recommendation Types
 *
 * Used by /api/recommendations and the VehicleRecommendations UI component.
 */

import type { RoutineFitScore } from "./v2";

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

  /** Parsed from model string */
  make: string;
  model_short: string;
  sub_category: string;

  /** Matched dealer inventory */
  dealer_listings: DealerListingMatch[];

  /** Score improvement suggestions */
  score_improvements?: ScoreImprovement[];
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
