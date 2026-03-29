/**
 * OFFO Score Engine — Phase 7
 *
 * Pure function: component scores + context → OffoScore
 * Client-safe (no fs imports). Deterministic: same inputs = same output.
 *
 * Formulas:
 *   Auction: financial(40%) + usability(35%) + feasibility(15%) + reliability(10%)
 *   Retail:  usability(45%) + feasibility(25%) + financial(20%) + reliability(10%)
 *
 * Verdict thresholds: ≥72 = green, 50–71 = yellow, <50 = red
 */

import type { OffoScore, OffoVerdict } from "@/types/v2";

export interface OffoScoreInput {
  context: "auction" | "retail";
  financial: number;    // 0–100
  usability: number;    // 0–100
  feasibility: number;  // 0–100
  reliability: number;  // 0–100
  confidence: "low" | "medium" | "high";
  /** Pass-through hints for deterministic why/failure_modes text generation */
  hints?: {
    battery_risk?: number;
    structural_risk?: number;
    repair_cost_risk?: number;
    top_risk_dimension?: string | null;
    salvage_grade?: "green" | "yellow" | "red";
    expected_repair_cost_midpoint?: number;
    arv?: number;
  };
}

// ── Weight tables ─────────────────────────────────────────────────────────────

const WEIGHTS = {
  auction: { financial: 0.40, usability: 0.35, feasibility: 0.15, reliability: 0.10 },
  retail:  { financial: 0.20, usability: 0.45, feasibility: 0.25, reliability: 0.10 },
} as const;

// ── Verdict thresholds ────────────────────────────────────────────────────────

function toVerdict(score: number): OffoVerdict {
  if (score >= 72) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

const VERDICT_LABELS: Record<OffoVerdict, string> = {
  green:  "Strong buy",
  yellow: "Proceed with caution",
  red:    "High risk",
};

// ── Why text: deterministic from component scores ─────────────────────────────

function buildWhy(input: OffoScoreInput, verdict: OffoVerdict): string[] {
  const { financial, usability, feasibility, reliability, context, hints } = input;
  const bullets: string[] = [];

  // Financial
  if (financial >= 70) {
    bullets.push(
      context === "auction"
        ? "Financials look workable — repair cost is a manageable share of ARV"
        : "Price aligns with your budget after available incentives"
    );
  } else if (financial >= 50) {
    bullets.push(
      context === "auction"
        ? "Moderate financial risk — repair estimate is 35–55% of vehicle value"
        : "Price is slightly over budget; factor in incentives before committing"
    );
  } else {
    bullets.push(
      context === "auction"
        ? "High financial risk — repair cost likely exceeds profitable bid range"
        : "Price significantly exceeds budget — financing or compromise required"
    );
  }

  // Usability
  if (usability >= 70) {
    bullets.push("Routine fit is strong — daily charging and range requirements are well-covered");
  } else if (usability >= 50) {
    bullets.push(
      hints?.top_risk_dimension
        ? `Routine fit is acceptable but ${hints.top_risk_dimension} adds friction to daily use`
        : "Routine fit is acceptable with some planning required"
    );
  } else {
    bullets.push(
      hints?.top_risk_dimension
        ? `Routine fit is poor — ${hints.top_risk_dimension} is likely to cause regular disruption`
        : "This vehicle has significant daily-use friction for your routine"
    );
  }

  // Feasibility — only include if it's a meaningful signal
  if (feasibility >= 70) {
    bullets.push("Hardware specs match your stated preferences well");
  } else if (feasibility < 50) {
    bullets.push("Hardware specs have notable gaps relative to your preferences");
  }

  // Reliability — only include if it's a notable signal
  if (reliability <= 30) {
    bullets.push("Below-average reliability tier — factor in higher maintenance cost probability");
  } else if (reliability >= 80 && verdict === "green") {
    bullets.push("Reliability ratings are above average for this model");
  }

  return bullets.slice(0, 4);
}

// ── Failure modes: deterministic from hints ───────────────────────────────────

function buildFailureModes(input: OffoScoreInput): string[] {
  const { hints, context, feasibility } = input;
  const modes: string[] = [];

  if (context === "auction" && hints) {
    if ((hints.battery_risk ?? 0) >= 60) {
      modes.push("Battery damage may require costly replacement ($8k–$15k) not covered post-salvage title");
    } else if ((hints.battery_risk ?? 0) >= 40) {
      modes.push("Battery health uncertain — request SOH readout before bidding");
    }

    if ((hints.structural_risk ?? 0) >= 60) {
      modes.push("Structural or charging system damage may compound repair cost beyond estimates");
    }

    if ((hints.repair_cost_risk ?? 0) >= 70) {
      modes.push("Asking price vs. market value ratio suggests hidden damage beyond visible inspection");
    }

    if (hints.salvage_grade === "red") {
      modes.push("Salvage score is in the red zone — EV specialist inspection strongly recommended before bidding");
    }
  }

  if (context === "retail" && hints) {
    if (hints.top_risk_dimension === "charging") {
      modes.push("Charging access limitations could make daily use significantly more difficult than anticipated");
    } else if (hints.top_risk_dimension === "range") {
      modes.push("Range buffer is too tight for your longest-day scenario — stranding risk on longer trips");
    } else if (hints.top_risk_dimension === "budget") {
      modes.push("Total cost of ownership may exceed initial estimates once charging infrastructure is included");
    }
  }

  if (feasibility < 45) {
    modes.push("Hardware spec mismatches may create friction that routine fit scoring alone does not capture");
  }

  return modes.slice(0, 3);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeOffoScore(input: OffoScoreInput): OffoScore {
  const w = WEIGHTS[input.context];

  const rawScore =
    input.financial   * w.financial   +
    input.usability   * w.usability   +
    input.feasibility * w.feasibility +
    input.reliability * w.reliability;

  const offo_score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const verdict    = toVerdict(offo_score);

  return {
    offo_score,
    verdict,
    verdict_label: VERDICT_LABELS[verdict],
    why:           buildWhy(input, verdict),
    failure_modes: buildFailureModes(input),
    confidence:    input.confidence,
    component_scores: {
      financial:   Math.round(input.financial),
      usability:   Math.round(input.usability),
      feasibility: Math.round(input.feasibility),
      reliability: Math.round(input.reliability),
    },
    context: input.context,
  };
}
