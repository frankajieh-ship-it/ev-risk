/**
 * Deterministic Repair Cost Estimator
 *
 * Produces a low/high repair cost range from damage category × vehicle value.
 * Replaces the price/marketValue ratio proxy in the salvage scorer.
 *
 * Used by:
 * - SalvageRiskResult (immediate deterministic output)
 * - AI chain (as a calibration anchor for the GPT-4o repair cost step)
 *
 * Multipliers are expressed as a fraction of the vehicle's intact retail value (ARV).
 * Source: industry repair data, NADA, CCC/Mitchell estimates for EVs.
 *
 * "Low" = optimistic repair (single shop, no hidden damage)
 * "High" = conservative repair (full OEM parts, HV system involvement)
 */

import type { DamageCategory } from "./damage-parser";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RepairCostEstimate {
  low: number;
  high: number;
  midpoint: number;
  damage_category: DamageCategory;
  /** As a fraction of ARV — useful for displaying "~25–40% of vehicle value" */
  low_pct: number;
  high_pct: number;
  confidence: "high" | "medium" | "low";
  /** True if repair cost likely exceeds vehicle value — total economic loss */
  likely_total_loss: boolean;
}

export interface RepairCostInput {
  damage_category: DamageCategory;
  /** Intact retail / after-repair value ($) — the reference for multipliers */
  arv: number;
  /** Whether secondary damage adds to primary (e.g. flood + structural) */
  has_secondary_damage?: boolean;
  /** Auction source affects parts pricing (Manheim wholesale vs retail market) */
  auction_source?: "copart" | "iaai" | "manheim";
  /** Whether vehicle is an EV — triggers structural complexity uplift for HV-adjacent damage */
  is_ev?: boolean;
}

// ── Multiplier table ──────────────────────────────────────────────────────────
// [low_fraction, high_fraction]
// Calibrated to EV-specific repair costs (HV system work is expensive)

export const REPAIR_MULTIPLIERS: Record<DamageCategory, [number, number]> = {
  front_end:       [0.08, 0.28],   // airbags, bumper, frunk — often fixable
  rear_end:        [0.07, 0.25],   // trunk, bumper, tail lights
  side:            [0.09, 0.26],   // door panels, quarter panel
  structural:      [0.25, 0.60],   // frame/unibody — very expensive on EVs
  rollover:        [0.30, 0.75],   // roof, pillars, often total loss
  battery:         [0.45, 0.95],   // pack replacement or refurbishment
  flood:           [0.40, 0.90],   // corrosion + electrical + BMS damage
  fire:            [0.55, 1.00],   // often total loss; 1.0 = write-off
  electrical:      [0.18, 0.50],   // OBC, DCDC, harness — specialized labor
  theft_recovery:  [0.05, 0.22],   // usually stripped interior/wheels
  unknown:         [0.15, 0.45],   // wide range when damage type unclear
};

// Secondary damage surcharge — adds a flat percentage when a second damage type exists
const SECONDARY_DAMAGE_SURCHARGE = 0.08;

// Manheim wholesale discount — dealer/fleet buyers pay less for parts
const MANHEIM_DISCOUNT = 0.92;

// EV structural complexity uplift — HV system proximity, BTMS risk, specialized labor
const EV_STRUCTURAL_UPLIFT = 0.15;
const EV_STRUCTURAL_CATEGORIES = new Set<DamageCategory>(["structural", "rollover", "battery"]);

// ── Main function ─────────────────────────────────────────────────────────────

export function estimateRepairCost(input: RepairCostInput): RepairCostEstimate {
  const { damage_category, arv, has_secondary_damage = false, auction_source, is_ev = false } = input;

  if (arv <= 0) {
    return {
      low: 0, high: 0, midpoint: 0,
      damage_category,
      low_pct: 0, high_pct: 0,
      confidence: "low",
      likely_total_loss: false,
    };
  }

  const [baseLow, baseHigh] = REPAIR_MULTIPLIERS[damage_category] ?? REPAIR_MULTIPLIERS.unknown;

  // Secondary damage surcharge
  const lowPct  = baseLow  + (has_secondary_damage ? SECONDARY_DAMAGE_SURCHARGE * 0.5 : 0);
  const highPct = baseHigh + (has_secondary_damage ? SECONDARY_DAMAGE_SURCHARGE : 0);

  // EV structural complexity uplift — HV systems, BTMS proximity, specialized labor
  const evUplift = is_ev && EV_STRUCTURAL_CATEGORIES.has(damage_category) ? (1 + EV_STRUCTURAL_UPLIFT) : 1;
  const effectiveLowPct  = lowPct  * evUplift;
  const effectiveHighPct = highPct * evUplift;

  // Source discount
  const sourceMultiplier = auction_source === "manheim" ? MANHEIM_DISCOUNT : 1.0;

  const low      = Math.round(arv * effectiveLowPct  * sourceMultiplier / 100) * 100;
  const high     = Math.round(arv * effectiveHighPct * sourceMultiplier / 100) * 100;
  const midpoint = Math.round((low + high) / 2 / 100) * 100;

  // Confidence: known category with ARV = high; unknown category = low
  const confidence: RepairCostEstimate["confidence"] =
    damage_category === "unknown" ? "low"
    : arv > 0                     ? "high"
    :                               "medium";

  const likely_total_loss = effectiveHighPct >= 0.85;

  return {
    low,
    high,
    midpoint,
    damage_category,
    low_pct: Math.round(effectiveLowPct * 100),
    high_pct: Math.round(effectiveHighPct * 100),
    confidence,
    likely_total_loss,
  };
}

// ── Profit margin ─────────────────────────────────────────────────────────────

export interface ProfitMargin {
  /** ARV - repair_high - current_bid (worst-case margin) */
  low: number;
  /** ARV - repair_low - current_bid (best-case margin) */
  high: number;
  /** True if worst-case margin > (ARV × 15%) — meaningful upside remains */
  viable: boolean;
  /** As percentage of ARV */
  margin_pct_low: number;
  margin_pct_high: number;
}

export function computeProfitMargin(
  arv: number,
  currentBid: number,
  repairCost: RepairCostEstimate
): ProfitMargin {
  const low  = arv - repairCost.high - currentBid;
  const high = arv - repairCost.low  - currentBid;

  return {
    low:  Math.round(low),
    high: Math.round(high),
    viable: low > arv * 0.15,
    margin_pct_low:  arv > 0 ? Math.round((low  / arv) * 100) : 0,
    margin_pct_high: arv > 0 ? Math.round((high / arv) * 100) : 0,
  };
}
