/**
 * Vehicle Recommendation Types
 *
 * Used by /api/recommendations and the VehicleRecommendations UI component.
 */

import type { RoutineFitScore } from "./v2";

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
}
