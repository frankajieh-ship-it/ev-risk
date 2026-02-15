/**
 * Unified Compare Computation
 *
 * Pure orchestration layer for computing comparison results.
 * Dispatches to receipt or evroutine engines based on scenario type.
 * No database access — receives data, returns results.
 */

import type { ListingReceipt } from "@/types/receipt";
import { computeReceiptDelta } from "@/lib/compare-receipts";
import type { FitSignal } from "./comparison-types";

// ── Receipt comparison types ─────────────────────────────────────

export interface ReceiptSummary {
  receipt_id: string;
  vehicle: string;
  verdict: "GREEN" | "YELLOW" | "RED";
  verdict_reason: string;
  price: number;
  currency: string;
  mileage: number;
  mileage_unit: string;
  year: number;
  make: string;
  model: string;
  seller_type: string;
  title_status: string;
  price_sanity_label: string;
  price_sanity_confidence: number;
  risk_flags: string[];
}

export interface ReceiptComparisonResult {
  type: "receipt";
  base_summary: ReceiptSummary;
  compare_summary: ReceiptSummary;
  delta_bullets: string[];
  neutral_closer: string;
  computed_at: string;
}

// ── EVRoutine comparison types ───────────────────────────────────

export interface RoutineOptionSummary {
  session_id: string;
  label: string;
  fit_signal: FitSignal;
  fade_label: string;
  friction_bullets: string[];
  why_not_100: string[];
  risk_tags: string[];
}

export interface RoutineComparisonResult {
  type: "evroutine";
  base_summary: RoutineOptionSummary;
  compare_summary: RoutineOptionSummary;
  shared_flags: string[];
  base_only_flags: string[];
  compare_only_flags: string[];
  what_would_change_verdict: {
    base: string[];
    compare: string[];
  };
  combined_checklist: string[];
  winner: "base" | "compare" | "too_close";
  winner_reason: string;
  routine_delta_bullets: string[];
  neutral_closer: string;
  computed_at: string;
}

export type ComparisonResultPayload =
  | ReceiptComparisonResult
  | RoutineComparisonResult;

// ── Stored session shape (what the API route fetches from DB) ────

export interface StoredRoutineSession {
  id: string;
  fit_signal: FitSignal;
  fade_label: string;
  friction_bullets: string[];
  why_not_100: string[];
  risk_tags: string[];
  inputs: Record<string, unknown>;
}

// ── Receipt helpers ──────────────────────────────────────────────

function extractReceiptSummary(receipt: ListingReceipt): ReceiptSummary {
  const s = receipt.listing_summary;
  return {
    receipt_id: receipt.receipt_id,
    vehicle:
      [s.year, s.make, s.model, s.trim].filter(Boolean).join(" ") ||
      "Unknown Vehicle",
    verdict: receipt.verdict,
    verdict_reason: receipt.verdict_reason,
    price: s.price,
    currency: s.currency,
    mileage: s.mileage,
    mileage_unit: s.mileage_unit,
    year: s.year,
    make: s.make,
    model: s.model,
    seller_type: s.seller_type,
    title_status: s.title_status,
    price_sanity_label: receipt.price_sanity.label,
    price_sanity_confidence: receipt.price_sanity.confidence,
    risk_flags: receipt.risk_flags,
  };
}

export function computeReceiptComparison(
  baseReceipt: ListingReceipt,
  compareReceipt: ListingReceipt
): ReceiptComparisonResult {
  return {
    type: "receipt",
    base_summary: extractReceiptSummary(baseReceipt),
    compare_summary: extractReceiptSummary(compareReceipt),
    delta_bullets: computeReceiptDelta(baseReceipt, compareReceipt),
    neutral_closer:
      "Both listings have trade-offs. Use the details above to decide which risks you're more comfortable managing.",
    computed_at: new Date().toISOString(),
  };
}

// ── EVRoutine helpers ────────────────────────────────────────────

const SIGNAL_SCORE: Record<FitSignal, number> = {
  GOOD: 0,
  CONDITIONAL: 1,
  HIGH_FRICTION: 2,
};

const TAG_REMEDIATION: Record<string, string> = {
  NO_HOME_CHARGING:
    "Adding home charging would significantly reduce friction",
  L1_ONLY: "Upgrading to L2 home charging would improve daily experience",
  MOTORWAY_HEAVY:
    "Shifting to more local routes would reduce range pressure",
  FREQUENT_LONG_DAYS:
    "Reducing long-day frequency would ease charging demands",
  LOW_PLANNING_TOLERANCE:
    "Building a charging routine could reduce anxiety",
  SHARED_INFRASTRUCTURE:
    "Dedicated charger access would remove coordination friction",
};

function getSessionLabel(session: StoredRoutineSession): string {
  const i = session.inputs;
  if (i?.model) {
    return `${i.year || ""} ${i.model}`.trim();
  }
  return "Option";
}

function buildOptionSummary(session: StoredRoutineSession): RoutineOptionSummary {
  return {
    session_id: session.id,
    label: getSessionLabel(session),
    fit_signal: session.fit_signal,
    fade_label: session.fade_label,
    friction_bullets: session.friction_bullets || [],
    why_not_100: session.why_not_100 || [],
    risk_tags: session.risk_tags || [],
  };
}

function determineWinner(
  baseSession: StoredRoutineSession,
  compareSession: StoredRoutineSession,
  baseOnlyFlags: string[],
  compareOnlyFlags: string[]
): { winner: "base" | "compare" | "too_close"; reason: string } {
  const baseScore = SIGNAL_SCORE[baseSession.fit_signal];
  const compareScore = SIGNAL_SCORE[compareSession.fit_signal];
  const scoreDiff = compareScore - baseScore; // positive = base is better

  if (Math.abs(scoreDiff) < 1) {
    return {
      winner: "too_close",
      reason:
        "Both options have the same routine-fit signal. The difference will come down to real-world experience.",
    };
  }

  const betterIsBase = scoreDiff > 0;
  const betterUniqueFlags = betterIsBase
    ? baseOnlyFlags.length
    : compareOnlyFlags.length;
  const worseUniqueFlags = betterIsBase
    ? compareOnlyFlags.length
    : baseOnlyFlags.length;

  if (betterUniqueFlags >= worseUniqueFlags) {
    return {
      winner: "too_close",
      reason:
        "Score difference exists but unique risk flags are comparable. Too close to call definitively.",
    };
  }

  const winnerLabel = betterIsBase
    ? getSessionLabel(baseSession)
    : getSessionLabel(compareSession);
  const winnerSignal = betterIsBase
    ? baseSession.fit_signal
    : compareSession.fit_signal;
  const loserSignal = betterIsBase
    ? compareSession.fit_signal
    : baseSession.fit_signal;

  return {
    winner: betterIsBase ? "base" : "compare",
    reason: `${winnerLabel} has a better routine fit (${winnerSignal} vs ${loserSignal}) with fewer unique friction flags.`,
  };
}

function getRemediations(riskTags: string[]): string[] {
  return riskTags
    .map((tag) => TAG_REMEDIATION[tag])
    .filter((r): r is string => r !== undefined);
}

function buildFallbackDeltaBullets(
  baseSession: StoredRoutineSession,
  compareSession: StoredRoutineSession
): string[] {
  const bullets: string[] = [];
  const baseLabel = getSessionLabel(baseSession);
  const compareLabel = getSessionLabel(compareSession);

  if (baseSession.fit_signal !== compareSession.fit_signal) {
    const signalOrder = { GOOD: 3, CONDITIONAL: 2, HIGH_FRICTION: 1 };
    const baseBetter =
      signalOrder[baseSession.fit_signal] >
      signalOrder[compareSession.fit_signal];
    const better = baseBetter ? baseLabel : compareLabel;
    const worse = baseBetter ? compareLabel : baseLabel;
    bullets.push(
      `Overall, ${better} appears to fit your routine more smoothly than ${worse}.`
    );
  }

  const baseRisks = new Set(baseSession.risk_tags || []);
  const compareRisks = new Set(compareSession.risk_tags || []);
  const baseOnly = [...baseRisks].filter((r) => !compareRisks.has(r));
  const compareOnly = [...compareRisks].filter((r) => !baseRisks.has(r));

  if (baseOnly.length > 0) {
    bullets.push(
      `${baseLabel} has unique friction points not present for ${compareLabel}.`
    );
  }
  if (compareOnly.length > 0) {
    bullets.push(
      `${compareLabel} has unique friction points not present for ${baseLabel}.`
    );
  }

  if (bullets.length === 0) {
    bullets.push(
      "These two look similar from a routine-fit perspective. The difference will come down to real-world experience."
    );
  }

  return bullets.slice(0, 6);
}

export function computeRoutineComparison(
  baseSession: StoredRoutineSession,
  compareSession: StoredRoutineSession
): RoutineComparisonResult {
  const baseFlags = new Set(baseSession.risk_tags || []);
  const compareFlags = new Set(compareSession.risk_tags || []);

  const shared_flags = [...baseFlags].filter((f) => compareFlags.has(f));
  const base_only_flags = [...baseFlags].filter((f) => !compareFlags.has(f));
  const compare_only_flags = [...compareFlags].filter(
    (f) => !baseFlags.has(f)
  );

  const { winner, reason } = determineWinner(
    baseSession,
    compareSession,
    base_only_flags,
    compare_only_flags
  );

  // Deduplicated combined checklist from friction_bullets
  const seen = new Set<string>();
  const combined_checklist: string[] = [];
  for (const bullet of [
    ...(baseSession.friction_bullets || []),
    ...(compareSession.friction_bullets || []),
  ]) {
    if (!seen.has(bullet)) {
      seen.add(bullet);
      combined_checklist.push(bullet);
    }
    if (combined_checklist.length >= 8) break;
  }

  return {
    type: "evroutine",
    base_summary: buildOptionSummary(baseSession),
    compare_summary: buildOptionSummary(compareSession),
    shared_flags,
    base_only_flags,
    compare_only_flags,
    what_would_change_verdict: {
      base: getRemediations(baseSession.risk_tags || []),
      compare: getRemediations(compareSession.risk_tags || []),
    },
    combined_checklist,
    winner,
    winner_reason: reason,
    routine_delta_bullets: buildFallbackDeltaBullets(
      baseSession,
      compareSession
    ),
    neutral_closer:
      "Both can work. The difference is how often charging stays invisible vs resurfaces in your week.",
    computed_at: new Date().toISOString(),
  };
}

// ── Dispatcher ───────────────────────────────────────────────────

export function computeComparison(
  scenarioType: "receipt" | "evroutine",
  baseData: ListingReceipt | StoredRoutineSession,
  compareData: ListingReceipt | StoredRoutineSession
): ComparisonResultPayload {
  if (scenarioType === "receipt") {
    return computeReceiptComparison(
      baseData as ListingReceipt,
      compareData as ListingReceipt
    );
  }
  return computeRoutineComparison(
    baseData as StoredRoutineSession,
    compareData as StoredRoutineSession
  );
}
