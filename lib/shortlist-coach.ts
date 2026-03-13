/**
 * Shortlist Coach — Tie-Breaker Ranking Engine
 *
 * Pure function: takes 2-4 ShortlistCandidates (pre-scored RunResults),
 * ranks them by secondary metrics, and produces a DecisionArtifact.
 *
 * No database access. No side effects.
 */

import type { RoutineFitScore } from "@/types/v2";

// ============================================================
// TYPES
// ============================================================

export interface ShortlistCandidate {
  run_id: string;
  vehicle_label: string; // e.g. "2023 Chevy Bolt EV" or "Option A"
  fit_score: RoutineFitScore;
  /** MVR fields needed for household scoring */
  routine_inputs?: {
    charging_access?: "home" | "work" | "public";
    shared_charger?: boolean;
    climate?: "winter" | "mild" | "hot";
  };
  plan_b_summary?: string; // Pre-formatted one-liner from PlanBCard
}

export type PreferenceWeight = "lowest_friction" | "lowest_cost" | "most_space";

export interface SecondaryScores {
  resilience: number;      // 0-100
  friction_forecast: number; // 0-100
  household: number;       // 0-100
  confidence: number;      // 0-100
}

export interface RankedCandidate {
  rank: number;
  candidate: ShortlistCandidate;
  composite_score: number;
  secondary_scores: SecondaryScores;
  win_reasons: string[]; // 3 bullets explaining why it ranks here
  breaks_first: string;  // top breakpoint one-liner
  plan_b_summary: string; // plan B one-liner
  verify_this: string;   // one verification action
}

export interface DecisionArtifact {
  headline: string;
  ranked_candidates: RankedCandidate[];
  cta: "paste_listing" | "compare_two" | "save_shortlist";
  cta_run_id?: string;
}

export interface ShortlistResult {
  winner: RankedCandidate | null; // null when too_close
  top3: RankedCandidate[];
  too_close: boolean;
  decision_gap: number; // composite score gap between rank-1 and rank-2
  tie_break_question?: string;
  tie_break_options?: { value: PreferenceWeight; label: string; description: string }[];
  artifact: DecisionArtifact;
}

// ============================================================
// SECONDARY SCORING
// ============================================================

function computeResilience(c: ShortlistCandidate): number {
  let score = c.fit_score.dimensions?.recovery ?? 70;

  // Penalise for each high/medium impact breakpoint
  for (const bp of c.fit_score.breakpoints_ranked) {
    if (bp.impact === "High") score = Math.max(0, score - 20);
    else if (bp.impact === "Medium") score = Math.max(0, score - 10);
  }

  return Math.min(100, Math.max(0, score));
}

function computeFrictionForecast(c: ShortlistCandidate): number {
  let score = c.fit_score.dimensions?.climate ?? 80;

  for (const flag of c.fit_score.stress_flags) {
    if (flag.severity === "high") score = Math.max(0, score - 15);
    else if (flag.severity === "medium") score = Math.max(0, score - 7);
  }

  return Math.min(100, Math.max(0, score));
}

function computeHousehold(c: ShortlistCandidate): number {
  let score = 100;

  if (c.routine_inputs?.charging_access === "work") score -= 10;
  if (c.routine_inputs?.charging_access === "public") score -= 15;
  if (c.routine_inputs?.shared_charger) score -= 20;

  return Math.max(0, score);
}

function computeConfidence(c: ShortlistCandidate): number {
  const level = c.fit_score.confidence.level;
  if (level === "high") return 100;
  if (level === "medium") return 65;
  return 30;
}

function computeSecondaryScores(c: ShortlistCandidate): SecondaryScores {
  return {
    resilience: computeResilience(c),
    friction_forecast: computeFrictionForecast(c),
    household: computeHousehold(c),
    confidence: computeConfidence(c),
  };
}

// ============================================================
// COMPOSITE SCORE
// ============================================================

type Weights = {
  resilience: number;
  friction_forecast: number;
  household: number;
  confidence: number;
  budget?: number;
  utility?: number;
};

function defaultWeights(): Weights {
  return { resilience: 0.35, friction_forecast: 0.30, household: 0.20, confidence: 0.15 };
}

function weightsForPreference(preference: PreferenceWeight): Weights {
  if (preference === "lowest_friction") {
    return { resilience: 0.50, friction_forecast: 0.35, household: 0.10, confidence: 0.05 };
  }
  if (preference === "lowest_cost") {
    // Budget dimension replaces resilience as primary
    return { resilience: 0.05, friction_forecast: 0.25, household: 0.15, confidence: 0.10, budget: 0.45 };
  }
  if (preference === "most_space") {
    // Utility dimension replaces resilience as primary
    return { resilience: 0.05, friction_forecast: 0.25, household: 0.15, confidence: 0.10, utility: 0.45 };
  }
  return defaultWeights();
}

function compositeScore(
  c: ShortlistCandidate,
  secondary: SecondaryScores,
  weights: Weights
): number {
  let score =
    secondary.resilience * weights.resilience +
    secondary.friction_forecast * weights.friction_forecast +
    secondary.household * weights.household +
    secondary.confidence * weights.confidence;

  if (weights.budget && c.fit_score.dimensions?.budget != null) {
    score += c.fit_score.dimensions.budget * weights.budget;
  }
  if (weights.utility && c.fit_score.dimensions?.utility != null) {
    score += c.fit_score.dimensions.utility * weights.utility;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ============================================================
// NARRATIVE GENERATION
// ============================================================

function buildWinReasons(c: ShortlistCandidate, secondary: SecondaryScores, rank: number): string[] {
  const reasons: string[] = [];

  if (secondary.resilience >= 75) {
    reasons.push("Strong resilience — handles bad weeks without breaking your routine");
  } else if (secondary.resilience >= 55) {
    reasons.push("Adequate resilience — most weeks are fine, occasional planning needed");
  } else {
    reasons.push("Lower resilience — works best with a consistent routine, little margin for disruption");
  }

  if (secondary.friction_forecast >= 75) {
    reasons.push("Low predicted friction — stress flags are minor and manageable");
  } else if (secondary.friction_forecast >= 50) {
    reasons.push("Moderate friction — a few things to watch, but all have Plan B paths");
  } else {
    reasons.push("Higher friction forecast — multiple stress points; needs active management");
  }

  if (secondary.confidence >= 80) {
    reasons.push("High confidence score — analysis is based on good vehicle and routine data");
  } else if (secondary.confidence >= 55) {
    reasons.push("Medium confidence — vehicle data improves this score further");
  } else {
    reasons.push("Low confidence — no vehicle range data; score is a routine-only estimate");
  }

  return reasons;
}

function breakpointOneLiner(c: ShortlistCandidate): string {
  const top = c.fit_score.breakpoints_ranked[0];
  if (!top) return "No major breakpoints identified";
  return `${top.title} — ${top.trigger}`;
}

function planBOneLiner(c: ShortlistCandidate): string {
  if (c.plan_b_summary) return c.plan_b_summary;
  const top = c.fit_score.breakpoints_ranked[0];
  if (top?.fallback_plan_b?.anchor) return top.fallback_plan_b.anchor;
  return "Map 2-3 reliable backup chargers near your regular routes";
}

function verifyThis(c: ShortlistCandidate): string {
  const topBp = c.fit_score.breakpoints_ranked[0];
  if (!topBp) return "Confirm your primary charging access before deciding";
  // Use the first evidence item if available
  if (topBp.evidence?.[0]) return `Verify: ${topBp.evidence[0].label} = ${topBp.evidence[0].value}`;
  return `Confirm: ${topBp.break_point}`;
}

// ============================================================
// MAIN RANKING FUNCTION
// ============================================================

export function rankCandidates(
  candidates: ShortlistCandidate[],
  preference?: PreferenceWeight
): ShortlistResult {
  if (candidates.length === 0) {
    return {
      winner: null,
      top3: [],
      too_close: false,
      decision_gap: 0,
      artifact: { headline: "No candidates to rank", ranked_candidates: [], cta: "save_shortlist" },
    };
  }

  const weights = preference ? weightsForPreference(preference) : defaultWeights();

  const ranked: RankedCandidate[] = candidates
    .map((c) => {
      const secondary = computeSecondaryScores(c);
      const cs = compositeScore(c, secondary, weights);
      return {
        rank: 0, // assigned below
        candidate: c,
        composite_score: cs,
        secondary_scores: secondary,
        win_reasons: buildWinReasons(c, secondary, 0),
        breaks_first: breakpointOneLiner(c),
        plan_b_summary: planBOneLiner(c),
        verify_this: verifyThis(c),
      };
    })
    .sort((a, b) => b.composite_score - a.composite_score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const top3 = ranked.slice(0, 3);
  const rank1 = ranked[0];
  const rank2 = ranked[1];
  const decision_gap = rank2 ? rank1.composite_score - rank2.composite_score : 100;

  const WINNER_THRESHOLD = 10;
  const too_close = decision_gap < WINNER_THRESHOLD && !preference;

  const winner = too_close ? null : rank1;

  const headline = winner
    ? `${winner.candidate.vehicle_label} is your best fit`
    : `${ranked.length} cars are close — answer one question to decide`;

  const artifact: DecisionArtifact = {
    headline,
    ranked_candidates: top3,
    cta: winner ? "paste_listing" : "compare_two",
    cta_run_id: winner?.candidate.run_id,
  };

  const result: ShortlistResult = {
    winner,
    top3,
    too_close,
    decision_gap,
    artifact,
  };

  if (too_close) {
    result.tie_break_question = "What matters most for your next EV?";
    result.tie_break_options = [
      {
        value: "lowest_friction",
        label: "Lowest friction",
        description: "I want the one that fits my week without thinking about it",
      },
      {
        value: "lowest_cost",
        label: "Lowest cost",
        description: "I want the most affordable option that still works",
      },
      {
        value: "most_space",
        label: "Most space / utility",
        description: "I need the right body style and cargo room",
      },
    ];
  }

  return result;
}
