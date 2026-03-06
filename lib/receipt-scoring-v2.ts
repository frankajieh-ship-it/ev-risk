/**
 * Receipt Scoring Engine V2
 *
 * CEO-defined verdict thresholds:
 *   RED:    any hard flag OR risk_points >= 6
 *   YELLOW: risk_points 3-5 OR confidence_points <= 1
 *   GREEN:  no hard flags AND risk_points <= 2 AND confidence_points >= 2
 *
 * Key change from V1: evidence now influences the verdict.
 * Low confidence (missing docs) pushes to YELLOW even with low risk.
 * High confidence (battery report, service records, VIN) enables GREEN.
 */

import {
  HARD_BLOCKERS,
  RULES_BY_ID,
  VALID_SIGNAL_IDS,
  type ListingSignalId,
  type ScoringCategory,
  type EvidenceType,
} from "./receipt-rules";
import type { ScoringReason, EvidenceLabel } from "./receipt-scoring";

// --- V2 Output Types ---

export interface FlagDetailV2 {
  signal_id: string;
  category: ScoringCategory;
  risk_points: number;
  confidence_points: number;
  evidence_type: EvidenceType;
  ui_label: string;
  templated_text: string;
}

export interface ScoringV2Result {
  risk_points: number;
  confidence_points: number;
  hard_flags_count: number;
  unknown_flags_count: number;
  verdict: "GREEN" | "YELLOW" | "RED";
  evidence_label: EvidenceLabel;
  flag_details: FlagDetailV2[];
  why_not_green: FlagDetailV2[];
  verify_before_visit: string[];
  // Backward-compatible fields (so existing UI keeps working)
  fit_score: number;
  evidence_score: number;
  scoring_reasons: ScoringReason[];
  hard_blocker_hit: boolean;
  scoring_version: "v2";
}

// --- Templated copy per evidence type ---

function templateText(evidenceType: EvidenceType, label: string): string {
  switch (evidenceType) {
    case "absent":
      return `Not shown in listing: ${label}`;
    case "negative":
      return `Evidence suggests: ${label}`;
    case "friction":
      return `Adds weekly friction: ${label}`;
    case "present":
      return `Confirmed: ${label}`;
  }
}

// --- Main V2 scoring function ---

export function scoreReceiptV2(signals: string[]): ScoringV2Result {
  const validSignals = signals.filter((s) => VALID_SIGNAL_IDS.has(s));
  const signalSet = new Set(validSignals);
  const flagDetails: FlagDetailV2[] = [];
  const scoringReasons: ScoringReason[] = [];
  const processed = new Set<string>();

  // 1. Check hard blockers
  let hardBlockerHit = false;
  let hardFlagsCount = 0;
  for (const blocker of HARD_BLOCKERS) {
    if (signalSet.has(blocker.id)) {
      hardBlockerHit = true;
      hardFlagsCount++;
      processed.add(blocker.id);
      flagDetails.push({
        signal_id: blocker.id,
        category: blocker.category,
        risk_points: 0,
        confidence_points: 0,
        evidence_type: blocker.evidence_type,
        ui_label: blocker.label,
        templated_text: templateText(blocker.evidence_type, blocker.label),
      });
      scoringReasons.push({
        signal_id: blocker.id,
        category: blocker.category,
        points: 0,
        label: blocker.label,
      });
    }
  }

  // 2. Accumulate risk_points and confidence_points
  let riskPoints = 0;
  let confidencePoints = 0;
  let unknownFlagsCount = 0;

  for (const signal of validSignals) {
    if (processed.has(signal)) continue;
    processed.add(signal);

    const rule = RULES_BY_ID.get(signal);
    if (!rule) continue;

    riskPoints += rule.risk_v2;
    confidencePoints += rule.confidence_v2;

    if (rule.evidence_type === "absent") {
      unknownFlagsCount++;
    }

    flagDetails.push({
      signal_id: rule.id,
      category: rule.category,
      risk_points: rule.risk_v2,
      confidence_points: rule.confidence_v2,
      evidence_type: rule.evidence_type,
      ui_label: rule.label,
      templated_text: templateText(rule.evidence_type, rule.label),
    });
    scoringReasons.push({
      signal_id: rule.id,
      category: rule.category,
      points: rule.points,
      label: rule.label,
    });
  }

  // Clamp totals
  riskPoints = Math.max(0, Math.min(10, riskPoints));
  confidencePoints = Math.max(0, Math.min(8, confidencePoints));

  // 3. CEO verdict thresholds
  let verdict: "GREEN" | "YELLOW" | "RED";
  if (hardBlockerHit || riskPoints >= 6) {
    verdict = "RED";
  } else if (riskPoints >= 3 || confidencePoints <= 1) {
    verdict = "YELLOW";
  } else {
    // risk 0-2 AND confidence >= 2 AND no hard flags
    verdict = "GREEN";
  }

  // 4. Evidence label (derived from confidence_points)
  let evidenceLabel: EvidenceLabel;
  if (confidencePoints >= 5) {
    evidenceLabel = "STRONG";
  } else if (confidencePoints >= 2) {
    evidenceLabel = "PARTIAL";
  } else {
    evidenceLabel = "MISSING";
  }

  // 5. Why not green
  const whyNotGreen =
    verdict !== "GREEN"
      ? flagDetails.filter(
          (f) => f.risk_points > 0 || f.confidence_points < 0 || f.evidence_type === "negative"
        )
      : [];

  // 6. Verify before visit (top 5 evidence penalties / absent signals)
  const verifyBeforeVisit = flagDetails
    .filter((f) => f.evidence_type === "absent")
    .slice(0, 5)
    .map((f) => f.ui_label);

  // 7. Backward-compatible derived fields
  const fitScore = Math.max(0, Math.min(100, 100 - riskPoints * 10));
  const evidenceScore = Math.max(
    0,
    Math.min(100, Math.round(confidencePoints * 12.5))
  );

  return {
    risk_points: riskPoints,
    confidence_points: confidencePoints,
    hard_flags_count: hardFlagsCount,
    unknown_flags_count: unknownFlagsCount,
    verdict,
    evidence_label: evidenceLabel,
    flag_details: flagDetails,
    why_not_green: whyNotGreen,
    verify_before_visit: verifyBeforeVisit,
    fit_score: fitScore,
    evidence_score: evidenceScore,
    scoring_reasons: scoringReasons,
    hard_blocker_hit: hardBlockerHit,
    scoring_version: "v2",
  };
}
