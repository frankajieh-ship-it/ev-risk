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

export interface WhatBreaksFirst {
  primary: string;
  primary_citation: string;
  secondary: string;
  secondary_citation: string;
}

export interface RoutineFitConfidence {
  level: "high" | "medium" | "low";
  note: string;
  has_vehicle_data: boolean;
  has_battery_data: boolean;
}

export interface RoutineFitScore {
  score_0_100: number;
  label: "Great Fit" | "Good Fit" | "Conditional Fit" | "High Friction";
  mental_load: "low" | "medium" | "high";
  stress_flags: StressFlag[];
  what_breaks_first: WhatBreaksFirst;
  confidence: RoutineFitConfidence;
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
  overall_risk_label: "Low Risk" | "Moderate Risk" | "High Risk" | "Insufficient Data";
  modules: OwnershipRiskModule[];
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
  generated_at_iso: string;
}
