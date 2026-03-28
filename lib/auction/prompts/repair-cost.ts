/**
 * Auction Repair Cost Step — Prompts & Schema
 *
 * Step 2b of the AI chain: GPT-4o estimates repair cost and parts value.
 * Runs in parallel with the routine impact step.
 *
 * Two system prompt variants:
 * - COPART_IAAI: Salvage auction context. ARV is retail market value.
 * - MANHEIM: Wholesale/dealer auction context. Reference MMR wholesale value.
 */

import type { NormalizedAuctionLot } from "../types";
import type { ClassificationOutput } from "../auction-ai-chain";

// ── System prompts ─────────────────────────────────────────────────────────────

export const REPAIR_COST_SYSTEM_PROMPT_COPART_IAAI =
  "You are an expert automotive repair cost estimator specializing in salvage auction EVs. " +
  "Rules:\n" +
  "- Independent shop rates ($90–$150/hr), NOT dealer rates\n" +
  "- Mix OEM + quality aftermarket parts\n" +
  "- EV: HV battery replacement $8,000–$25,000+ — flag if damage suggests battery involvement\n" +
  "- Confidence 'low' if: flood, fire, HV battery suspected, rollover, vague damage\n" +
  "- Parts value: only components with resale demand; exclude destroyed parts; exclude airbag modules\n" +
  "Return ONLY valid JSON. No markdown. No text outside the JSON object.";

export const REPAIR_COST_SYSTEM_PROMPT_MANHEIM =
  "You are an expert automotive repair cost estimator specializing in wholesale dealer auction vehicles. " +
  "MARKET CONTEXT: Wholesale/dealer auction. Reference MMR wholesale value, not retail ARV. " +
  "Rules:\n" +
  "- Independent shop rates ($90–$150/hr), NOT dealer rates\n" +
  "- Mix OEM + quality aftermarket parts\n" +
  "- EV: HV battery replacement $8,000–$25,000+ — flag if damage suggests battery involvement\n" +
  "- Confidence 'low' if: flood, fire, HV battery suspected, rollover, vague damage\n" +
  "- Parts value: only components with resale demand; exclude destroyed parts; exclude airbag modules\n" +
  "- Margins are tighter in wholesale — cost estimates should reflect dealer reconditioning budgets\n" +
  "Return ONLY valid JSON. No markdown. No text outside the JSON object.";

// ── JSON schema ───────────────────────────────────────────────────────────────

const lineItemSchema = {
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

export const REPAIR_COST_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "repair_cost_low",
    "repair_cost_high",
    "repair_cost_midpoint",
    "breakdown",
    "parts_value_total",
    "parts_value_breakdown",
    "confidence",
    "confidence_reason",
    "caveats",
  ],
  properties: {
    repair_cost_low: { type: "number" },
    repair_cost_high: { type: "number" },
    repair_cost_midpoint: { type: "number" },
    breakdown: { type: "array", items: lineItemSchema },
    parts_value_total: { type: "number" },
    parts_value_breakdown: { type: "array", items: lineItemSchema },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    confidence_reason: { type: "string" },
    caveats: { type: "array", items: { type: "string" } },
  },
};

export const REPAIR_COST_SCHEMA_NAME = "repair_cost_output";

// ── User prompt builders ──────────────────────────────────────────────────────

function vehicleLabel(lot: NormalizedAuctionLot): string {
  return [lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ") || "Unknown vehicle";
}

export function buildRepairCostPrompt(
  lot: NormalizedAuctionLot,
  classification: ClassificationOutput | null
): string {
  const vehicle = vehicleLabel(lot);
  const damageType = classification?.damage_tone ?? lot.damage_type ?? "unspecified damage";
  const price = lot.current_bid ? `$${lot.current_bid.toLocaleString()}` : "unknown";
  const text = lot.condition_notes?.slice(0, 1200) ?? "No details provided";

  return `VEHICLE: ${vehicle}
DAMAGE: ${damageType}
CURRENT BID: ${price}
CONDITION: ${text}

Estimate repair cost to bring this vehicle to retail-ready condition.
Rules:
- Independent shop rates ($90–$150/hr), NOT dealer rates
- Mix OEM + quality aftermarket parts
- EV: HV battery replacement $8,000–$25,000+ — flag if damage suggests battery involvement
- Confidence "low" if: flood, fire, HV battery suspected, rollover, vague damage
- Parts value: only components with resale demand; exclude destroyed parts; exclude airbag modules
Return ONLY valid JSON. No explanation outside the JSON object.`;
}

export function buildRepairCostPromptManheim(
  lot: NormalizedAuctionLot,
  classification: ClassificationOutput | null
): string {
  const base = buildRepairCostPrompt(lot, classification);
  return `MARKET CONTEXT: Wholesale/dealer auction. Reference MMR wholesale value, not retail ARV. Reconditioning budgets are tighter than retail — bias estimates toward dealer-grade repair, not showroom-ready.\n\n${base}`;
}
