/**
 * OFFO Decision Pack — Rollout Flags
 *
 * Feature flags for gradual rollout of payment features.
 * Controlled via environment variables.
 *
 * Rollout sequence:
 * 1. Enable on staging only
 * 2. Enable for internal testers (anon_id allowlist)
 * 3. Enable for 10% traffic
 * 4. Full rollout
 */

export interface PaymentFlags {
  payments_enabled: boolean;
  pdf_download_enabled: boolean;
  deepdive_enabled: boolean;
  compare_enabled: boolean;
  free_mode: boolean;
}

export interface IntelligenceFlags {
  /** My Garage personalized news feed. Internal QA only until buyer-profile + Copart work is stable. */
  garage_news_enabled: boolean;
}

/**
 * Get current payment feature flags from environment.
 */
export function getPaymentFlags(): PaymentFlags {
  return {
    payments_enabled: process.env.FLAG_PAYMENTS_ENABLED === "true",
    pdf_download_enabled: process.env.FLAG_PDF_DOWNLOAD_ENABLED === "true",
    deepdive_enabled: process.env.FLAG_DEEPDIVE_ENABLED === "true",
    compare_enabled: process.env.FLAG_COMPARE_ENABLED === "true",
    free_mode: process.env.FLAG_FREE_MODE === "true",
  };
}

/**
 * Check if free mode is active.
 * When true, all monetization is disabled — no rate limits, no paywalls, no upgrade prompts.
 */
export function isFreeMode(): boolean {
  return process.env.FLAG_FREE_MODE === "true";
}

/**
 * Get intelligence feature flags. All off by default until FLAG_* env vars are set.
 */
export function getIntelligenceFlags(): IntelligenceFlags {
  return {
    garage_news_enabled: process.env.FLAG_GARAGE_NEWS_ENABLED === "true",
  };
}

/**
 * Check if a specific anon_id is on the internal tester allowlist.
 * Env var: FLAG_TESTER_ANON_IDS (comma-separated list)
 */
export function isInternalTester(anonId: string): boolean {
  const allowlist = process.env.FLAG_TESTER_ANON_IDS || "";
  if (!allowlist) return false;
  return allowlist.split(",").map((s) => s.trim()).includes(anonId);
}

/**
 * Check if payments are enabled for a given user.
 * Returns true if globally enabled OR if user is an internal tester.
 */
export function isPaymentsEnabledFor(anonId: string): boolean {
  if (isFreeMode()) return false;
  const flags = getPaymentFlags();
  if (flags.payments_enabled) return true;
  return isInternalTester(anonId);
}
