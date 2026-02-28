/**
 * Receipt Scoring Rules
 *
 * All rule definitions for the deterministic receipt scoring engine.
 * Signal IDs are extracted by the AI from listing text, then processed
 * by scoreReceipt() to produce fit_score, evidence_score, and verdict.
 */

// --- Signal IDs ---

export type ListingSignalId =
  // Hard blockers (force RED)
  | "title_salvage"
  | "frame_damage_major"
  | "routine_impossible"
  | "dcfc_required_but_absent"
  | "odometer_title_mismatch"
  // Fit penalties (deduct from 100)
  | "no_home_charging"
  | "single_site_dependency"
  | "plan_b_weak"
  | "winter_high_exposure"
  | "longest_day_tight_buffer"
  | "public_charging_cost_risk"
  | "multi_driver_one_charger"
  | "price_over_market_10_15"
  | "price_over_market_15_plus"
  | "prior_damage_minor"
  | "ownership_turnover_high"
  | "battery_replaced_unverified"
  | "dealer_addon_pressure"
  | "model_known_limit_vs_routine"
  // Evidence bonuses (add to 50)
  | "clean_title_explicit"
  | "battery_report_recent"
  | "battery_warranty_info"
  | "service_records_shown"
  | "dcfc_confirmed"
  | "charging_port_photo"
  | "vin_decoded"
  | "ownership_history_clear"
  | "fees_disclosed"
  | "tire_condition_visible"
  | "recall_status_clear"
  // Evidence penalties (subtract from 50)
  | "battery_proof_missing"
  | "battery_warranty_unclear"
  | "service_records_missing"
  | "dcfc_unclear"
  | "ownership_history_unclear"
  | "fees_unclear"
  | "tire_condition_unclear"
  | "title_status_unclear"
  | "vin_missing";

export type ScoringCategory = "routine_friction" | "listing_risk" | "missing_proof";

export interface ReceiptRule {
  id: ListingSignalId;
  type: "hard_blocker" | "fit_penalty" | "evidence_bonus" | "evidence_penalty";
  category: ScoringCategory;
  points: number;
  label: string;
}

// --- Hard Blockers (force RED) ---

export const HARD_BLOCKERS: ReceiptRule[] = [
  { id: "title_salvage", type: "hard_blocker", category: "listing_risk", points: 0, label: "Salvage, rebuilt, flood, or lemon title detected" },
  { id: "frame_damage_major", type: "hard_blocker", category: "listing_risk", points: 0, label: "Major structural or frame damage reported" },
  { id: "routine_impossible", type: "hard_blocker", category: "routine_friction", points: 0, label: "Routine cannot work with this charging setup" },
  { id: "dcfc_required_but_absent", type: "hard_blocker", category: "routine_friction", points: 0, label: "DC fast charging required but not available on this model" },
  { id: "odometer_title_mismatch", type: "hard_blocker", category: "listing_risk", points: 0, label: "Odometer, title, or VIN inconsistency detected" },
];

// --- Fit Penalties (deduct from 100) ---

export const FIT_PENALTIES: ReceiptRule[] = [
  // Routine / charging friction
  { id: "no_home_charging", type: "fit_penalty", category: "routine_friction", points: -10, label: "No home charging adds weekly planning overhead" },
  { id: "single_site_dependency", type: "fit_penalty", category: "routine_friction", points: -12, label: "Routine depends on a single charging location" },
  { id: "plan_b_weak", type: "fit_penalty", category: "routine_friction", points: -10, label: "Backup charging plan unclear or inconvenient" },
  { id: "winter_high_exposure", type: "fit_penalty", category: "routine_friction", points: -8, label: "Cold climate likely reduces range and charging speed" },
  { id: "longest_day_tight_buffer", type: "fit_penalty", category: "routine_friction", points: -12, label: "Longest driving day close to practical range buffer" },
  { id: "public_charging_cost_risk", type: "fit_penalty", category: "routine_friction", points: -6, label: "No home charging plus frequent paid charging expected" },
  { id: "multi_driver_one_charger", type: "fit_penalty", category: "routine_friction", points: -8, label: "Two-driver, one-charger friction not addressed" },
  // Listing / pricing risk
  { id: "price_over_market_10_15", type: "fit_penalty", category: "listing_risk", points: -8, label: "Price estimated 10-15% above market" },
  { id: "price_over_market_15_plus", type: "fit_penalty", category: "listing_risk", points: -15, label: "Price estimated more than 15% above market" },
  { id: "prior_damage_minor", type: "fit_penalty", category: "listing_risk", points: -10, label: "Minor prior damage disclosed but not reflected in price" },
  { id: "ownership_turnover_high", type: "fit_penalty", category: "listing_risk", points: -8, label: "3+ owners in short vehicle life or suspicious turnover" },
  { id: "battery_replaced_unverified", type: "fit_penalty", category: "listing_risk", points: -12, label: "Battery replacement mentioned but proof or source unclear" },
  { id: "dealer_addon_pressure", type: "fit_penalty", category: "listing_risk", points: -10, label: "Dealer add-ons or fees likely inflate out-the-door cost" },
  { id: "model_known_limit_vs_routine", type: "fit_penalty", category: "listing_risk", points: -12, label: "Known model limitation conflicts with expected usage" },
];

// --- Evidence Bonuses (add to 50) ---

export const EVIDENCE_BONUSES: ReceiptRule[] = [
  { id: "clean_title_explicit", type: "evidence_bonus", category: "listing_risk", points: 10, label: "Clean title explicitly stated" },
  { id: "battery_report_recent", type: "evidence_bonus", category: "missing_proof", points: 20, label: "Recent battery health report provided" },
  { id: "battery_warranty_info", type: "evidence_bonus", category: "missing_proof", points: 8, label: "Battery warranty status clearly shown" },
  { id: "service_records_shown", type: "evidence_bonus", category: "missing_proof", points: 10, label: "Service or maintenance records shown" },
  { id: "dcfc_confirmed", type: "evidence_bonus", category: "missing_proof", points: 10, label: "DC fast charging support confirmed" },
  { id: "charging_port_photo", type: "evidence_bonus", category: "missing_proof", points: 5, label: "Charging port photo or connector shown" },
  { id: "vin_decoded", type: "evidence_bonus", category: "missing_proof", points: 10, label: "VIN decoded and matches listing" },
  { id: "ownership_history_clear", type: "evidence_bonus", category: "listing_risk", points: 5, label: "Ownership history shown" },
  { id: "fees_disclosed", type: "evidence_bonus", category: "listing_risk", points: 8, label: "Dealer fees and add-ons disclosed" },
  { id: "tire_condition_visible", type: "evidence_bonus", category: "missing_proof", points: 4, label: "Tire condition shown or mentioned" },
  { id: "recall_status_clear", type: "evidence_bonus", category: "missing_proof", points: 5, label: "Recall status checked or documented" },
];

// --- Evidence Penalties (subtract from 50) ---

export const EVIDENCE_PENALTIES: ReceiptRule[] = [
  { id: "battery_proof_missing", type: "evidence_penalty", category: "missing_proof", points: -15, label: "No battery health proof provided" },
  { id: "battery_warranty_unclear", type: "evidence_penalty", category: "missing_proof", points: -6, label: "Battery warranty status not shown" },
  { id: "service_records_missing", type: "evidence_penalty", category: "missing_proof", points: -8, label: "No service history shown" },
  { id: "dcfc_unclear", type: "evidence_penalty", category: "missing_proof", points: -10, label: "DC fast charging support not confirmed" },
  { id: "ownership_history_unclear", type: "evidence_penalty", category: "missing_proof", points: -6, label: "Owner count or history unclear" },
  { id: "fees_unclear", type: "evidence_penalty", category: "missing_proof", points: -8, label: "Out-the-door fees or add-ons not clear" },
  { id: "tire_condition_unclear", type: "evidence_penalty", category: "missing_proof", points: -4, label: "Tire condition not visible or mentioned" },
  { id: "title_status_unclear", type: "evidence_penalty", category: "missing_proof", points: -12, label: "Title status not explicitly stated" },
  { id: "vin_missing", type: "evidence_penalty", category: "missing_proof", points: -6, label: "VIN not provided" },
];

// --- Aggregates ---

export const ALL_RULES: ReceiptRule[] = [
  ...HARD_BLOCKERS,
  ...FIT_PENALTIES,
  ...EVIDENCE_BONUSES,
  ...EVIDENCE_PENALTIES,
];

export const RULES_BY_ID = new Map<string, ReceiptRule>(
  ALL_RULES.map((r) => [r.id, r])
);

/** All valid signal IDs for validation */
export const VALID_SIGNAL_IDS = new Set<string>(ALL_RULES.map((r) => r.id));

/**
 * Convert a risk flag to a human-readable label.
 *
 * If the flag is a known signal ID (e.g. "battery_proof_missing"), returns the
 * label from the rules table. If it looks like a signal ID (contains underscore
 * or matches after removing underscores) but isn't in the table, falls back to
 * title-casing the snake_case string. If it's already a sentence, returns as-is.
 */
export function humanizeFlag(flag: string): string {
  if (!flag) return flag;

  // Direct lookup by signal ID
  const rule = RULES_BY_ID.get(flag);
  if (rule) return rule.label;

  // Check if it's a smashed-together signal ID (e.g. "batteryproofmissing")
  // by comparing against known IDs with underscores stripped
  for (const r of ALL_RULES) {
    if (r.id.replace(/_/g, "") === flag.toLowerCase().replace(/[^a-z]/g, "")) {
      return r.label;
    }
  }

  // Already human-readable (contains spaces or long enough sentence)
  if (flag.includes(" ")) return flag;

  // Unknown snake_case — title-case it as a last resort
  if (flag.includes("_")) {
    return flag
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return flag;
}
