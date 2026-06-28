/**
 * Shared AI scoring pipeline for curated_deals.
 *
 * Used by:
 *   - /api/admin/deals-import-urls  (per-URL import)
 *   - netlify/functions/rescore-all-deals  (bulk rescore)
 *
 * Mirrors the /api/receipt → upgrade-receipt-background pipeline so that
 * curated_deals verdicts and risk_flags match what a user sees on a full receipt.
 */

import { hedgedGenerate } from "@/lib/providers";
import { SYSTEM_PROMPT, buildUserPrompt, RECEIPT_JSON_SCHEMA } from "@/lib/receipt-openai";
import { validateReceiptSchema } from "@/lib/receipt-schema-validator";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScrapedListing {
  vin?: string;
  title_status?: "clean" | "salvage" | "rebuilt" | "unknown";
  accidents_reported?: "yes" | "no" | "unknown";
  mileage?: number;
  price?: number;
  battery_kwh?: number;
  dc_fast_kw?: number;
  range_mi?: number;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  location?: string;
  raw_text?: string;
}

export interface AiScoringResult {
  signals: string[];
  riskFlags: string[];
  verdictReason?: string;
  source: "ai" | "deterministic";
}

// ── Deterministic fallback ────────────────────────────────────────────────────
// Used only when AI call fails. Battery/service record absence is neutral —
// only inject penalty signals when explicitly set to "no".

export function inferSignalsFromListing(data: ScrapedListing): string[] {
  const signals: string[] = [];
  if (data.vin) { signals.push("vin_decoded"); } else { signals.push("vin_missing"); }
  if (data.title_status === "clean") { signals.push("clean_title_explicit"); }
  else if (data.title_status === "salvage" || data.title_status === "rebuilt") { signals.push("title_salvage"); }
  else { signals.push("title_status_unclear"); }
  if (data.accidents_reported === "yes") { signals.push("prior_damage_minor"); }
  // battery_proof_missing only when battery report is explicitly absent (not just unknown)
  if ((data as Record<string, unknown>).battery_report === "no") { signals.push("battery_proof_missing"); }
  // service_records_missing only when service records are explicitly absent
  if ((data as Record<string, unknown>).service_records === "no") { signals.push("service_records_missing"); }
  if (data.dc_fast_kw && data.dc_fast_kw > 0) { signals.push("dcfc_confirmed"); }
  if (data.mileage && data.mileage > 80000) { signals.push("ownership_turnover_high"); }
  return signals;
}

// ── AI scoring ────────────────────────────────────────────────────────────────
// Same pipeline as receipt-upgrade.ts:
//   hedgedGenerate (Claude/Gemini/Grok) → validateReceiptSchema → listing_signals + risk_flags
//
// Pass url=undefined when scoring from DB-stored fields only (no re-scrape needed).

export async function scoreWithAi(
  url: string | undefined,
  d: ScrapedListing
): Promise<AiScoringResult> {
  const input = {
    listing_url: url,
    listing_text: d.raw_text,
    year: d.year,
    make: d.make,
    model: d.model,
    trim: d.trim,
    mileage: d.mileage,
    price: d.price,
    vin: d.vin,
    location: d.location,
    title_status: d.title_status !== "unknown" ? d.title_status : undefined,
    accidents_reported: d.accidents_reported !== "unknown" ? d.accidents_reported : undefined,
  };

  try {
    const hedgeResult = await hedgedGenerate({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: await buildUserPrompt(input as Parameters<typeof buildUserPrompt>[0]),
      jsonSchema: RECEIPT_JSON_SCHEMA as Record<string, unknown>,
      schemaName: "receipt",
      temperature: 0.3,
      maxTokens: 1800,
      timeoutMs: 45_000,
      // Always try all providers regardless of circuit breaker state built up across batch
      providerOrder: ["openai", "grok", "anthropic"],
      validate: (json) => {
        const v = validateReceiptSchema(json);
        return { valid: v.valid, errors: v.errors };
      },
    });

    const validation = validateReceiptSchema(hedgeResult.result.json);
    const receipt = validation.sanitized || hedgeResult.result.json;
    if (!receipt) throw new Error("AI returned invalid receipt");

    const r = receipt as Record<string, unknown>;
    const signals = Array.isArray(r.listing_signals) ? (r.listing_signals as string[]) : [];
    const riskFlags = Array.isArray(r.risk_flags) ? (r.risk_flags as string[]).slice(0, 3) : [];
    const verdictReason = typeof r.verdict_reason === "string" ? r.verdict_reason : undefined;

    return { signals, riskFlags, verdictReason, source: "ai" };
  } catch (err) {
    console.warn(
      "[deals-score] AI failed, falling back to deterministic:",
      err instanceof Error ? err.message : err
    );
    return { signals: inferSignalsFromListing(d), riskFlags: [], source: "deterministic" };
  }
}
