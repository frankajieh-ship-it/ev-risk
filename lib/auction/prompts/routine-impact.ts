/**
 * Auction Routine Impact Step — Prompts & Schema
 *
 * Step 2a of the AI chain: Gemini translates salvage risk into buyer-facing
 * EV ownership impact language. Runs in parallel with the repair cost step.
 */

import type {
  NormalizedAuctionLot,
  NhtsaRecallSummary,
  ChargingProfileSummary,
  RangeProjection,
  ElectricityContext,
} from "../types";
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
  routineContext: Record<string, unknown> | null,
  chargingProfile?: ChargingProfileSummary | null,
  rangeProjection?: RangeProjection | null,
  electricityContext?: ElectricityContext | null
): string {
  const recallSummary =
    recalls.length > 0
      ? recalls.slice(0, 3).map((r) => r.Component).join(", ")
      : "none";

  // Build optional data_v2 context block
  const dataBlocks: string[] = [];

  if (chargingProfile) {
    const coldKw = chargingProfile.peak_dc_kw
      ? Math.round(chargingProfile.peak_dc_kw * (1 - chargingProfile.cold_derate_percent / 100))
      : null;
    dataBlocks.push(
      `CHARGING SPEC (${chargingProfile.source_model}): ` +
      `Peak DC ${chargingProfile.peak_dc_kw ?? "unknown"} kW, ` +
      `10–80% in ${chargingProfile.time_10_to_80_min ?? "unknown"} min, ` +
      `curve: ${chargingProfile.curve_shape}. ` +
      `At 32°F peak drops ~${chargingProfile.cold_derate_percent}% (to ~${coldKw ?? "unknown"} kW).`
    );
  }

  if (rangeProjection) {
    dataBlocks.push(
      `RANGE DATA: EPA ${rangeProjection.epa_range_mi ?? "unknown"} mi, ` +
      `real-world ~${rangeProjection.real_world_range_mi ?? "unknown"} mi, ` +
      `at 32°F ~${rangeProjection.cold_range_mi ?? "unknown"} mi, ` +
      `at 0°F ~${rangeProjection.extreme_cold_range_mi ?? "unknown"} mi.` +
      (rangeProjection.climate_note ? ` ${rangeProjection.climate_note}.` : "")
    );
  }

  if (electricityContext) {
    dataBlocks.push(
      `ELECTRICITY: ${electricityContext.state} residential rate ${electricityContext.residential_kwh_cents}¢/kWh. ` +
      (electricityContext.ev_tou_kwh_cents
        ? `EV off-peak TOU available at ~${electricityContext.ev_tou_kwh_cents}¢/kWh. `
        : "") +
      (electricityContext.monthly_cost_estimate_usd
        ? `Est. monthly charging cost ~$${electricityContext.monthly_cost_estimate_usd} (12k mi/yr).`
        : "")
    );
  }

  const dataSection = dataBlocks.length > 0
    ? `\n${dataBlocks.join("\n")}\n`
    : "";

  return `VEHICLE: ${vehicleLabel(lot)}
DAMAGE TONE: ${classification?.damage_tone ?? lot.damage_type ?? "unspecified"}
RISK LEVEL: ${classification?.bid_risk_level ?? "unknown"}
RECALLS: ${recallSummary}
ROUTINE CONTEXT: ${routineContext ? JSON.stringify(routineContext) : "not provided"}${dataSection}

Write buyer-facing explanations of how this salvage vehicle's damage and title status would affect:
1. Day-to-day EV ownership (charging reliability, range, shop availability)
2. Any specific charging or HV battery concerns from the damage description

${dataBlocks.length > 0 ? "Use the measured charging/range data above to make your answer specific and accurate. " : ""}Keep language plain and direct. Max 3 sentences per field. Do not speculate beyond the damage description.`;
}
