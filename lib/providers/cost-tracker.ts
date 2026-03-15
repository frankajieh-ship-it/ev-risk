/**
 * Provider Cost Tracker
 *
 * Estimates token costs per provider and logs to user_events.
 * All rates in USD per token (as of 2025).
 */

import type { GenerateResult, ProviderName } from "./types";

interface CostRate {
  input: number;   // $ per token
  output: number;  // $ per token
}

const COST_RATES: Record<ProviderName, CostRate> = {
  openai: { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },  // gpt-4o-mini
  gemini: { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 }, // gemini-2.0-flash
  grok:   { input: 0.30 / 1_000_000, output: 0.50 / 1_000_000 },  // grok-3-mini
};

export function estimateCost(result: GenerateResult): number {
  const rates = COST_RATES[result.provider];
  return rates.input * result.inputTokens + rates.output * result.outputTokens;
}

export function logReceiptCost(
  supabase: { from: (table: string) => { insert: (data: unknown) => { then: (fn: () => void, fn2: () => void) => void } } },
  receiptId: string,
  receiptToken: string,
  results: GenerateResult[]
): void {
  const totalCost = results.reduce((sum, r) => sum + estimateCost(r), 0);
  const totalInputTokens = results.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalOutputTokens = results.reduce((sum, r) => sum + r.outputTokens, 0);

  supabase.from("user_events").insert({
    event_name: "receipt_cost_estimate",
    event_data: {
      receipt_id: receiptId,
      receipt_token: receiptToken,
      total_cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000, // 6 decimal places
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      providers_used: results.map((r) => r.provider),
      breakdown: results.map((r) => ({
        provider: r.provider,
        cost_usd: Math.round(estimateCost(r) * 1_000_000) / 1_000_000,
        input_tokens: r.inputTokens,
        output_tokens: r.outputTokens,
        latency_ms: r.latencyMs,
      })),
    },
    page_path: "/.netlify/functions/upgrade-receipt-background",
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {});
}
