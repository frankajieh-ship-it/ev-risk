/**
 * OFFO Decision Pack — Price Assignment
 *
 * Two-tier pricing:
 *   - Starter Pack: $4.99 (variant "499")
 *   - Decision Pack: $9.99 (variant "999")
 */

const VARIANTS = ["499", "999"] as const;
export type PriceVariant = (typeof VARIANTS)[number];

export type PackTier = "starter_pack" | "decision_pack";

/**
 * Assign a price variant. Returns "999" by default (Decision Pack).
 * Kept for backward compatibility with existing callers.
 */
export function assignPriceVariant(
  _anonId: string,
  _scenarioId: string
): PriceVariant {
  return "999";
}

/**
 * Get variant for a given pack tier.
 */
export function getVariantForTier(tier: PackTier): PriceVariant {
  return tier === "starter_pack" ? "499" : "999";
}

/**
 * Get the Stripe Price ID for a variant from env vars.
 * Returns null if the env var is not configured (falls back to inline pricing).
 */
export function getStripePriceId(variant: PriceVariant): string | null {
  if (variant === "499") return process.env.STRIPE_PRICE_USD_499 || null;
  return process.env.STRIPE_PRICE_USD_999 || null;
}

/**
 * Get display price string.
 */
export function getDisplayPrice(variant: PriceVariant): string {
  return variant === "499" ? "$4.99" : "$9.99";
}

/**
 * Get amount in cents.
 */
export function getAmountCents(variant: PriceVariant): number {
  return variant === "499" ? 499 : 999;
}

/**
 * Validate that a string is a valid price variant.
 */
export function isValidVariant(v: string): v is PriceVariant {
  return v === "499" || v === "999";
}
