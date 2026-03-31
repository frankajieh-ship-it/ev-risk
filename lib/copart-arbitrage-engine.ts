/**
 * Copart Arbitrage Engine
 *
 * Types, JSON schema, and prompt builder for the repair cost OpenAI call.
 * Used by /api/copart/arbitrage/route.ts
 */

import { computeCopartFees, type CopartFeeBreakdown } from "@/lib/auction/copart-fee-calculator"

export type { CopartFeeBreakdown }

// ── Types ────────────────────────────────────────────────────────────────────

export interface ArbitrageRequest {
  receipt_id: string;
  vin: string | null;
  listing_text: string;
  asking_price: number | null;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  receipt_token: string;
}

export interface RepairLineItem {
  component: string;
  cost_low: number;
  cost_high: number;
  notes: string;
}

export interface RepairCostOutput {
  repair_cost_total_low: number;
  repair_cost_total_high: number;
  breakdown: RepairLineItem[];
  parts_value_total: number;
  parts_value_breakdown: RepairLineItem[];
  confidence: "high" | "medium" | "low";
  confidence_reason: string;
  caveats: string[];
}

export interface MarketClosingRange {
  low: number;
  high: number;
  midpoint: number;
  note: string;
}

export interface ArbitrageResult {
  /** After-Repair Value midpoint (null if unavailable) */
  arv: number | null;
  arv_range: { low: number; high: number } | null;
  arv_source: "auto_dev_listings" | "vin_msrp" | "depreciation_curve" | "none";
  arv_listing_count: number;
  repair_cost_estimate: number;
  repair_cost_low: number;
  repair_cost_high: number;
  repair_cost_breakdown: RepairLineItem[];
  parts_value: number;
  parts_value_breakdown: RepairLineItem[];
  /** Max safe bid at default 20% target margin */
  max_safe_bid: number | null;
  /** Backward-compat: total fees in dollars */
  auction_fees_estimate: number;
  /** Real tiered fee breakdown */
  auction_fees_breakdown: CopartFeeBreakdown | null;
  /** Risk buffer percentage applied (dynamic based on salvage score) */
  risk_buffer_pct: number;
  confidence: "high" | "medium" | "low";
  caveats: string[];
  damage_type_inferred: string;
  /**
   * Expected profit if you buy at asking price and repair.
   * = ARV − asking_price − repair_cost_estimate − auction_fees
   * Null when ARV or asking price is unavailable.
   */
  expected_profit_repair: number | null;
  /**
   * Expected profit if you buy at asking price and strip for parts.
   * = parts_value − asking_price − auction_fees
   * Null when asking price is unavailable.
   */
  expected_profit_parts: number | null;
  /**
   * Safe bid range at the default 20% margin, using repair_cost_low/high
   * to express uncertainty as a range instead of a single number.
   */
  safe_bid_range: { low: number; high: number } | null;
  /**
   * Profit scenarios for repair strategy at asking price.
   * best = ARV - repair_cost_low - fees
   * worst = ARV - repair_cost_high - fees
   * likely = ARV - repair_cost_estimate - fees  (same as expected_profit_repair)
   */
  profit_scenarios_repair: { best: number; worst: number; likely: number } | null;
  /**
   * Recommended strategy based on best expected profit.
   */
  recommended_strategy: "repair" | "parts" | null;
  /**
   * Deterministic market closing estimate (32–45% of clean ARV).
   * Represents where competitive bidders are likely to land.
   */
  market_closing_estimate: MarketClosingRange | null;
}

// ── Damage type inference ─────────────────────────────────────────────────────

const DAMAGE_PATTERNS: Array<{ keywords: string[]; label: string }> = [
  { keywords: ["fire", "burned", "burnt", "thermal event", "battery fire", "electrical fire"], label: "fire damage" },
  { keywords: ["flood", "submerged", "water damage", "hurricane", "hail and water"], label: "flood/water damage" },
  { keywords: ["rollover", "rolled over", "roof crush", "roof damage"], label: "rollover damage" },
  { keywords: ["hail", "hail damage", "dent", "ding"], label: "hail damage" },
  { keywords: ["rear end", "rear impact", "hit from behind", "rear collision", "back end"], label: "rear impact" },
  { keywords: ["side impact", "t-bone", "side collision", "door damage", "b-pillar"], label: "side impact" },
  { keywords: ["front end", "front impact", "head-on", "front collision", "hood damage", "bumper"], label: "front impact" },
  { keywords: ["theft", "stolen", "stripped"], label: "theft recovery" },
];

export function inferDamageType(listingText: string): string {
  const lower = listingText.toLowerCase();
  for (const { keywords, label } of DAMAGE_PATTERNS) {
    if (keywords.some((k) => lower.includes(k))) return label;
  }
  return "unspecified damage";
}

// ── OpenAI JSON Schema ────────────────────────────────────────────────────────

const repairLineItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["component", "cost_low", "cost_high", "notes"],
  properties: {
    component: { type: "string" },
    cost_low: { type: "number" },
    cost_high: { type: "number" },
    notes: { type: "string" },
  },
};

export const REPAIR_COST_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "repair_cost_total_low",
    "repair_cost_total_high",
    "breakdown",
    "parts_value_total",
    "parts_value_breakdown",
    "confidence",
    "confidence_reason",
    "caveats",
  ],
  properties: {
    repair_cost_total_low: { type: "number" },
    repair_cost_total_high: { type: "number" },
    breakdown: { type: "array", items: repairLineItemSchema },
    parts_value_total: { type: "number" },
    parts_value_breakdown: { type: "array", items: repairLineItemSchema },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    confidence_reason: { type: "string" },
    caveats: { type: "array", items: { type: "string" } },
  },
};

// ── Prompt builder ────────────────────────────────────────────────────────────

export const REPAIR_COST_SYSTEM_PROMPT = `You are an expert automotive repair cost estimator specializing in salvage auction vehicles.

Given a damaged vehicle's make, model, year, trim, damage type, and listing details, return a structured JSON repair cost estimate in USD.

Base your estimates on:
- Independent shop labor rates ($90–$150/hr US average), NOT dealer rates
- Mix of OEM and quality aftermarket parts where appropriate
- Current used parts market prices for high-cost components (doors, hoods, fenders, quarter panels)
- EV-specific: HV battery pack replacement costs $8,000–$25,000+ depending on make/model/capacity
  Always flag if damage keywords suggest HV battery or charging system involvement
- Body shop rates for paint/body work ($50–$80/hr)

Confidence rules:
- "high": damage type is clear and localized (e.g. "rear impact with trunk/bumper damage only")
- "medium": damage involves electrical systems, airbag deployment, or is partially ambiguous
- "low": flood, fire, HV battery suspected, rollover, or vague/unknown damage description

Parts value rules:
- Only include components with active resale demand (engines, transmissions, doors, hoods, seats, wheels, modules)
- Do NOT include airbag modules (illegal to resell in most US states)
- Do NOT include components clearly destroyed by the damage
- For EVs: HV battery packs have high parts value ($5,000–$20,000) if not thermally damaged

Return ONLY valid JSON. No markdown fences. No explanation text outside the JSON object.`;

export function buildRepairCostUserPrompt(req: {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  damageType: string;
  askingPrice: number | null;
  listingText: string;
}): string {
  const vehicle = [req.year, req.make, req.model, req.trim].filter(Boolean).join(" ") || "Unknown vehicle";
  const price = req.askingPrice ? `$${req.askingPrice.toLocaleString()}` : "Unknown";
  const text = req.listingText.slice(0, 1500);

  return `VEHICLE: ${vehicle}
DAMAGE TYPE: ${req.damageType}
ASKING PRICE: ${price}

LISTING DETAILS:
${text}

Estimate:
1. Total repair cost to bring this vehicle to retail-ready condition (low and high range + itemized breakdown)
2. Parts-only value if stripped instead of repaired (total + itemized breakdown)
3. Confidence level and any important caveats the buyer should know before bidding`;
}

// ── Auction fee estimate ──────────────────────────────────────────────────────

/**
 * Legacy fixed estimate — kept for backward compatibility where a bid price
 * isn't available yet. Prefer computeCopartFees(bidPrice) when bid is known.
 */
export const AUCTION_FEES_ESTIMATE = 1000;

// ── Risk buffer ───────────────────────────────────────────────────────────────

/**
 * Dynamic risk buffer percentage based on salvage risk score (0–100).
 * Higher score = lower risk = smaller required margin buffer.
 */
export function getRiskBufferPct(salvageRiskScore: number): number {
  if (salvageRiskScore >= 75) return 5;   // low risk
  if (salvageRiskScore >= 50) return 10;  // moderate risk
  if (salvageRiskScore >= 25) return 20;  // high risk
  return 30;                              // very high risk
}

// ── Market closing estimate ───────────────────────────────────────────────────

/**
 * Deterministic estimate of where competitive bidders will close.
 * Salvage vehicles historically close at ~32–45% of clean ARV (median ~38%).
 * This gives users the "OFFO vs Market" signal without needing historical data.
 */
export function computeMarketClosingEstimate(arv: number): MarketClosingRange {
  return {
    low:      Math.round(arv * 0.32 / 100) * 100,
    high:     Math.round(arv * 0.45 / 100) * 100,
    midpoint: Math.round(arv * 0.38 / 100) * 100,
    note: "Based on salvage auction market patterns (32–45% of clean ARV); varies by demand and damage type.",
  };
}

// ── Max safe bid calculator ───────────────────────────────────────────────────

export function computeMaxSafeBid(
  arv: number,
  repairCostMidpoint: number,
  auctionFees: number,
  targetMarginPct: number
): number {
  const marginDollars = arv * (targetMarginPct / 100);
  return Math.max(0, arv - repairCostMidpoint - auctionFees - marginDollars);
}

/**
 * Compute expected profit for repair and parts strategies.
 * No margin baked in — this is raw profit/loss at the given bid price.
 */
export function computeExpectedProfits(
  arv: number | null,
  partsValue: number,
  bidPrice: number | null,
  repairCostMidpoint: number,
  auctionFees: number
): { repair: number | null; parts: number | null } {
  const parts =
    bidPrice !== null
      ? partsValue - bidPrice - auctionFees
      : null;
  const repair =
    arv !== null && bidPrice !== null
      ? arv - bidPrice - repairCostMidpoint - auctionFees
      : null;
  return { repair, parts };
}

/**
 * Safe bid range at a given margin, using repair cost low/high to express
 * uncertainty — users see a range instead of a falsely precise single number.
 *
 * high end = optimistic (uses repair_cost_low)
 * low end  = conservative (uses repair_cost_high)
 */
export function computeSafeBidRange(
  arv: number,
  repairCostLow: number,
  repairCostHigh: number,
  auctionFees: number,
  targetMarginPct: number
): { low: number; high: number } {
  const marginDollars = arv * (targetMarginPct / 100);
  return {
    low:  Math.max(0, arv - repairCostHigh - auctionFees - marginDollars),
    high: Math.max(0, arv - repairCostLow  - auctionFees - marginDollars),
  };
}

/**
 * Best / worst / likely profit scenarios for repair strategy at a given bid price.
 * Assumes ARV is fixed; uncertainty comes from repair cost range.
 */
export function computeProfitScenarios(
  arv: number,
  bidPrice: number,
  repairCostLow: number,
  repairCostMidpoint: number,
  repairCostHigh: number,
  auctionFees: number
): { best: number; worst: number; likely: number } {
  return {
    best:   arv - bidPrice - repairCostLow      - auctionFees,
    likely: arv - bidPrice - repairCostMidpoint - auctionFees,
    worst:  arv - bidPrice - repairCostHigh     - auctionFees,
  };
}

// Re-export fee calculator for consumers that import from this module
export { computeCopartFees };
