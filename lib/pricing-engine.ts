/**
 * Shared pricing engine utilities.
 * Used by:
 *  - GET  /api/dealer/pricing/[vehicleId]
 *  - POST /api/internal/pricing/refresh/[vehicleId]
 */

import { openaiAdapter } from "@/lib/providers/openai-adapter";

export interface PricingExplanation {
  headline: string;
  why: string;
  action: string;
  caveats: string[];
}

export interface PricingInsight {
  vehicle_id: string;
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  asking_price_usd: number | null;
  suggested_price_low_usd: number | null;
  suggested_price_target_usd: number | null;
  suggested_price_high_usd: number | null;
  market_position: "below" | "at" | "above" | null;
  market_avg_price_usd: number | null;
  price_percentile: number | null;
  comp_count: number;
  buyer_count: number;
  confidence: number | null;
  explanation: PricingExplanation | null;
  price_sensitivity: { buckets: Array<{ price: number; estimated_buyers: number }> } | null;
  refreshed_at: string | null;
  refreshing: boolean;
  cached: boolean;
}

export const PRICING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Stage 1: Deterministic
// ---------------------------------------------------------------------------

export function computePriceRange(
  askingPrice: number,
  marketAvg: number | null,
  compCount: number,
): {
  low: number;
  target: number;
  high: number;
  percentile: number;
  position: "below" | "at" | "above";
  insufficientData: boolean;
} {
  // QA: flag insufficient data when comp_count < 2
  const insufficientData = compCount < 2;

  const avg = marketAvg ?? askingPrice;
  const delta = askingPrice - avg;
  const pctDiff = avg > 0 ? delta / avg : 0;

  const position: "below" | "at" | "above" =
    pctDiff < -0.05 ? "below" : pctDiff > 0.05 ? "above" : "at";

  const band = compCount >= 5 ? 0.04 : compCount >= 2 ? 0.06 : 0.08;
  const low = Math.round(avg * (1 - band));
  const target = Math.round(avg);
  const high = Math.round(avg * (1 + band / 2));

  const rawPct = 50 + (pctDiff / 0.15) * -25;
  const percentile = Math.min(99, Math.max(1, Math.round(rawPct)));

  return { low, target, high, percentile, position, insufficientData };
}

export function buildPriceSensitivityCurve(
  askingPrice: number,
  buyerCount: number,
): { buckets: Array<{ price: number; estimated_buyers: number }> } {
  const buckets = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const priceMult = 1.1 - i * 0.04;
    const price = Math.round((askingPrice * priceMult) / 100) * 100;
    const demandMult = 1 + (steps - i) * 0.15;
    const estimatedBuyers = Math.max(1, Math.round(buyerCount * demandMult));
    buckets.push({ price, estimated_buyers: estimatedBuyers });
  }
  return { buckets };
}

// ---------------------------------------------------------------------------
// Stage 2: LLM summarization
// ---------------------------------------------------------------------------

const PRICING_SYSTEM_PROMPT = `You are a concise EV market pricing advisor for car dealerships.
Given vehicle details and market data, produce a brief pricing recommendation.
Be direct and actionable. Do not repeat the numbers back — interpret them.
Respond ONLY with valid JSON.`;

const PRICING_SCHEMA = {
  type: "object",
  required: ["headline", "why", "action", "caveats"],
  properties: {
    headline: { type: "string", maxLength: 80 },
    why: { type: "string", maxLength: 200 },
    action: { type: "string", maxLength: 120 },
    caveats: { type: "array", items: { type: "string", maxLength: 80 }, maxItems: 3 },
  },
};

export async function runPricingStage2(
  vehicle: { make: string; model: string; year?: number | null; trim?: string | null },
  askingPrice: number,
  stage1: ReturnType<typeof computePriceRange>,
  buyerCount: number,
  compCount: number,
): Promise<{ explanation: PricingExplanation | null; model_used: string; latency_ms: number }> {
  if (!openaiAdapter.isConfigured()) {
    return { explanation: null, model_used: "none", latency_ms: 0 };
  }

  const vehicleDesc = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ");

  // QA: sanity-bound check — warn if suggested deviates >40% from asking
  const deviationPct =
    askingPrice > 0 ? Math.abs(stage1.target - askingPrice) / askingPrice : 0;
  const deviationWarning =
    deviationPct > 0.4
      ? `Note: suggested price deviates ${Math.round(deviationPct * 100)}% from asking — limited comp data.`
      : null;

  const userPrompt = [
    `Vehicle: ${vehicleDesc}`,
    `Asking price: $${askingPrice.toLocaleString()}`,
    `Market average: $${stage1.target.toLocaleString()} (${compCount} comps)`,
    `Price position: ${stage1.position} market (${stage1.percentile}th percentile)`,
    `Suggested range: $${stage1.low.toLocaleString()} – $${stage1.high.toLocaleString()}`,
    `Interested buyers in region: ${buyerCount}`,
    deviationWarning,
  ]
    .filter(Boolean)
    .join("\n");

  const startMs = Date.now();
  try {
    const result = await openaiAdapter.generate({
      systemPrompt: PRICING_SYSTEM_PROMPT,
      userPrompt,
      jsonSchema: PRICING_SCHEMA,
      schemaName: "pricing_explanation",
      temperature: 0.3,
      maxTokens: 400,
      timeoutMs: 12000,
    });

    const j = result.json as Record<string, unknown>;
    const caveats: string[] = Array.isArray(j.caveats) ? (j.caveats as string[]) : [];

    // QA: append sanity warning to caveats if present
    if (deviationWarning && !caveats.some((c) => c.includes("deviates"))) {
      caveats.push("Limited comp data — treat suggested range as directional only.");
    }

    return {
      explanation: {
        headline: String(j.headline ?? ""),
        why: String(j.why ?? ""),
        action: String(j.action ?? ""),
        caveats: caveats.slice(0, 3),
      },
      model_used: result.provider,
      latency_ms: Date.now() - startMs,
    };
  } catch (err) {
    console.error("[pricing-engine] Stage 2 error:", err);
    return { explanation: null, model_used: "error", latency_ms: Date.now() - startMs };
  }
}

/** Compute confidence score (0–100). Returns null if insufficient comp data (QA). */
export function computeConfidence(
  compCount: number,
  buyerCount: number,
  hasExplanation: boolean,
): number | null {
  if (compCount < 2) return null; // QA: no confidence shown without sufficient data
  const base = 40;
  const compBonus = Math.min(compCount * 8, 40);
  const buyerBonus = Math.min(buyerCount * 2, 10);
  const llmBonus = hasExplanation ? 0 : -5;
  return Math.min(90, base + compBonus + buyerBonus + llmBonus);
}
