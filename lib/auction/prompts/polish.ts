/**
 * Auction Final Polish Step — Prompts & Schema
 *
 * Step 3 of the AI chain: Grok synthesizes all prior outputs into a final
 * buyer verdict with headline, summary, top risks, and recommended action.
 * Skipped if total model calls already reached 3.
 */

import type { NormalizedAuctionLot, IncentiveStatus } from "../types";
import type { DeterministicMetrics } from "../deterministic-metrics";
import type {
  ClassificationOutput,
  RoutineImpactOutput,
  RepairCostAiOutput,
} from "../auction-ai-chain";

// ── System prompt ─────────────────────────────────────────────────────────────

export const POLISH_SYSTEM_PROMPT =
  "You are an auction vehicle analyst writing final buyer verdicts. " +
  "Be direct and specific. Buyers use this to decide bid amounts. " +
  "Return structured JSON only.";

// ── JSON schema ───────────────────────────────────────────────────────────────

export const POLISH_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "top_risks", "recommended_action"],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    top_risks: { type: "array", items: { type: "string" } },
    recommended_action: { type: "string", enum: ["bid", "inspect_first", "avoid"] },
  },
};

export const POLISH_SCHEMA_NAME = "polish_output";

// ── User prompt builder ───────────────────────────────────────────────────────

function vehicleLabel(lot: NormalizedAuctionLot): string {
  return [lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ") || "Unknown vehicle";
}

export function buildPolishPrompt(
  lot: NormalizedAuctionLot,
  metrics: DeterministicMetrics,
  classification: ClassificationOutput | null,
  routineImpact: RoutineImpactOutput | null,
  repairCost: RepairCostAiOutput | null,
  arv: number | null,
  incentiveStatus?: IncentiveStatus | null
): string {
  const arvStr = arv ? `$${arv.toLocaleString()}` : "unavailable";
  const maxBidHint =
    arv && repairCost
      ? `~$${Math.max(0, arv - repairCost.repair_cost_midpoint - 1000).toLocaleString()}`
      : "unknown";

  const incentiveLine = incentiveStatus?.salvage_title_disqualifies
    ? `TAX CREDIT: Salvage title — NOT eligible for federal EV tax credit (§30D). Original buyer may have claimed $${incentiveStatus.federal_new_amount.toLocaleString()} new vehicle credit.`
    : "";

  const titleStatus = (lot.title_status ?? "").toLowerCase();
  const insuranceFrictionLine =
    titleStatus === "salvage" || titleStatus === "rebuilt"
      ? `INSURANCE/RESALE NOTE: ${titleStatus === "salvage" ? "Salvage" : "Rebuilt"} title — many standard insurers decline or require inspection. Resale market is significantly narrower (dealers often won't take trade-ins). Factor this into exit strategy.`
      : "";

  return `VEHICLE: ${vehicleLabel(lot)}
RISK LEVEL: ${classification?.bid_risk_level ?? "unknown"}
DAMAGE: ${classification?.damage_tone ?? lot.damage_type ?? "unspecified"}
SALVAGE SCORE: ${metrics.salvage_risk_score}/100
ARV: ${arvStr}
MAX SAFE BID HINT: ${maxBidHint}
OWNER SUMMARY: ${routineImpact?.owner_summary ?? "not available"}
REPAIR CONFIDENCE: ${repairCost?.confidence ?? "unknown"}
TOP RED FLAGS: ${(classification?.red_flags ?? []).slice(0, 3).join("; ") || "none"}${incentiveLine ? `\n${incentiveLine}` : ""}${insuranceFrictionLine ? `\n${insuranceFrictionLine}` : ""}

Write the final buyer verdict. The headline must include the vehicle name and either a bid range or a clear "avoid" signal. Be direct — buyers use this to decide whether to bid.`;
}
