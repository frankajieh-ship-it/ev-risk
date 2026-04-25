/**
 * Hedged Generation Orchestrator
 *
 * Starts the primary provider immediately, hedges with secondary/tertiary
 * providers after configurable delays if no valid response has arrived.
 * The first response that passes validation wins; others are cancelled.
 *
 * Default hedge schedule:
 *   T+0s    → OpenAI starts
 *   T+8s    → Gemini starts (if OpenAI hasn't returned valid)
 *   T+14s   → Grok starts (if neither has returned valid)
 *
 * For on-demand sections (user-initiated):
 *   T+0s    → OpenAI starts
 *   T+10s   → Gemini starts
 *   T+18s   → Grok starts
 */

import { openaiAdapter } from "./openai-adapter";
import { geminiAdapter } from "./gemini-adapter";
import { grokAdapter } from "./grok-adapter";
import { getProviderOrder, recordSuccess, recordFailure } from "./circuit-breaker";
import type {
  ProviderAdapter,
  GenerateOpts,
  GenerateResult,
  HedgeResult,
  ValidationResult,
} from "./types";
import { AllProvidersFailedError } from "./types";

const ALL_ADAPTERS: Record<string, ProviderAdapter> = {
  openai: openaiAdapter,
  gemini: geminiAdapter,
  grok: grokAdapter,
};

export interface HedgeOpts {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  schemaName: string;
  temperature?: number;
  maxTokens?: number;
  validate: (json: unknown) => ValidationResult;
  /** [secondaryDelayMs, tertiaryDelayMs] — defaults to [8000, 14000] */
  hedgeDelays?: [number, number];
  /** Override provider order (e.g. for testing) */
  providerOrder?: string[];
  /** Event callback for analytics (fire-and-forget) */
  onEvent?: (event: HedgeEvent) => void;
  /** Optional image URLs for vision analysis (max 3). Passed to all providers. */
  imageUrls?: string[];
}

export interface HedgeEvent {
  type: "started" | "hedge_triggered" | "succeeded" | "failed" | "validator_rejected";
  provider?: string;
  hedgeLevel?: number;
  latencyMs?: number;
  errorMessage?: string;
}

export async function hedgedGenerate(opts: HedgeOpts): Promise<HedgeResult> {
  const {
    temperature = 0.3,
    maxTokens = 1800,
    hedgeDelays = [5000, 9000],
    onEvent,
  } = opts;

  // Get provider order adjusted for circuit breaker health
  const rawOrder = opts.providerOrder ?? getProviderOrder();
  const orderedProviders = rawOrder
    .map((name) => ALL_ADAPTERS[name])
    .filter((a): a is ProviderAdapter => Boolean(a) && a.isConfigured());

  if (orderedProviders.length === 0) {
    throw new AllProvidersFailedError(0, "No AI providers are configured");
  }

  const baseOpts: Omit<GenerateOpts, "signal"> = {
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    jsonSchema: opts.jsonSchema,
    schemaName: opts.schemaName,
    temperature,
    maxTokens,
    timeoutMs: 18_000,
    imageUrls: opts.imageUrls,
  };

  // Track abort controllers so we can cancel losers
  const abortControllers: AbortController[] = [];
  let totalAttempts = 0;
  let settled = false;

  return new Promise<HedgeResult>((resolve, reject) => {
    const errors: Error[] = [];

    function launchProvider(providerIndex: number): void {
      if (settled || providerIndex >= orderedProviders.length) return;

      const provider = orderedProviders[providerIndex];
      const ac = new AbortController();
      abortControllers.push(ac);
      totalAttempts++;

      const hedgeLevel = providerIndex as 0 | 1 | 2;

      if (providerIndex > 0) {
        onEvent?.({ type: "hedge_triggered", provider: provider.name, hedgeLevel });
        console.log(`[hedged] Hedge triggered: starting ${provider.name} (level ${hedgeLevel})`);
      } else {
        onEvent?.({ type: "started", provider: provider.name, hedgeLevel: 0 });
        console.log(`[hedged] Starting primary: ${provider.name}`);
      }

      provider.generate({ ...baseOpts, signal: ac.signal })
        .then((result: GenerateResult) => {
          if (settled) return;

          // Validate the result
          const validation = opts.validate(result.json);
          if (!validation.valid) {
            onEvent?.({
              type: "validator_rejected",
              provider: provider.name,
              errorMessage: validation.errors[0],
            });
            console.log(
              `[hedged] ${provider.name} response failed validation: ${validation.errors[0]}`
            );
            recordFailure(provider.name);
            errors.push(new Error(`${provider.name} validation failed: ${validation.errors[0]}`));

            // If this was the last provider, reject
            if (errors.length + (orderedProviders.length - totalAttempts) >= orderedProviders.length) {
              checkAllDone();
            }
            return;
          }

          // Win — cancel others and resolve
          settled = true;
          for (const ac2 of abortControllers) ac2.abort();

          recordSuccess(provider.name);
          onEvent?.({
            type: "succeeded",
            provider: provider.name,
            hedgeLevel,
            latencyMs: result.latencyMs,
          });
          console.log(
            `[hedged] ${provider.name} won (level=${hedgeLevel}, latency=${result.latencyMs}ms)`
          );

          resolve({
            result,
            hedgeLevel,
            allAttempts: totalAttempts,
          });
        })
        .catch((err: unknown) => {
          if (settled) return;
          const error = err instanceof Error ? err : new Error(String(err));
          // AbortError is expected when another provider won — don't record as failure
          if (error.name !== "AbortError" && error.message !== "Aborted") {
            recordFailure(provider.name);
            onEvent?.({
              type: "failed",
              provider: provider.name,
              errorMessage: error.message,
            });
            console.log(`[hedged] ${provider.name} failed: ${error.message}`);
          }
          errors.push(error);
          checkAllDone();
        });
    }

    function checkAllDone(): void {
      if (settled) return;
      // All launched providers have either resolved/rejected, and none won
      if (errors.length >= totalAttempts && totalAttempts >= orderedProviders.length) {
        settled = true;
        reject(new AllProvidersFailedError(totalAttempts));
      }
    }

    // Launch primary immediately
    launchProvider(0);

    // Schedule secondary after hedgeDelays[0]
    if (orderedProviders.length > 1) {
      setTimeout(() => {
        if (!settled) launchProvider(1);
      }, hedgeDelays[0]);
    }

    // Schedule tertiary after hedgeDelays[1]
    if (orderedProviders.length > 2) {
      setTimeout(() => {
        if (!settled) launchProvider(2);
      }, hedgeDelays[1]);
    }
  });
}
