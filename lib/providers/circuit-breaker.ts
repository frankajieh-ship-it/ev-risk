/**
 * Provider Circuit Breaker
 *
 * In-memory sliding window tracking failure rates per provider.
 * Resets on cold start — appropriate for serverless functions.
 *
 * Thresholds:
 *   > 60% failure rate → deprioritize (move to end of order)
 *   > 80% failure rate → skip entirely (circuit open)
 */

import type { ProviderName } from "./types";

// Fire-and-forget DB persist — import lazily to avoid circular deps and keep circuit-breaker fast
async function persistToDb(provider: ProviderName, success: boolean): Promise<void> {
  try {
    const { getSupabaseAdmin } = await import("@/lib/api-auth");
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    const now = new Date().toISOString();
    await supabase.from("provider_health").upsert({
      provider,
      ...(success
        ? { last_success_at: now }
        : { last_failure_at: now }),
      updated_at: now,
    }, { onConflict: "provider" })
      .then(() => {});
    // Increment the correct counter via RPC to avoid race conditions
    await supabase.rpc(success ? "increment_provider_success" : "increment_provider_failure", { p_provider: provider });
  } catch {
    // Never let DB persistence break the generation path
  }
}

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 20;           // sliding window size per provider
const DEPRIORITIZE_THRESHOLD = 0.6;
const SKIP_THRESHOLD = 0.8;

interface Entry {
  success: boolean;
  timestamp: number;
}

const windows: Record<ProviderName, Entry[]> = {
  openai: [],
  gemini: [],
  grok: [],
  anthropic: [],
};

const DEFAULT_ORDER: ProviderName[] = ["openai", "gemini", "grok", "anthropic"];

function prune(entries: Entry[]): Entry[] {
  const cutoff = Date.now() - WINDOW_MS;
  return entries.filter((e) => e.timestamp > cutoff).slice(-MAX_ENTRIES);
}

export function recordSuccess(provider: ProviderName): void {
  windows[provider] = prune(windows[provider]);
  windows[provider].push({ success: true, timestamp: Date.now() });
  void persistToDb(provider, true);
}

export function recordFailure(provider: ProviderName): void {
  windows[provider] = prune(windows[provider]);
  windows[provider].push({ success: false, timestamp: Date.now() });
  void persistToDb(provider, false);
}

export function getFailureRate(provider: ProviderName): number {
  const entries = prune(windows[provider]);
  if (entries.length === 0) return 0;
  const failures = entries.filter((e) => !e.success).length;
  return failures / entries.length;
}

/**
 * Returns providers in priority order, accounting for health.
 * Skips providers above SKIP_THRESHOLD.
 * Moves providers above DEPRIORITIZE_THRESHOLD to end.
 */
export function getProviderOrder(): ProviderName[] {
  const healthy: ProviderName[] = [];
  const deprioritized: ProviderName[] = [];

  for (const provider of DEFAULT_ORDER) {
    const rate = getFailureRate(provider);
    if (rate >= SKIP_THRESHOLD) {
      // Skip — circuit open
      console.log(`[circuit-breaker] Skipping ${provider} (failure rate: ${(rate * 100).toFixed(0)}%)`);
      continue;
    }
    if (rate >= DEPRIORITIZE_THRESHOLD) {
      deprioritized.push(provider);
    } else {
      healthy.push(provider);
    }
  }

  return [...healthy, ...deprioritized];
}
