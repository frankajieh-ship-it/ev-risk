/**
 * Behavioral Pattern Tracking Schema
 *
 * Purpose: Track the gap between pre-purchase assumptions and actual EV ownership experiences
 * Use case: Mental Overhead research - understanding charging anxiety root causes
 *
 * Key insight: "More chargers ≠ less anxiety" - predictability matters more than quantity
 */

export type DataSource =
  | "reddit_electricvehicles"
  | "reddit_evs"
  | "reddit_teslamotors"
  | "reddit_leaf"
  | "reddit_bolt"
  | "youtube_comments"
  | "user_feedback"
  | "support_tickets"
  | "direct_interview";

export type HousingType =
  | "apartment"
  | "condo"
  | "single_family_home"
  | "townhouse"
  | "other";

export type Region =
  | "Northeast"
  | "Southeast"
  | "Midwest"
  | "Southwest"
  | "West"
  | "Pacific_Northwest"
  | "Mountain_West"
  | "International";

export type OwnershipStage =
  | "considering"
  | "researching"
  | "test_driving"
  | "pre_purchase"
  | "first_month"
  | "1_3_months"
  | "3_6_months"
  | "6_12_months"
  | "1_2_years"
  | "2_plus_years";

export type ChargingAccess =
  | "home_l2"
  | "home_l1"
  | "apartment_shared_l2"
  | "apartment_nearby_dcfc"
  | "public_l2_primary"
  | "dcfc_primary"
  | "workplace_primary"
  | "mixed"
  | "public_only"
  | "none";

export type CognitiveLoadRating = 1 | 2 | 3 | 4 | 5; // 1 = low, 5 = extreme

export type PatternTag =
  | "charging_anxiety"
  | "apartment_living"
  | "perception_gap"
  | "assumption_drift"
  | "mental_overhead"
  | "routine_friction"
  | "predictability_issue"
  | "availability_issue"
  | "backup_plan_need"
  | "seasonal_variation"
  | "cold_weather_impact"
  | "fit_mismatch"
  | "regret"
  | "adaptation_success"
  | "behavioral_workaround";

/**
 * Behavioral Pattern Type (CMO Phase 2 - Required Field)
 * Maps patterns directly to product blocks
 */
export type BehavioralPatternType =
  | "charging_predictability_failure"
  | "routine_friction_planning_burden"
  | "edge_case_dominance"
  | "battery_uncertainty_amplification"
  | "infrastructure_uncertainty"
  | "expectation_mismatch"
  | "successful_low_overhead_fit";

/**
 * Product Surface Impacted (CMO Phase 2 - Required Field)
 * Ensures insights land in product decisions
 */
export type ProductSurface =
  | "phase_0_5_messaging"
  | "charging_fit_block"
  | "battery_health_block"
  | "decision_state_summary"
  | "language_terminology"
  | "do_not_ship_guardrail";

/**
 * User Context: Situational factors
 */
export interface UserContext {
  housing: HousingType;
  region: Region;
  ownership_stage: OwnershipStage;
  charging_access: ChargingAccess;
  vehicle_model?: string;
  daily_miles?: number;
  commute_distance?: number;
}

/**
 * Behavioral Pattern: The core insight
 *
 * Captures the gap between what users believed pre-purchase
 * and what they actually experienced
 */
export interface BehavioralPattern {
  // What they thought before buying
  pre_purchase_assumption: string;

  // What actually happened
  actual_experience: string;

  // The underlying cause (our analysis)
  root_cause: string;

  // Quantified mental load
  cognitive_load_rating: CognitiveLoadRating;

  // Outcome classification
  outcome: "adapted_successfully" | "ongoing_friction" | "regret" | "resolved";

  // Timeline
  when_discovered?: string; // e.g., "first week", "after 3 months", "winter"

  // Evidence strength
  confidence: "high" | "medium" | "low"; // How confident are we in this pattern extraction?

  // CMO Phase 2 - Required Fields
  pattern_type: BehavioralPatternType; // Maps directly to product blocks
  product_surfaces_impacted: ProductSurface[]; // Multi-select - must have at least one
}

/**
 * Complete Pattern Record
 */
export interface BehavioralPatternRecord {
  id: string;
  source: DataSource;
  timestamp: string; // ISO 8601
  source_url?: string; // Link to Reddit post, YouTube comment, etc.
  user_context: UserContext;
  behavioral_pattern: BehavioralPattern;
  tags: PatternTag[];

  // Metadata
  extracted_by?: string; // "claude" | "manual" | "automated"
  notes?: string; // Additional context
  created_at: string;
  updated_at: string;
}

/**
 * Pattern Analysis View (Aggregated Insights)
 */
export interface PatternAnalysis {
  pattern_cluster: string; // e.g., "Charger quantity ≠ reduced anxiety"
  frequency: number; // How often this pattern appears
  housing_breakdown: Record<HousingType, number>;
  region_breakdown: Record<Region, number>;
  avg_cognitive_load: number;
  common_root_causes: string[];
  sample_quotes: string[]; // Representative pre_purchase_assumption or actual_experience
  outcome_distribution: {
    adapted_successfully: number;
    ongoing_friction: number;
    regret: number;
    resolved: number;
  };
}

/**
 * Example Pattern Record
 */
export const examplePattern: BehavioralPatternRecord = {
  id: "bp_001",
  source: "reddit_electricvehicles",
  timestamp: "2024-03-15T14:30:00Z",
  source_url: "https://reddit.com/r/electricvehicles/comments/example",
  user_context: {
    housing: "apartment",
    region: "Northeast",
    ownership_stage: "3_6_months",
    charging_access: "public_only",
    vehicle_model: "Nissan Leaf",
    daily_miles: 30,
  },
  behavioral_pattern: {
    pre_purchase_assumption:
      "More chargers = less anxiety. Area has 15+ public L2 stations within 2 miles.",
    actual_experience:
      "Still anxious despite many chargers. Never know if they'll be available when I need them.",
    root_cause:
      "Unpredictable availability, not quantity. Planning overhead from constantly checking apps.",
    cognitive_load_rating: 4,
    outcome: "ongoing_friction",
    when_discovered: "first month",
    confidence: "high",
    pattern_type: "charging_predictability_failure",
    product_surfaces_impacted: ["charging_fit_block", "phase_0_5_messaging"],
  },
  tags: [
    "charging_anxiety",
    "apartment_living",
    "perception_gap",
    "predictability_issue",
    "mental_overhead",
  ],
  extracted_by: "claude",
  notes:
    "User mentioned checking PlugShare 3-4x per day. Classic predictability vs availability gap.",
  created_at: "2024-03-15T15:00:00Z",
  updated_at: "2024-03-15T15:00:00Z",
};
