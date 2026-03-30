/**
 * Auction Classification Step — Prompts & Schema
 *
 * Step 1 of the AI chain: Grok classifies damage tone, severity, and risk level.
 * This is always run — it is the cheapest step and gates the rest of the chain.
 */

import type { NormalizedAuctionLot } from "../types";
import type { DeterministicMetrics } from "../deterministic-metrics";

// ── System prompt ─────────────────────────────────────────────────────────────

export const CLASSIFICATION_SYSTEM_PROMPT =
  "You are an expert salvage vehicle risk classifier. Return structured JSON only. " +
  "Be concise and factual. Do not invent issues not present in the data. " +
  "If auction photos are provided, use them as primary evidence for damage assessment — " +
  "photos override ambiguous text descriptions.";

// ── JSON schema ───────────────────────────────────────────────────────────────

export const CLASSIFICATION_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["damage_severity", "damage_tone", "bid_risk_level", "red_flags", "title_risk_summary"],
  properties: {
    damage_severity: { type: "string", enum: ["minor", "moderate", "severe", "total_loss"] },
    damage_tone: { type: "string" },
    bid_risk_level: { type: "string", enum: ["low", "medium", "high", "extreme"] },
    red_flags: { type: "array", items: { type: "string" } },
    title_risk_summary: { type: "string" },
  },
};

export const CLASSIFICATION_SCHEMA_NAME = "classification_output";

// ── User prompt builder ───────────────────────────────────────────────────────

function vehicleLabel(lot: NormalizedAuctionLot): string {
  return [lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ") || "Unknown vehicle";
}

export function buildClassifyPrompt(
  lot: NormalizedAuctionLot,
  metrics: DeterministicMetrics
): string {
  return `VEHICLE: ${vehicleLabel(lot)}
SOURCE: ${lot.auction_source.toUpperCase()} Lot ${lot.lot_number}
TITLE: ${lot.title_status ?? "unknown"}
PRIMARY DAMAGE: ${lot.primary_damage ?? "unknown"}
SECONDARY DAMAGE: ${lot.secondary_damage ?? "none"}
LOSS TYPE: ${lot.loss_type ?? "unknown"}
CONDITION NOTES: ${lot.condition_notes?.slice(0, 600) ?? "none"}
CURRENT BID: ${lot.current_bid ? `$${lot.current_bid.toLocaleString()}` : "unknown"}
ODOMETER: ${lot.odometer ? `${lot.odometer.toLocaleString()} mi` : "unknown"}

DETERMINISTIC RISK SCORE: ${metrics.salvage_risk_score}/100 (higher = safer)
TITLE RISK FACTOR: ${metrics.title_risk_factor}
DAMAGE SEVERITY BASELINE: ${metrics.damage_severity_baseline}

Classify this auction lot. Be concise. Identify actual red flags from the damage description — do not fabricate issues not in the data.`;
}
