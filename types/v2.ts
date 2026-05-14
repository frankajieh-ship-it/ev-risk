/**
 * EV-Risk V2 Schema Types
 *
 * Primary: Routine Fit Score (stress + predictability + fallback quality)
 * Secondary: Ownership Risk Flags (battery, recall, platform, warranty)
 */

// ============================================
// MINIMUM VIABLE ROUTINE (MVR)
// ============================================

export interface MinimumViableRoutine {
  charging_access: "home" | "work" | "public";
  weekly_miles?: number;
  commute_miles_roundtrip?: number;
  climate: "winter" | "mild" | "hot";
  longest_day_pattern: "once_a_week" | "monthly_trip" | "rare_road_trip";
  region?: "US" | "UK";

  // Rich charging + routine fields (from compare BaseRoutineInput)
  has_home_charging?: boolean;
  home_charging_type?: "L1" | "L2" | "UNKNOWN";
  can_charge_at_work?: boolean;
  public_charging_dependency?: "RARE" | "SOMETIMES" | "OFTEN";
  routine_pattern?: "LOCAL" | "MIXED" | "MOTORWAY_HEAVY";
  planning_tolerance?: "LOW" | "MED" | "HIGH";
  shared_infrastructure?: "NONE" | "SOME" | "HIGH";

  // Quick Fit additions
  budget_max?: number;
  body_style?: "sedan" | "suv" | "truck" | "hatchback" | "any";
  home_type?: "house" | "apartment" | "condo" | "other";
  can_install_charger?: "yes" | "no" | "need_permission";
  overnight_dwell_hours?: number;
  shared_charger?: boolean;

  // Deep Fit additions
  longest_day_miles?: number;
  parking_exposure?: "garage" | "outdoor" | "street";
  min_comfortable_soc?: number;
  towing_needs?: "none" | "light" | "heavy";
  wants_carplay?: boolean;
  /** Number of passengers to seat regularly (used for utility fit scoring) */
  passenger_count?: number;
}

// ============================================
// VEHICLE SPECS & ACCESSORY PREFERENCES
// ============================================

export interface VehicleSpecsPrefs {
  // Section 1 — Hard filters
  drivetrain: "awd_required" | "rwd_preferred" | "fwd_ok" | "any";
  min_winter_range_mi: number; // slider: 150 | 200 | 250 | 300
  fast_charge_kw: "150plus" | "100_150" | "l2_primary";
  towing: "regularly" | "occasionally" | "rarely";

  // Section 2 — Preference scoring
  heat_pump: "must_have" | "nice_to_have" | "not_important";
  adas: ("full_adas" | "basic_cruise_lane" | "none")[]; // multi-select
  interior: "premium_touchscreen" | "simple_interface" | "any";
  wheel_size: "smaller_efficiency" | "18_19_fine" | "style_matters";
  winter_readiness: "awd_dedicated_tires" | "all_season_ok" | "mild_climate";
}

export function validateMVR(
  r: Partial<MinimumViableRoutine>
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!r.charging_access || !["home", "work", "public"].includes(r.charging_access)) {
    errors.push("charging_access required");
  }
  if (!r.climate || !["winter", "mild", "hot"].includes(r.climate)) {
    errors.push("climate required");
  }
  if (
    !r.longest_day_pattern ||
    !["once_a_week", "monthly_trip", "rare_road_trip"].includes(r.longest_day_pattern)
  ) {
    errors.push("longest_day_pattern required");
  }

  const hasWeekly = typeof r.weekly_miles === "number" && r.weekly_miles > 0;
  const hasCommute =
    typeof r.commute_miles_roundtrip === "number" && r.commute_miles_roundtrip > 0;
  if (!hasWeekly && !hasCommute) {
    errors.push("weekly_miles or commute_miles_roundtrip required");
  }

  return { ok: errors.length === 0, errors };
}

// ============================================
// ROUTINE FIT SCORE (PRIMARY)
// ============================================

export interface StressFlag {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
  routine_citation: string;
}

export interface BreakPoint {
  id: string;
  title: string;
  break_point: string;
  trigger: string;
  evidence: Array<{ label: string; value: string }>;
  impact: "Low" | "Medium" | "High";
  fallback_plan_b: {
    anchor: string;
    backup: string;
    buffer_rule: string;
  };
}

export interface ConfidenceAction {
  id: "get_vin" | "get_soh" | "get_fast_charge_history";
  title: string;
  why_it_matters: string;
  how_to_get: string[];
  message_templates: {
    seller: string;
    dealer?: string;
  };
  expected_confidence_gain_pct: number;
  required_for_modules: Array<"battery" | "warranty" | "recall" | "platform">;
}

export interface ConfidencePlan {
  current_pct: number;
  potential_pct: number;
  actions: ConfidenceAction[];
}

export interface RoutineFitConfidence {
  level: "high" | "medium" | "low";
  note: string;
  has_vehicle_data: boolean;
  has_battery_data: boolean;
}

export interface RoutineFitScore {
  score_0_100: number;
  label: "Great Fit" | "Good Fit" | "Mixed Fit" | "High Friction";
  mental_load: "low" | "medium" | "high";
  stress_flags: StressFlag[];
  breakpoints_ranked: BreakPoint[];
  confidence: RoutineFitConfidence;
  /** Individual dimension sub-scores (0–100 each). Optional for backwards compat. */
  dimensions?: {
    charging: number;
    range: number;
    recovery: number;
    climate: number;
    budget?: number;
    utility?: number;
  };
  /** 0.0–1.0 probability that the routine fails (runs out of charge, can't recover) */
  failure_probability: number;
  /** The weakest scoring dimension — primary driver of risk */
  top_risk_dimension: "charging" | "range" | "recovery" | "climate" | "budget" | "utility" | null;
  /** Score adjusted downward when vehicle data is incomplete */
  confidence_adjusted_score: number;
}

// ============================================
// OWNERSHIP RISK FLAGS (SECONDARY)
// ============================================

export interface OwnershipRiskModule {
  module_id: "battery" | "recall" | "platform" | "warranty";
  status: "green" | "yellow" | "red" | "unknown";
  label: string;
  summary: string;
  detail?: string;
  data_available: boolean;
}

export interface OwnershipRiskFlags {
  overall_risk_label: "Low ownership friction" | "Moderate ownership friction" | "High ownership friction" | "Insufficient data";
  modules: OwnershipRiskModule[];
}

// ============================================
// OFFO SCORE — unified cross-context verdict
// ============================================

export type OffoVerdict = "green" | "yellow" | "red";

export interface OffoScore {
  /** 0–100 composite score */
  offo_score: number;
  verdict: OffoVerdict;
  /** "Strong buy" | "Proceed with caution" | "High risk" */
  verdict_label: string;
  /** 2–4 deterministic bullet reasons derived from component scores */
  why: string[];
  /** 2–3 deterministic failure mode strings derived from risk factors */
  failure_modes: string[];
  confidence: "low" | "medium" | "high";
  component_scores: {
    /** From salvage scorer (auction) or ownership-cost scorer (retail) */
    financial: number;
    /** From routine fit score */
    usability: number;
    /** From specs/hardware match */
    feasibility: number;
    /** From reliability tier */
    reliability: number;
  };
  /** Which weight formula was applied */
  context: "auction" | "retail";
}

// ============================================
// V2 REPORT ENVELOPE
// ============================================

export interface EvRiskReportV2 {
  schema_version: "v2";
  report_id?: string;
  routine: MinimumViableRoutine;
  vehicle?: {
    make: string;
    model: string;
    year: number;
    mileage?: number;
  };
  primary: {
    routine_fit: RoutineFitScore;
  };
  secondary: {
    ownership_risk: OwnershipRiskFlags;
  };
  dealer_questions: {
    top_3: string[];
    full_list: string[];
    walk_away_triggers: string[];
  };
  confidence_plan?: ConfidencePlan;
  generated_at_iso: string;
}
