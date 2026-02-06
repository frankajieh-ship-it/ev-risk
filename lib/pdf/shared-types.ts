/**
 * Shared types for PDF rendering
 *
 * These types define the contract between the Next.js PDF route
 * and the Netlify render-pdf function. No @react-pdf imports here.
 */

// ---- V2 types (inlined from types/v2.ts to avoid path alias issues) ----

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

export interface MinimumViableRoutine {
  charging_access: "home" | "work" | "public";
  weekly_miles?: number;
  commute_miles_roundtrip?: number;
  climate: "winter" | "mild" | "hot";
  longest_day_pattern: "once_a_week" | "monthly_trip" | "rare_road_trip";
}

// ---- V1 Report Payload ----

export interface ReportPayload {
  reportId: string;
  level: "green" | "yellow" | "red";
  score: number;
  summaryVerdict: string;
  batteryRiskExplanation: string[];
  platformRecallRisk: string[];
  ownershipFit: string[];
  dealerQuestions: string[];
  walkAwayTriggers: string[];
  vehicleYear?: number;
  vehicleModel?: string;
  routineFit?: {
    verdict: "good-fit" | "conditional-fit" | "high-friction";
    condition?: string;
    mental_load: "low" | "medium" | "high";
    reasons: Array<{
      text: string;
      type: "positive" | "neutral" | "negative";
    }>;
    confidence_current: number;
    confidence_with_battery_data: number;
    missing_data: string[];
  };
}

// ---- V2 Report PDF Data ----

export interface ReportPdfV2Data {
  reportId?: string;
  routineFit: RoutineFitScore;
  ownershipRisk: OwnershipRiskFlags;
  vehicle?: { make: string; model: string; year: number; mileage?: number };
  routine: MinimumViableRoutine;
  dealerQuestions: {
    top_3: string[];
    full_list: string[];
    walk_away_triggers: string[];
  };
  generatedAt?: string;
}

// ---- Render function request contract ----

export interface RenderPdfRequest {
  version: "v1" | "v2";
  v1Data?: ReportPayload;
  v2Data?: ReportPdfV2Data;
}
