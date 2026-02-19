/**
 * OFFO Decision Pack — Price Assignment
 *
 * Unified $9.99 pricing for both receipt and report products.
 * Previously used A/B/C testing with $9.99/$12.99/$14.99 variants.
 */

const VARIANTS = ["999"] as const;
export type PriceVariant = (typeof VARIANTS)[number];

/**
 * Assign a price variant. Always returns "999" ($9.99).
 * Kept for backward compatibility with existing callers.
 */
export function assignPriceVariant(
  _anonId: string,
  _scenarioId: string
): PriceVariant {
  return "999";
}

/**
 * Get the Stripe Price ID for a variant from env vars.
 * Returns null if the env var is not configured (falls back to inline pricing).
 */
export function getStripePriceId(_variant: PriceVariant): string | null {
  return process.env.STRIPE_PRICE_USD_999 || null;
}

/**
 * Get display price string.
 */
export function getDisplayPrice(_variant: PriceVariant): string {
  return "$9.99";
}

/**
 * Get amount in cents.
 */
export function getAmountCents(_variant: PriceVariant): number {
  return 999;
}

/**
 * Validate that a string is a valid price variant.
 */
export function isValidVariant(v: string): v is PriceVariant {
  return v === "999";
}
