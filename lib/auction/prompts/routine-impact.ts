/**
 * Auction Routine Impact Step — Prompts & Schema
 *
 * Step 2a of the AI chain: Gemini translates salvage risk into buyer-facing
 * EV ownership impact language. Runs in parallel with the repair cost step.
 */

import type { NormalizedAuctionLot, NhtsaRecallSummary } from "../types";
import type { ClassificationOutput } from "../auction-ai-chain";

// ── System prompt ─────────────────────────────────────────────────────────────

export const ROUTINE_IMPACT_SYSTEM_PROMPT =
  "You are an EV ownership advisor. Translate salvage vehicle risk into plain buyer language. " +
  "Return structured JSON only.";

// ── JSON schema ───────────────────────────────────────────────────────────────

export const ROUTINE_IMPACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["owner_summary", "routine_impact", "charging_risk", "battery_concern"],
  properties: {
    owner_summary: { type: "string" },
    routine_impact: { type: "string" },
    charging_risk: { type: ["string", "null"] },
    battery_concern: { type: ["string", "null"] },
  },
};

export const ROUTINE_IMPACT_SCHEMA_NAME = "routine_impact_output";

// ── User prompt builder ───────────────────────────────────────────────────────

function vehicleLabel(lot: NormalizedAuctionLot): string {
  return [lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ") || "Unknown vehicle";
}

export function buildRoutineImpactPrompt(
  lot: NormalizedAuctionLot,
  classification: ClassificationOutput | null,
  recalls: NhtsaRecallSummary[],
  routineContext: Record<string, unknown> | null
): string {
  const recallSummary =
    recalls.length > 0
      ? recalls
          .slice(0, 3)
          .map((r) => r.Component)
          .join(", ")
      : "none";

  return `VEHICLE: ${vehicleLabel(lot)}
DAMAGE TONE: ${classification?.damage_tone ?? lot.damage_type ?? "unspecified"}
RISK LEVEL: ${classification?.bid_risk_level ?? "unknown"}
RECALLS: ${recallSummary}
ROUTINE CONTEXT: ${routineContext ? JSON.stringify(routineContext) : "not provided"}

Write buyer-facing explanations of how this salvage vehicle's damage and title status would affect:
1. Day-to-day EV ownership (charging reliability, range, shop availability)
2. Any specific charging or HV battery concerns from the damage description

Keep language plain and direct. Max 3 sentences per field. Do not speculate beyond the damage description.`;
}
