/**
 * Copart Arbitrage Engine
 *
 * Types, JSON schema, and prompt builder for the repair cost OpenAI call.
 * Used by /api/copart/arbitrage/route.ts
 */

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

export interface ArbitrageResult {
  /** After-Repair Value midpoint (null if unavailable) */
  arv: number | null;
  arv_range: { low: number; high: number } | null;
  arv_source: "auto_dev_listings" | "vin_msrp" | "none";
  arv_listing_count: number;
  repair_cost_estimate: number;
  repair_cost_low: number;
  repair_cost_high: number;
  repair_cost_breakdown: RepairLineItem[];
  parts_value: number;
  parts_value_breakdown: RepairLineItem[];
  /** Max safe bid at default 20% target margin */
  max_safe_bid: number | null;
  /** Fixed estimate: buyer fee + title + transport */
  auction_fees_estimate: number;
  confidence: "high" | "medium" | "low";
  caveats: string[];
  damage_type_inferred: string;
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
 * Fixed auction fee estimate.
 * Covers: Copart buyer fee (~$400–$700) + title transfer ($50–$100) + transport to shop ($200–$400).
 * A future enhancement could make this dynamic based on hammer price tier.
 */
export const AUCTION_FEES_ESTIMATE = 1000;

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
