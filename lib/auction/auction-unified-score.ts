/**
 * Auction → OffoScore adapter (Phase 7)
 *
 * Maps SalvageRiskResult + optional RoutineFitScore → OffoScore
 * using the auction formula (financial 40%, usability 35%, feasibility 15%, reliability 10%).
 *
 * Component mappings:
 *   financial   = salvage_risk.score (already 0–100, higher = safer/better)
 *   usability   = routineFit.confidence_adjusted_score, or 70 (neutral) when absent
 *   feasibility = average of (100 - battery_risk) and (100 - structural_risk)
 *   reliability = 100 - recall_overlap
 */

import { computeOffoScore, type OffoScoreInput } from "@/lib/offo-score";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type { RoutineFitScore, OffoScore } from "@/types/v2";

const NEUTRAL_USABILITY = 70;

export function computeAuctionOffoScore(
  salvageRisk: SalvageRiskResult,
  routineFit?: RoutineFitScore | null
): OffoScore {
  // Financial: salvage score maps directly
  const financial = salvageRisk.score;

  // Usability: from routine fit if available, else neutral
  const usability = routineFit
    ? routineFit.confidence_adjusted_score
    : NEUTRAL_USABILITY;

  // Feasibility: invert the two structural/battery risk factors
  // Both are 0–100 (higher = more risk), so we invert to get capability
  const batteryFeasibility    = 100 - (salvageRisk.factors.battery_risk ?? 50);
  const structuralFeasibility = 100 - (salvageRisk.factors.structural_risk ?? 50);
  const feasibility = Math.round((batteryFeasibility + structuralFeasibility) / 2);

  // Reliability: invert recall_overlap (0 recalls = 100, heavy recalls = 0)
  const reliability = Math.max(0, Math.round(100 - salvageRisk.factors.recall_overlap));

  // Confidence: map uncertainty_level → confidence (inverted)
  const confidence: OffoScoreInput["confidence"] =
    salvageRisk.uncertainty_level === "high"   ? "low"
    : salvageRisk.uncertainty_level === "medium" ? "medium"
    :                                              "high";

  const input: OffoScoreInput = {
    context: "auction",
    financial,
    usability,
    feasibility,
    reliability,
    confidence,
    hints: {
      battery_risk:                    salvageRisk.factors.battery_risk,
      structural_risk:                 salvageRisk.factors.structural_risk,
      repair_cost_risk:                salvageRisk.factors.repair_cost_risk,
      salvage_grade:                   salvageRisk.grade,
      top_risk_dimension:              routineFit?.top_risk_dimension ?? null,
      expected_repair_cost_midpoint:   salvageRisk.expected_repair_cost?.midpoint,
      arv:                             salvageRisk.arv_hint_low,
    },
  };

  return computeOffoScore(input);
}
