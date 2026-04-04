/**
 * Salvage Risk Scorer
 *
 * Computes a 0–100 risk score for salvage/rebuilt/auction vehicles.
 * Higher score = safer to bid on (lower underlying risk probability).
 *
 * Architecture:
 *   1. Damage signals  — parsed via negation-aware DamageParser (not raw keyword counts)
 *   2. Six risk factors — battery, structural, title, recall, repair cost, mileage
 *   3. Logistic transform — converts weighted linear sum to risk probability,
 *      removing hard score cliffs at grade boundaries
 *   4. Uncertainty penalty — missing data inflates risk rather than suppressing it
 *   5. Grade thresholds — green ≥65, yellow ≥40, red <40
 *
 * Weights:
 *   Battery damage risk    35%
 *   Structural/charging    25%
 *   Title branding impact  15%
 *   Recall severity        10%
 *   Repair cost proxy      10%
 *   Mileage penalty         5%
 */

import { parseDamageSignals, severityToRisk } from "./auction/damage-parser";
import type { DamageSignals, DamageCategory } from "./auction/damage-parser";
import type { NhtsaRecallSummary } from "./auction/types";
import {
  REPAIR_MULTIPLIERS,
  estimateRepairCost,
  computeProfitMargin,
  type RepairCostEstimate,
  type ProfitMargin,
} from "./auction/repair-cost-estimate";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SalvageRiskFactors {
  battery_risk: number;
  structural_risk: number;
  title_impact: number;
  recall_overlap: number;
  repair_cost_risk: number;
  mileage_penalty: number;
  thermal_integrity_risk: boolean;
}

export type SalvageGrade = "green" | "yellow" | "red";

export interface SalvageRiskResult {
  /** 0–100 safety score — higher = safer to bid on */
  score: number;
  /** Underlying risk probability 0.0–1.0 (used for calibration/display) */
  risk_probability: number;
  grade: SalvageGrade;
  factors: SalvageRiskFactors;
  routine_impact_summary: string;
  /** Suggested bid discount % (0 if no discount recommended) */
  suggested_bid_discount: number;
  /** Rough ARV hint derived from asking price + damage multiplier (heuristic) */
  arv_hint_low?: number;
  arv_hint_high?: number;
  /** How much uncertainty is in the score due to missing data */
  uncertainty_level: "low" | "medium" | "high";
  /** Deterministic repair cost range based on damage category × ARV */
  expected_repair_cost: RepairCostEstimate | null;
  /** Profit margin after bid + repair (requires ARV + current_bid) */
  profit_margin: ProfitMargin | null;
  /** Inferred primary damage category — used for display and downstream filtering */
  primary_damage_category: DamageCategory;
}

// ── Cold-climate state detection ──────────────────────────────────────────────
// EV Battery Thermal Management Systems are stress-tested by cold climates.
// Front-end / structural damage in these states increases BTMS integrity risk.

const COLD_CLIMATE_STATES = new Set([
  "MN","WI","MI","IL","OH","PA","NY","VT","NH","ME","ND","SD","MT","WY","CO","IA","NE","KS","IN",
]);

function isColdClimateState(state?: string | null): boolean {
  return Boolean(state && COLD_CLIMATE_STATES.has(state.toUpperCase()));
}

// ── Title risk table ──────────────────────────────────────────────────────────

function titleRisk(
  titleStatus: string,
  primaryCategory: string,
  hasFlood: boolean,
  hasFire: boolean
): number {
  const title = titleStatus.toLowerCase();

  if (title === "clean") return 0;

  if (title === "salvage") {
    if (hasFire || hasFlood) return 95;
    if (primaryCategory === "battery") return 90;
    if (primaryCategory === "structural" || primaryCategory === "rollover") return 80;
    if (primaryCategory === "theft_recovery") return 50;
    return 75;
  }

  if (title === "rebuilt" || title === "reconstructed") {
    if (hasFire || hasFlood) return 60;
    if (primaryCategory === "battery") return 55;
    return 35;
  }

  if (title.includes("lemon"))  return 60;
  if (title.includes("flood"))  return 90;
  if (title.includes("parts"))  return 85;

  return 30; // unknown
}

// ── 11B. Damage category inference ───────────────────────────────────────────
//
// Maps parsed DamageSignals → DamageCategory for repair cost lookup.
// Mirrors the priority hierarchy in damage-parser's inferPrimaryCategory.

function inferDamageCategory(signals: DamageSignals): DamageCategory {
  if (signals.fire.detected && signals.fire.severity === "confirmed") return "fire";
  if (signals.battery.detected && signals.battery.severity !== "possible") return "battery";
  if (signals.flood.detected) return "flood";
  if (signals.structural.detected && signals.structural.severity !== "possible") return "structural";
  if (signals.electrical.detected) return "electrical";
  return signals.primary_category !== "unknown" ? signals.primary_category : "unknown";
}

// ── 11C. Recall severity scoring — open status + summary text ────────────────

const HIGH_SEVERITY_RECALL_COMPONENTS = [
  "battery", "high voltage", "fire", "thermal", "charging system",
  "electric motor", "inverter", "bms", "battery management",
  "propulsion", "traction battery",
];

function recallRisk(recalls: NhtsaRecallSummary[]): number {
  if (!recalls.length) return 0;
  let total = 0;
  for (const r of recalls) {
    const component = (r.Component ?? "").toLowerCase();
    const summary   = (r.Summary   ?? "").toLowerCase();
    // Open recall: Remedy field absent or very short (< 10 chars = no fix described)
    const isOpen = !r.Remedy || r.Remedy.length < 10;

    const isHighSeverity = HIGH_SEVERITY_RECALL_COMPONENTS.some((c) => component.includes(c));
    const mentionsFire   = summary.includes("fire") || summary.includes("thermal");

    let pts = isHighSeverity ? 35 : 12;
    if (isOpen)        pts = Math.round(pts * 1.4);   // unresolved recall = more risk
    if (mentionsFire)  pts = Math.round(pts * 1.2);   // fire/thermal in description
    total += pts;
  }
  return Math.min(100, total);
}

// ── Mileage — smooth exponential curve ───────────────────────────────────────

function mileageRisk(mi: number | null | undefined): number {
  if (!mi || mi <= 0) return 0;
  return Math.min(80, Math.pow(Math.max(0, mi - 30_000) / 130_000, 1.4) * 80);
}

// ── Logistic transform ────────────────────────────────────────────────────────

function logistic(rawRisk: number): number {
  return 1 / (1 + Math.exp(-(rawRisk - 50) / 17));
}

// ── Input type ────────────────────────────────────────────────────────────────

interface MinimalReceiptInput {
  title_status?: string | null;
  accidents_reported?: string | null;
  mileage?: number | null;
  price?: number | null;
  /** Intact after-repair value — enables deterministic repair cost + profit margin */
  arv?: number | null;
  auction_source?: "copart" | "iaai" | "manheim";
  listing_text?: string | null;
  primary_damage?: string | null;
  secondary_damage?: string | null;
  loss_type?: string | null;
  zip_or_postcode?: string | null;
  /** Two-letter US state code — used for cold-climate thermal penalty */
  state?: string | null;
  /** Whether vehicle is an EV — enables thermal integrity risk check */
  is_ev?: boolean | null;
  recalls?: NhtsaRecallSummary[];
  // legacy compat — receipt wrapper
  receipt?: {
    active_recalls?: number | null;
    market_value?: number | null;
    listing_summary?: { vehicle?: { mileage?: number; price?: number } } | null;
  } | null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeSalvageRisk(input: MinimalReceiptInput): SalvageRiskResult {
  const titleStatus = (input.title_status ?? "unknown").toLowerCase();
  const mileage = input.mileage ?? input.receipt?.listing_summary?.vehicle?.mileage ?? 0;
  const price = input.price ?? input.receipt?.listing_summary?.vehicle?.price ?? 0;
  const marketValue = input.receipt?.market_value ?? price;
  const recalls: NhtsaRecallSummary[] = input.recalls ?? [];

  // ── Parse damage signals (negation-aware) ────────────────────────────────
  const signals = parseDamageSignals(
    input.listing_text,
    input.primary_damage,
    input.secondary_damage,
    input.loss_type
  );

  const hasFlood = signals.flood.detected && signals.flood.severity !== "possible";
  const hasFire  = signals.fire.detected  && signals.fire.severity  !== "possible";
  const primaryCategory = signals.primary_category;

  console.log(`[SalvageScorer] signals=${JSON.stringify({ battery: signals.battery.severity, structural: signals.structural.severity, flood: signals.flood.severity, fire: signals.fire.severity, primary_category: primaryCategory })}`);

  // ── 1. Battery damage risk (35%) ────────────────────────────────────────
  let batteryRisk = severityToRisk(signals.battery);
  if (hasFire)  batteryRisk = Math.max(batteryRisk, 70);
  if (hasFlood) batteryRisk = Math.max(batteryRisk, 55);
  if (titleStatus === "salvage") batteryRisk = Math.min(100, batteryRisk + 10);
  if (titleStatus === "rebuilt") batteryRisk = Math.min(100, batteryRisk + 3);
  if (signals.no_data) batteryRisk = Math.max(batteryRisk, 15);

  // ── 2. Structural / charging risk (25%) ──────────────────────────────────
  let structuralRisk = severityToRisk(signals.structural);
  if (titleStatus === "salvage")   structuralRisk = Math.min(100, structuralRisk + 15);
  else if (titleStatus === "rebuilt") structuralRisk = Math.min(100, structuralRisk + 5);
  if (signals.no_data) structuralRisk = Math.max(structuralRisk, 20);

  // ── 3. Title branding impact (15%) ───────────────────────────────────────
  let titleImpact = titleRisk(titleStatus, primaryCategory, hasFlood, hasFire);
  const zip = (input.zip_or_postcode ?? "").toLowerCase();
  const highHumidityPrefixes = ["fl", "la", "al", "ms", "sc", "ga", "3", "7"];
  if (highHumidityPrefixes.some((p) => zip.startsWith(p))) {
    titleImpact = Math.min(100, titleImpact + 10);
  }

  // ── 4. Recall severity (10%) — component-weighted ────────────────────────
  const recallOverlap = recallRisk(recalls);

  // ── 5. Repair cost risk (10%) — 11A: damage-type multiplier ─────────────────
  // Replaces the price-ratio proxy (which required ARV to be available).
  // Always computable from damage signals alone.
  const primaryDamageCategory = inferDamageCategory(signals);
  const [rcLow, rcHigh] = REPAIR_MULTIPLIERS[primaryDamageCategory] ?? [0.15, 0.45];
  const repairMidpointFraction = (rcLow + rcHigh) / 2;
  // Map repair fraction to 0–100 risk: 0.18 → ~20, 0.40 → ~44, 0.70 → ~77, 0.95 → ~100
  let repairCostRisk = Math.min(100, Math.round(repairMidpointFraction * 110));
  // Secondary signal: if bid is very high relative to market (>85%) AND severe damage → +10
  if (marketValue > 0 && price > 0) {
    const priceRatio = price / marketValue;
    if (priceRatio > 0.85 &&
        (primaryDamageCategory === "structural" || primaryDamageCategory === "battery" ||
         primaryDamageCategory === "fire" || primaryDamageCategory === "flood")) {
      repairCostRisk = Math.min(100, repairCostRisk + 10);
    }
  }

  // ── 6. Mileage penalty (5%) — smooth exponential ─────────────────────────
  const milagePenalty = Math.round(mileageRisk(mileage));

  console.log(`[SalvageScorer] battery=${batteryRisk} structural=${structuralRisk} title=${titleImpact} recall=${recallOverlap} repair=${repairCostRisk} mileage=${milagePenalty}`);

  // ── Uncertainty penalty ───────────────────────────────────────────────────
  const missingFields = [
    signals.no_data,
    !input.primary_damage,
    !input.mileage,
    titleStatus === "unknown",
  ].filter(Boolean).length;

  const uncertaintyPenalty = missingFields * 4; // 0–16 pts

  const uncertaintyLevel: SalvageRiskResult["uncertainty_level"] =
    missingFields >= 3 ? "high" : missingFields >= 1 ? "medium" : "low";

  // ── Weighted composite + logistic transform ───────────────────────────────
  const rawRisk =
    batteryRisk    * 0.35 +
    structuralRisk * 0.25 +
    titleImpact    * 0.15 +
    recallOverlap  * 0.10 +
    repairCostRisk * 0.10 +
    milagePenalty  * 0.05 +
    uncertaintyPenalty;

  const risk_probability = logistic(rawRisk);
  const score = Math.round(Math.max(0, Math.min(100, 100 * (1 - risk_probability))));

  console.log(`[SalvageScorer] rawRisk=${rawRisk.toFixed(2)} risk_probability=${risk_probability.toFixed(3)} score=${score}`);

  // ── Thermal integrity penalty (EV + front-end/structural + cold climate) ──
  // Front-end damage in cold climates compromises BTMS proximity and integrity.
  const thermalIntegrityRisk =
    input.is_ev === true &&
    (primaryDamageCategory === "front_end" || primaryDamageCategory === "structural") &&
    isColdClimateState(input.state);
  const adjustedScore = thermalIntegrityRisk ? Math.round(score * 0.88) : score;

  const grade: SalvageGrade = adjustedScore >= 65 ? "green" : adjustedScore >= 40 ? "yellow" : "red";

  // ── Bid discount ──────────────────────────────────────────────────────────
  let suggested_bid_discount = 0;
  if (score < 40)      suggested_bid_discount = 30;
  else if (score < 55) suggested_bid_discount = 20;
  else if (score < 65) suggested_bid_discount = 15;
  else if (score < 75) suggested_bid_discount = 10;

  // ── Summary ───────────────────────────────────────────────────────────────
  const routine_impact_summary = buildSummary(grade, titleStatus, signals, recalls.length);

  // ── ARV hint ──────────────────────────────────────────────────────────────
  let arv_hint_low: number | undefined;
  let arv_hint_high: number | undefined;
  if (price > 0) {
    const [dampLow, dampHigh] =
      grade === "green"  ? [0.20, 0.35] :
      grade === "yellow" ? [0.35, 0.55] :
                           [0.55, 0.75];
    arv_hint_low  = Math.round(price / (1 - dampLow)  / 500) * 500;
    arv_hint_high = Math.round(price / (1 - dampHigh) / 500) * 500;
  }

  // ── Deterministic repair cost + profit margin ─────────────────────────────
  const effectiveArv = input.arv ?? arv_hint_low ?? null;
  const expected_repair_cost = effectiveArv
    ? estimateRepairCost({
        damage_category: primaryCategory,
        arv: effectiveArv,
        has_secondary_damage: !!(input.secondary_damage?.trim()),
        auction_source: input.auction_source,
      })
    : null;

  const profit_margin =
    effectiveArv && price > 0 && expected_repair_cost
      ? computeProfitMargin(effectiveArv, price, expected_repair_cost)
      : null;

  return {
    score: adjustedScore,
    risk_probability: Math.round(risk_probability * 1000) / 1000,
    grade,
    factors: {
      battery_risk:          Math.round(batteryRisk),
      structural_risk:       Math.round(structuralRisk),
      title_impact:          Math.round(titleImpact),
      recall_overlap:        Math.round(recallOverlap),
      repair_cost_risk:      Math.round(repairCostRisk),
      mileage_penalty:       milagePenalty,
      thermal_integrity_risk: thermalIntegrityRisk,
    },
    routine_impact_summary,
    suggested_bid_discount,
    arv_hint_low,
    arv_hint_high,
    uncertainty_level: uncertaintyLevel,
    expected_repair_cost,
    profit_margin,
    primary_damage_category: primaryDamageCategory,
  };
}

// ── Summary text ──────────────────────────────────────────────────────────────

function buildSummary(
  grade: SalvageGrade,
  titleStatus: string,
  signals: DamageSignals,
  recallCount: number
): string {
  if (grade === "green") {
    return "Low salvage risk. No significant damage indicators detected. Suitable for routine EV use if mechanically inspected.";
  }

  if (grade === "yellow") {
    const parts: string[] = ["Moderate salvage risk."];
    if (titleStatus === "salvage") parts.push("Salvage title requires careful inspection.");
    if (signals.battery.detected)    parts.push(`Battery system concern detected (${signals.battery.severity}).`);
    if (signals.flood.detected)      parts.push("Possible flood exposure noted.");
    if (signals.structural.detected) parts.push("Structural or charging keywords flagged.");
    if (recallCount > 0) parts.push(`${recallCount} open recall(s) — verify completion before bidding.`);
    parts.push("Factor repair costs into your bid.");
    return parts.join(" ");
  }

  // red
  const parts: string[] = ["High salvage risk."];
  if (signals.battery.severity === "confirmed" || signals.battery.severity === "likely") {
    parts.push("Battery damage strongly indicated.");
  }
  if (signals.fire.detected)  parts.push("Fire damage detected.");
  if (signals.flood.detected) parts.push("Flood damage detected.");
  if (signals.structural.severity === "confirmed") parts.push("Confirmed structural damage.");
  if (titleStatus === "salvage") parts.push("Salvage title significantly reduces resale value and insurability.");
  if (recallCount > 1) parts.push(`${recallCount} open recalls outstanding.`);
  parts.push("EV specialist inspection strongly recommended before bidding.");
  return parts.join(" ");
}
