/**
 * OFFO Price Assignment
 *
 * Multi-tier pricing:
 *   - Buyer Pass $9.99 (10 receipt credits, deep-dive, PDF)
 *   - Seller Questions Pack $2.99 / $4.99 (A/B test, 1 receipt, full questions + checklist)
 *
 * GBP display prices are approximate (display-only, Stripe charges USD).
 */

import type { Region } from "@/lib/region";

export type PriceVariant = "299" | "499" | "999" | "1999";
export type PackTier = "buyer_pass" | "seller_questions" | "chat_pass" | "copart_report" | "sellers_report_pdf";

export const BUYER_PASS_PRICE = "$9.99";
export const BUYER_PASS_CREDITS = 10;
export const CHAT_PASS_PRICE = "$9.99";
export const COPART_REPORT_PRICE = "$19.99";
export const COMPARE_PASS_PRICE = "$4.99";

export const SELLER_PACK_PRICE_A = "$2.99";
export const SELLER_PACK_PRICE_B = "$4.99";

const USD_DISPLAY: Record<PriceVariant, string> = {
  "299": "$2.99",
  "499": "$4.99",
  "999": "$9.99",
  "1999": "$19.99",
};

const GBP_DISPLAY: Record<PriceVariant, string> = {
  "299": "\u00A32.49",
  "499": "\u00A33.99",
  "999": "\u00A37.99",
  "1999": "\u00A315.99",
};

/**
 * Assign a Seller Pack A/B variant using a deterministic hash of anon_id.
 * 50/50 split: even hash → $2.99, odd → $4.99
 */
export function assignSellerPackVariant(anonId: string): "299" | "499" {
  let hash = 0;
  for (let i = 0; i < anonId.length; i++) {
    hash = ((hash << 5) - hash) + anonId.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 2 === 0 ? "299" : "499";
}

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
 * Get variant for a given pack tier.
 */
export function getVariantForTier(tier: PackTier, anonId?: string): PriceVariant {
  if (tier === "seller_questions" && anonId) {
    return assignSellerPackVariant(anonId);
  }
  if (tier === "copart_report") return "1999";
  // sellers_report_pdf, chat_pass, and buyer_pass all price at $9.99
  return "999";
}

/**
 * Get the Stripe Price ID from env vars.
 * Returns null if not configured (falls back to inline pricing).
 */
export function getStripePriceId(variant: PriceVariant): string | null {
  switch (variant) {
    case "299": return process.env.STRIPE_PRICE_USD_299 || null;
    case "499": return process.env.STRIPE_PRICE_USD_499 || null;
    case "999": return process.env.STRIPE_PRICE_USD_999 || null;
    case "1999": return process.env.STRIPE_PRICE_USD_1999 || null;
  }
}

/**
 * Get display price string in USD.
 */
export function getDisplayPrice(variant: PriceVariant): string {
  return USD_DISPLAY[variant];
}

/**
 * Get display price for the user's region.
 * UK users see approximate GBP; all others see USD.
 * Stripe always charges in USD.
 */
export function getDisplayPriceForRegion(
  variant: PriceVariant,
  region: Region = "US"
): string {
  if (region === "UK") return GBP_DISPLAY[variant];
  return USD_DISPLAY[variant];
}

/**
 * Get amount in cents.
 */
export function getAmountCents(variant: PriceVariant): number {
  switch (variant) {
    case "299": return 299;
    case "499": return 499;
    case "999": return 999;
    case "1999": return 1999;
  }
}

/**
 * Validate that a string is a valid price variant.
 */
export function isValidVariant(v: string): v is PriceVariant {
  return v === "299" || v === "499" || v === "999" || v === "1999";
}
