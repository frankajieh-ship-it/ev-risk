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
  email_gate_enabled: boolean;
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
    email_gate_enabled: process.env.FLAG_EMAIL_GATE_ENABLED !== "false",
  };
}

/**
 * Check if the email gate is active.
 * Default ON — set FLAG_EMAIL_GATE_ENABLED=false in env to disable.
 */
export function isEmailGateEnabled(): boolean {
  return process.env.FLAG_EMAIL_GATE_ENABLED !== "false";
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
 * Internal QA user UUIDs — these bypass all paid gates so the team can test
 * the full paid experience without going through Stripe.
 * Mirrors the INTERNAL_USER_IDS set in /api/track-event/route.ts.
 */
const INTERNAL_USER_IDS = new Set([
  "a9e65037-00b3-443b-afba-5631e42b0505",
  "71ccca48-add0-4a47-b7b4-14985c923a78",
]);

export function isInternalUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return INTERNAL_USER_IDS.has(userId);
}

/**
 * Check if payments are enabled for a given user.
 * Returns true if globally enabled OR if user is an internal tester.
 */
export function isPaymentsEnabledFor(anonId: string): boolean {
  if (process.env.NODE_ENV === "development") return false;
  if (isFreeMode()) return false;
  const flags = getPaymentFlags();
  if (flags.payments_enabled) return true;
  return isInternalTester(anonId);
}
