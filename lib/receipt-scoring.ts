/**
 * Receipt Scoring Engine
 *
 * Pure deterministic function: listing_signals[] → scores + verdict.
 * No side effects, no network calls. Safe for server and client use.
 *
 * Fit Score (0-100): starts at 100, deduct penalties. Drives verdict.
 * Evidence Score (0-100): starts at 50, add bonuses / subtract penalties. Drives evidence label.
 */

import {
  HARD_BLOCKERS,
  RULES_BY_ID,
  VALID_SIGNAL_IDS,
  type ListingSignalId,
  type ScoringCategory,
} from "./receipt-rules";

// --- Output types ---

export type EvidenceLabel = "STRONG" | "PARTIAL" | "MISSING";

export interface ScoringReason {
  signal_id: string;
  category: ScoringCategory;
  points: number;
  label: string;
}

export interface ReceiptScoringResult {
  fit_score: number;
  evidence_score: number;
  verdict: "GREEN" | "YELLOW" | "RED";
  evidence_label: EvidenceLabel;
  scoring_reasons: ScoringReason[];
  why_not_green: ScoringReason[];
  hard_blocker_hit: boolean;
  verify_before_visit: string[];
}

// --- Main scoring function ---

export function scoreReceipt(signals: string[]): ReceiptScoringResult {
  // Filter to valid signal IDs only (resilient to AI garbage)
  const validSignals = signals.filter((s) => VALID_SIGNAL_IDS.has(s));
  const signalSet = new Set(validSignals);
  const triggered: ScoringReason[] = [];

  // 1. Check hard blockers
  let hardBlockerHit = false;
  for (const blocker of HARD_BLOCKERS) {
    if (signalSet.has(blocker.id)) {
      hardBlockerHit = true;
      triggered.push({
        signal_id: blocker.id,
        category: blocker.category,
        points: 0,
        label: blocker.label,
      });
    }
  }

  // 2. Compute fit score (start at 100, deduct penalties)
  let fitScore = 100;
  for (const signal of validSignals) {
    const rule = RULES_BY_ID.get(signal);
    if (!rule || rule.type !== "fit_penalty") continue;
    if (triggered.some((t) => t.signal_id === signal)) continue; // dedupe
    fitScore += rule.points; // points are negative
    triggered.push({
      signal_id: rule.id,
      category: rule.category,
      points: rule.points,
      label: rule.label,
    });
  }
  fitScore = Math.max(0, Math.min(100, fitScore));

  // 3. Compute evidence score (start at 50, add bonuses / subtract penalties)
  let evidenceScore = 50;
  for (const signal of validSignals) {
    const rule = RULES_BY_ID.get(signal);
    if (!rule) continue;
    if (rule.type !== "evidence_bonus" && rule.type !== "evidence_penalty") continue;
    if (triggered.some((t) => t.signal_id === signal)) continue; // dedupe
    evidenceScore += rule.points;
    triggered.push({
      signal_id: rule.id,
      category: rule.category,
      points: rule.points,
      label: rule.label,
    });
  }
  evidenceScore = Math.max(0, Math.min(100, evidenceScore));

  // 4. Determine evidence label (computed before verdict — caps GREEN when MISSING)
  let evidenceLabel: EvidenceLabel;
  if (evidenceScore >= 75) {
    evidenceLabel = "STRONG";
  } else if (evidenceScore >= 45) {
    evidenceLabel = "PARTIAL";
  } else {
    evidenceLabel = "MISSING";
  }

  // 5. Determine verdict
  // GREEN requires fit_score ≥ 72 AND evidence ≥ PARTIAL (not MISSING).
  // Too little evidence to confidently call a deal good — cap at YELLOW.
  let verdict: "GREEN" | "YELLOW" | "RED";
  if (hardBlockerHit || fitScore < 45) {
    verdict = "RED";
  } else if (fitScore >= 72 && evidenceLabel !== "MISSING") {
    verdict = "GREEN";
  } else {
    verdict = "YELLOW";
  }

  // 6. Build "why not GREEN?" — blockers + penalties, sorted by severity desc
  const whyNotGreen =
    verdict !== "GREEN"
      ? triggered
          .filter((r) => r.points <= 0)
          .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
      : [];

  // 7. Build verify_before_visit from evidence penalties (top 5)
  const verifyBeforeVisit = triggered
    .filter((r) => {
      const rule = RULES_BY_ID.get(r.signal_id);
      return rule?.type === "evidence_penalty";
    })
    .sort((a, b) => a.points - b.points) // most negative first
    .slice(0, 5)
    .map((r) => r.label);

  return {
    fit_score: fitScore,
    evidence_score: evidenceScore,
    verdict,
    evidence_label: evidenceLabel,
    scoring_reasons: triggered,
    why_not_green: whyNotGreen,
    hard_blocker_hit: hardBlockerHit,
    verify_before_visit: verifyBeforeVisit,
  };
}

// --- Fallback scoring (when AI times out, derive signals from structured fields) ---

export function scoreFallbackReceipt(fields: {
  title_status?: string;
  service_history?: string;
  accidents_reported?: string;
  owners?: number | null;
  carfax_available?: string;
  vin?: string;
}): ReceiptScoringResult {
  const signals: ListingSignalId[] = [];

  // Hard blockers from structured fields
  if (fields.title_status === "salvage" || fields.title_status === "rebuilt") {
    signals.push("title_salvage");
  }

  // Evidence from structured fields
  if (fields.title_status === "clean") {
    signals.push("clean_title_explicit");
  } else if (fields.title_status === "unknown" || !fields.title_status) {
    signals.push("title_status_unclear");
  }

  if (fields.service_history === "yes") {
    signals.push("service_records_shown");
  } else {
    signals.push("service_records_missing");
  }

  if (fields.owners && fields.owners <= 2) {
    signals.push("ownership_history_clear");
  } else if (!fields.owners) {
    signals.push("ownership_history_unclear");
  }

  if (fields.owners && fields.owners >= 4) {
    signals.push("ownership_turnover_high");
  }

  if (fields.vin) {
    signals.push("vin_decoded");
  } else {
    signals.push("vin_missing");
  }

  // Evidence gaps for fallback — title and service are handled above from structured fields

  return scoreReceipt(signals);
}
