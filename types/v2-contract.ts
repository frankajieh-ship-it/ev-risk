/**
 * EV-Risk V2 Report Contract Types
 *
 * Defines the new API response shape: Default View + Appendix.
 * Internal scoring types (RoutineFitScore, BreakPoint, etc.) remain in types/v2.ts.
 * This file defines only the presentation contract.
 */

import type {
  RoutineFitScore,
  OwnershipRiskFlags,
  ConfidencePlan,
  MinimumViableRoutine,
} from "./v2";

// ============================================
// DEFAULT VIEW
// ============================================

export interface FitVerdict {
  label: "Great Fit" | "Good Fit" | "Mixed Fit" | "High Friction";
  one_liner: string;
}

export interface FallbackPlan {
  primary: string;
  backup: string;
  trigger: string;
}

export interface StressFlagContract {
  title: string;
  because: string;
  impact: string;
}

export interface ConfidencePair {
  routine_confidence_pct: number;
  routine_confidence_label: string;
  ownership_confidence_pct: number;
  ownership_confidence_label: string;
}

export interface DefaultView {
  fit_verdict: FitVerdict;
  fallback_plan: FallbackPlan;
  stress_flags: StressFlagContract[];
  one_followup_question: string | null;
  confidence?: ConfidencePair;
}

// ============================================
// APPENDIX
// ============================================

export interface BuyerDiligence {
  battery: { summary: string; asks: string[] };
  warranty_recalls: { summary: string; checks: string[] };
  walk_away_triggers: string[];
}

export interface Appendix {
  buyer_diligence: BuyerDiligence;
  cost_estimates: { notes: string } | null;
  dealer_questions: string[];
}

// ============================================
// MISSING DATA LOOP
// ============================================

export interface MissingDataLoop {
  current_confidence: number;
  target_confidence: number;
  next_best_step: {
    label: string;
    steps: Array<{ action: string; unlocks: string[] }>;
    cta: {
      type: "SAVE_SCENARIO" | "UPLOAD_SOH" | "ENTER_VIN";
      enabled: boolean;
    };
  };
}

// ============================================
// COMPUTED
// ============================================

export interface RangeAdequacy {
  status: "computed" | "not_computed";
  result: "adequate" | "marginal" | "inadequate" | "unknown";
  reason_if_unknown?: string;
  inputs_used: string[];
}

// ============================================
// FULL CONTRACT ENVELOPE
// ============================================

export interface EvRiskReportV2Contract {
  report_id: string;
  scenario_id: string;
  scenario_slug: string;
  region: "US" | "UK";
  default_view: DefaultView;
  appendix: Appendix;
  missing_data_loop: MissingDataLoop;
  computed: { range_adequacy: RangeAdequacy };
  _internal: {
    routine_fit: RoutineFitScore;
    ownership_risk: OwnershipRiskFlags;
    confidence_plan?: ConfidencePlan;
    vehicle?: { make: string; model: string; year: number; mileage?: number };
    routine: MinimumViableRoutine;
  };
}
