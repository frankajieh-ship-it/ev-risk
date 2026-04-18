/**
 * Receipt Signal Extractor
 *
 * Extracts listing signals from text + structured fields using regex/keyword
 * patterns. Pure function, no network calls, < 10ms on 3500 chars.
 *
 * Used to produce meaningful fallback receipts when OpenAI times out,
 * replacing generic "AI analysis timed out" boilerplate with specific
 * signals, scores, and buyer guidance.
 */

import type { ListingSignalId } from "./receipt-rules";
import type { VehicleClassification } from "./vehicle-classifier";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StructuredFields {
  title_status?: string;
  service_history?: string;
  accidents_reported?: string;
  owners?: number | null;
  vin?: string;
  carfax_available?: string;
  mileage?: number | null;
  year?: number | null;
}

interface SignalPattern {
  signalId: ListingSignalId;
  positive: RegExp[];
  negation?: RegExp[];
}

// ---------------------------------------------------------------------------
// Pattern Definitions
// ---------------------------------------------------------------------------

const HARD_BLOCKER_PATTERNS: SignalPattern[] = [
  {
    signalId: "title_salvage",
    positive: [
      /\b(salvage\s+title|rebuilt\s+title|flood\s+title|lemon\s+title|branded\s+title)\b/,
    ],
    negation: [/\b(no\s+salvage|not\s+salvage|clean\s+title)\b/],
  },
  {
    signalId: "frame_damage_major",
    positive: [/\b(frame\s+damage|structural\s+damage|unibody\s+damage)\b/],
    negation: [/\b(no\s+frame\s+damage|no\s+structural\s+damage)\b/],
  },
  {
    signalId: "odometer_title_mismatch",
    positive: [
      /\b(odometer\s+discrepanc|title\s+brand|odometer\s+rollback|mileage\s+discrepanc)\b/,
    ],
  },
];

const EVIDENCE_BONUS_PATTERNS: SignalPattern[] = [
  {
    signalId: "clean_title_explicit",
    positive: [
      /\b(clean\s+title|title:\s*clean|clear\s+title)\b/,
      /\bno\s+accidents?\b/,
      /\baccident[\s-]*free\b/,
      /\bzero\s+accidents?\b/,
    ],
    negation: [/\b(not\s+clean|salvage|rebuilt)\b/],
  },
  {
    signalId: "service_records_shown",
    positive: [
      /\b(service\s+records?|maintenance\s+(history|records?)|service\s+history\s+available|full\s+service\s+history|dealer\s+serviced)\b/,
    ],
    negation: [/\b(no\s+service|missing\s+service|lack\s+of\s+service)\b/],
  },
  {
    signalId: "battery_report_recent",
    positive: [
      /\b(battery\s+health|state\s+of\s+health|battery\s+report|battery\s+degradation)\b/,
      /\bsoh\s*[\d:=]/,
    ],
    negation: [/\b(no\s+battery\s+(health|report)|need\s+battery\s+report)\b/],
  },
  {
    signalId: "battery_warranty_info",
    positive: [
      /\b(battery\s+warranty|warranty\s+(until|through|expires?|remaining|covered))\b/,
      /\b\d+\s*yr?\s*warranty\s*on\s*battery\b/,
    ],
  },
  {
    signalId: "dcfc_confirmed",
    positive: [
      /\b(fast\s+charg(e|ing|er)|dc\s+fast|ccs\s+(combo|port|connector)?|chademo|dcfc|supercharg)\b/,
    ],
    negation: [
      /\b(no\s+(fast|dc)\s+charg|does\s+not\s+support\s+(fast|dc))\b/,
    ],
  },
  {
    signalId: "ownership_history_clear",
    positive: [
      /\b(one\s+owner|1[\s-]+owner|single\s+owner|first\s+owner)\b/,
    ],
    negation: [/\b(not\s+one\s+owner|multiple\s+owners?)\b/],
  },
  {
    signalId: "fees_disclosed",
    positive: [
      /\b(no\s+dealer\s+fees?|fees?\s+included|out[\s-]+the[\s-]+door|otd\s+price|no\s+add[\s-]?ons?|no\s+hidden\s+fees?)\b/,
    ],
  },
  {
    signalId: "tire_condition_visible",
    positive: [
      /\b(new\s+tires?|tire\s+(tread|condition|life)|recent\s+tires?)\b/,
      /\b\d+\s*%\s*tread\b/,
    ],
  },
  {
    signalId: "recall_status_clear",
    positive: [
      /\b(no\s+(open\s+)?recalls?|recalls?\s+(completed|resolved|clear|done)|recall[\s-]+free)\b/,
    ],
  },
  {
    signalId: "frame_photo_present",
    positive: [
      /\b(frame\s+photo|underbody\s+photo|chassis\s+photo|underbody\s+pic|frame\s+pic|frame\s+pictures?)\b/i,
    ],
  },
  {
    signalId: "underhood_photo_present",
    positive: [
      /\b(underhood\s+photo|engine\s+bay\s+photo|engine\s+photo|engine\s+bay\s+pic|under\s*hood\s+pic)\b/i,
    ],
  },
];

const FIT_PENALTY_PATTERNS: SignalPattern[] = [
  {
    signalId: "prior_damage_minor",
    positive: [
      /\baccidents?\b/,
      /\b(minor\s+damage|fender\s+bender|repainted\s+panel|body\s+work|paint\s+work)\b/,
    ],
    negation: [
      /\bno\s+accidents?\b/,
      /\baccident[\s-]*free\b/,
      /\bzero\s+accidents?\b/,
      /\b0\s+accidents?\b/,
    ],
  },
  {
    signalId: "dealer_addon_pressure",
    positive: [
      /\b(dealer\s+markup|market\s+adjust(ment)?|nitrogen|paint\s+protection|fabric\s+protection|etch(ed)?\s+glass|add[\s-]?on\s+package)\b/,
    ],
  },
  {
    signalId: "battery_replaced_unverified",
    positive: [/\b(battery\s+replaced|new\s+battery|replacement\s+battery)\b/],
    negation: [/\b(oem\s+battery|original\s+battery|warranty\s+replacement)\b/],
  },
  {
    signalId: "ownership_turnover_high",
    positive: [/\b(multiple\s+owners?)\b/, /\b([4-9]|\d{2,})\s+owners?\b/],
    negation: [/\b(one\s+owner|1[\s-]+owner|single\s+owner)\b/],
  },
];

// Inverse evidence: bonus → penalty mapping
const INVERSE_EVIDENCE: {
  bonusId: ListingSignalId;
  penaltyId: ListingSignalId;
  skipWhenField?: (fields: StructuredFields) => boolean;
  onlyForEV?: boolean;
}[] = [
  {
    bonusId: "clean_title_explicit",
    penaltyId: "title_status_unclear",
    skipWhenField: (f) =>
      !!f.title_status && f.title_status !== "unknown",
  },
  { bonusId: "battery_report_recent", penaltyId: "battery_proof_missing" },
  { bonusId: "battery_report_recent", penaltyId: "battery_no_proof_risk", onlyForEV: true },
  { bonusId: "battery_warranty_info", penaltyId: "battery_warranty_unclear" },
  {
    bonusId: "service_records_shown",
    penaltyId: "service_records_missing",
    skipWhenField: (f) => f.service_history === "yes",
  },
  { bonusId: "dcfc_confirmed", penaltyId: "dcfc_unclear", onlyForEV: true },
  {
    bonusId: "ownership_history_clear",
    penaltyId: "ownership_history_unclear",
    skipWhenField: (f) => f.owners != null,
  },
  { bonusId: "fees_disclosed", penaltyId: "fees_unclear" },
  { bonusId: "tire_condition_visible", penaltyId: "tire_condition_unclear" },
];

// ---------------------------------------------------------------------------
// Negation-aware pattern matching
// ---------------------------------------------------------------------------

/**
 * Check if a signal's positive pattern matches the text AND is NOT
 * suppressed by a negation pattern in a nearby window.
 */
function matchesPattern(text: string, pattern: SignalPattern): boolean {
  // Check if any positive pattern matches
  let hasPositiveMatch = false;
  for (const pos of pattern.positive) {
    if (pos.test(text)) {
      hasPositiveMatch = true;
      break;
    }
  }
  if (!hasPositiveMatch) return false;

  // Check negation patterns against full text
  if (pattern.negation) {
    for (const neg of pattern.negation) {
      if (neg.test(text)) {
        return false; // suppressed
      }
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

export function extractSignalsFromText(
  listingText: string | null,
  fields: StructuredFields,
  classification: VehicleClassification
): ListingSignalId[] {
  const signals = new Set<ListingSignalId>();
  const text = (listingText || "").toLowerCase();
  const hasText = text.length > 10;

  // --- Phase 1: Structured field signals ---

  // Hard blockers from fields
  if (
    fields.title_status === "salvage" ||
    fields.title_status === "rebuilt"
  ) {
    signals.add("title_salvage");
  }

  // Evidence from fields
  if (fields.title_status === "clean") {
    signals.add("clean_title_explicit");
  }

  if (fields.service_history === "yes") {
    signals.add("service_records_shown");
  }

  if (fields.owners != null && fields.owners <= 2) {
    signals.add("ownership_history_clear");
  }
  if (fields.owners != null && fields.owners >= 4) {
    signals.add("ownership_turnover_high");
  }

  if (fields.vin) {
    signals.add("vin_decoded");
  }

  if (fields.accidents_reported === "no") {
    signals.add("clean_title_explicit");
  }

  // --- Phase 2: Text pattern matching ---

  if (hasText) {
    // Hard blockers
    for (const pattern of HARD_BLOCKER_PATTERNS) {
      if (matchesPattern(text, pattern)) {
        signals.add(pattern.signalId);
      }
    }

    // Evidence bonuses
    for (const pattern of EVIDENCE_BONUS_PATTERNS) {
      if (matchesPattern(text, pattern)) {
        signals.add(pattern.signalId);
      }
    }

    // Fit penalties
    for (const pattern of FIT_PENALTY_PATTERNS) {
      if (matchesPattern(text, pattern)) {
        signals.add(pattern.signalId);
      }
    }
  }

  // --- Phase 3: Vehicle classification signals ---

  if (classification.category === "EV") {
    if (classification.dcfcSupport === "yes") {
      signals.add("dcfc_confirmed");
    }
  }

  // --- Phase 3b: Battery health estimation proxy ---
  // When no battery report is present but we have year + mileage, we can
  // estimate SOH from age/mileage degradation. Award a small evidence bonus
  // to avoid double-penalizing listings that simply don't mention battery health.
  if (
    !signals.has("battery_report_recent") &&
    fields.year &&
    fields.mileage != null &&
    fields.mileage > 0 &&
    classification.category === "EV"
  ) {
    const vehicleAge = new Date().getFullYear() - fields.year;
    const expectedMileage = vehicleAge * 12000;
    // Credible proxy when age ≥ 1yr, mileage ≤ 150k, and not massively over-driven
    if (vehicleAge >= 1 && fields.mileage <= 150000 && fields.mileage <= expectedMileage * 2.5) {
      signals.add("battery_health_estimated");
    }
  }

  // --- Phase 4: Inverse evidence penalties ---
  // For each bonus NOT triggered, apply the corresponding penalty

  for (const inv of INVERSE_EVIDENCE) {
    if (signals.has(inv.bonusId)) continue; // bonus found, skip penalty

    // EV-only check
    if (inv.onlyForEV && classification.category !== "EV") continue;

    // Skip when structured field already provides the info
    if (inv.skipWhenField && inv.skipWhenField(fields)) continue;

    // For DCFC, also skip if classifier says "yes" (already added bonus above)
    if (
      inv.penaltyId === "dcfc_unclear" &&
      classification.dcfcSupport === "yes"
    ) {
      continue;
    }

    signals.add(inv.penaltyId);
  }

  // VIN penalty (not part of inverse evidence loop)
  if (!fields.vin && !signals.has("vin_decoded")) {
    signals.add("vin_missing");
  }

  // Signal mismatch: structural damage claimed but no frame/underbody photo evidence
  if (hasText) {
    const hasStructuralClaim = /\b(structural\s+damage|frame\s+damage|unibody|chassis\s+damage|front[\s-]end\s+(damage|collision|impact)|rear[\s-]end\s+(damage|collision)|major\s+(damage|collision))\b/.test(text);
    const hasFramePhoto = signals.has("frame_photo_present") || signals.has("underhood_photo_present");
    if (hasStructuralClaim && !hasFramePhoto) {
      signals.add("structural_claim_no_photo");
    }
  }

  return Array.from(signals);
}
