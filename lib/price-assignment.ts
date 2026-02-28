/**
 * OFFO Buyer Pass — Price Assignment
 *
 * Single-tier pricing: Buyer Pass $9.99 one-time (10 receipt credits)
 */

export type PriceVariant = "999";
export type PackTier = "buyer_pass";

export const BUYER_PASS_PRICE = "$9.99";
export const BUYER_PASS_CREDITS = 10;

/**
 * Assign a price variant. Always returns "999" (Buyer Pass).
 */
export function assignPriceVariant(
  _anonId: string,
  _scenarioId: string
): PriceVariant {
  return "999";
}

/**
 * Get variant for a given pack tier. Always returns "999".
 */
export function getVariantForTier(_tier: PackTier): PriceVariant {
  return "999";
}

/**
 * Get the Stripe Price ID from env vars.
 * Returns null if not configured (falls back to inline pricing).
 */
export function getStripePriceId(_variant: PriceVariant): string | null {
  return process.env.STRIPE_PRICE_USD_999 || null;
}

/**
 * Get display price string.
 */
export function getDisplayPrice(_variant: PriceVariant): string {
  return BUYER_PASS_PRICE;
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
