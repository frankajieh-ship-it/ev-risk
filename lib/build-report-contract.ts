/**
 * Report Contract Transformer
 *
 * Consumes existing computed outputs (RoutineFitScore, OwnershipRiskFlags, etc.)
 * and reshapes them into the new EvRiskReportV2Contract.
 *
 * Scoring engines are untouched — this is purely a reshaping layer.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  RoutineFitScore,
  OwnershipRiskFlags,
  MinimumViableRoutine,
  ConfidencePlan,
} from "@/types/v2";
import type {
  EvRiskReportV2Contract,
  DefaultView,
  Appendix,
  MissingDataLoop,
  FitVerdict,
  FallbackPlan,
  StressFlagContract,
  RangeAdequacy,
} from "@/types/v2-contract";
import { generateScenarioSlug } from "./scenario-slug";
import { generateFitOneLiner } from "./fit-verdict-liner";

export interface BuildReportContractInput {
  routineFit: RoutineFitScore;
  ownershipRisk: OwnershipRiskFlags;
  mvr: MinimumViableRoutine;
  vehicle?: { make: string; model: string; year: number; mileage?: number };
  confidencePlan?: ConfidencePlan;
  dealerQuestions: {
    top_3: string[];
    full_list: string[];
    walk_away_triggers: string[];
  };
  effectiveDailyMiles: number;
  effectiveRange: number;
}

export function buildReportContract(
  input: BuildReportContractInput
): EvRiskReportV2Contract {
  const {
    routineFit,
    ownershipRisk,
    mvr,
    vehicle,
    confidencePlan,
    dealerQuestions,
    effectiveDailyMiles,
    effectiveRange,
  } = input;

  const defaultView: DefaultView = {
    fit_verdict: buildFitVerdict(routineFit, mvr),
    fallback_plan: buildFallbackPlan(routineFit),
    stress_flags: buildStressFlags(routineFit),
    one_followup_question: buildFollowupQuestion(confidencePlan),
  };

  return {
    report_id: uuidv4(),
    scenario_id: uuidv4(),
    scenario_slug: generateScenarioSlug(mvr),
    region: mvr.region ?? "US",
    default_view: defaultView,
    appendix: buildAppendix(ownershipRisk, dealerQuestions),
    missing_data_loop: buildMissingDataLoop(confidencePlan),
    computed: { range_adequacy: buildRangeAdequacy(effectiveDailyMiles, effectiveRange, mvr) },
    _internal: {
      routine_fit: routineFit,
      ownership_risk: ownershipRisk,
      confidence_plan: confidencePlan,
      vehicle,
      routine: mvr,
    },
  };
}

// ============================================
// SUB-BUILDERS
// ============================================

function buildFitVerdict(
  routineFit: RoutineFitScore,
  mvr: MinimumViableRoutine
): FitVerdict {
  // Collapse "Great Fit" into "Good Fit" for the consumer contract
  const label =
    routineFit.label === "Great Fit" ? "Good Fit" : routineFit.label;

  return {
    label: label as FitVerdict["label"],
    one_liner: generateFitOneLiner(routineFit, mvr),
  };
}

function buildFallbackPlan(routineFit: RoutineFitScore): FallbackPlan {
  const top = routineFit.breakpoints_ranked[0];
  if (!top) {
    return {
      anchor: "Maintain your current routine",
      backup: "Identify one backup charging option",
      trigger: "Any disruption to your primary charging",
    };
  }
  return {
    anchor: top.fallback_plan_b.anchor,
    backup: top.fallback_plan_b.backup,
    trigger: top.trigger,
  };
}

function buildStressFlags(
  routineFit: RoutineFitScore
): StressFlagContract[] {
  return routineFit.stress_flags.slice(0, 2).map((flag) => {
    const matchingBp = routineFit.breakpoints_ranked.find(
      (bp) => bp.id === flag.id
    );
    return {
      title: flag.label,
      because: `because ${flag.routine_citation}`,
      impact: matchingBp?.break_point || flag.label,
    };
  });
}

function buildFollowupQuestion(
  confidencePlan?: ConfidencePlan
): string | null {
  if (!confidencePlan || confidencePlan.actions.length === 0) return null;

  // Pick the action with the highest confidence gain
  const sorted = [...confidencePlan.actions].sort(
    (a, b) => b.expected_confidence_gain_pct - a.expected_confidence_gain_pct
  );
  const top = sorted[0];

  if (top.id === "get_soh")
    return "Do you have the battery State of Health percentage?";
  if (top.id === "get_vin") return "Can you share the vehicle's VIN?";
  if (top.id === "get_fast_charge_history")
    return "Do you know if this vehicle was frequently DC fast charged?";
  return null;
}

function buildAppendix(
  ownershipRisk: OwnershipRiskFlags,
  dealerQuestions: {
    top_3: string[];
    full_list: string[];
    walk_away_triggers: string[];
  }
): Appendix {
  const batteryModule = ownershipRisk.modules.find(
    (m) => m.module_id === "battery"
  );
  const recallModule = ownershipRisk.modules.find(
    (m) => m.module_id === "recall"
  );
  const warrantyModule = ownershipRisk.modules.find(
    (m) => m.module_id === "warranty"
  );

  return {
    buyer_diligence: {
      battery: {
        summary:
          batteryModule?.summary || "Battery health data not yet available.",
        asks: [
          "Ask seller for a recent battery State of Health reading",
          "Request a pre-purchase battery health check from a certified EV technician",
        ],
      },
      warranty_recalls: {
        summary:
          [recallModule?.summary, warrantyModule?.summary]
            .filter(Boolean)
            .join(". ") ||
          "Add VIN to check recall and warranty status.",
        checks: [
          "Check NHTSA recall status with VIN",
          "Verify remaining manufacturer warranty",
          "Confirm all safety recalls are completed",
        ],
      },
      walk_away_triggers: dealerQuestions.walk_away_triggers,
    },
    cost_estimates: null,
    dealer_questions: dealerQuestions.top_3,
  };
}

function buildMissingDataLoop(
  confidencePlan?: ConfidencePlan
): MissingDataLoop {
  const current = confidencePlan?.current_pct ?? 70;
  const target = 95;

  if (!confidencePlan || confidencePlan.actions.length === 0) {
    return {
      current_confidence: current / 100,
      target_confidence: target / 100,
      next_best_step: {
        label: "Your report is at maximum confidence for available data",
        steps: [],
        cta: { type: "SAVE_SCENARIO", enabled: true },
      },
    };
  }

  const sorted = [...confidencePlan.actions].sort(
    (a, b) => b.expected_confidence_gain_pct - a.expected_confidence_gain_pct
  );
  const topAction = sorted[0];

  const ctaType: MissingDataLoop["next_best_step"]["cta"]["type"] =
    topAction.id === "get_vin"
      ? "ENTER_VIN"
      : topAction.id === "get_soh"
        ? "UPLOAD_SOH"
        : "SAVE_SCENARIO";

  return {
    current_confidence: current / 100,
    target_confidence: target / 100,
    next_best_step: {
      label: "Add 1 data point to reduce uncertainty",
      steps: [
        {
          action: topAction.title,
          unlocks: topAction.required_for_modules,
        },
      ],
      cta: { type: ctaType, enabled: true },
    },
  };
}

function buildRangeAdequacy(
  effectiveDailyMiles: number,
  effectiveRange: number,
  mvr: MinimumViableRoutine
): RangeAdequacy {
  const dailyUsagePct = (effectiveDailyMiles / effectiveRange) * 100;

  let result: RangeAdequacy["result"];
  if (dailyUsagePct < 50) result = "adequate";
  else if (dailyUsagePct < 70) result = "marginal";
  else result = "inadequate";

  const inputsUsed: string[] = [];
  if (mvr.commute_miles_roundtrip) inputsUsed.push("daily_miles");
  else if (mvr.weekly_miles) inputsUsed.push("weekly_miles");
  if (mvr.climate === "winter") inputsUsed.push("winter_temp");
  inputsUsed.push("charging_access");

  return {
    status: "computed",
    result,
    inputs_used: inputsUsed,
  };
}
