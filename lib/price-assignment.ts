/**
 * OFFO Decision Pack — Price Assignment
 *
 * Deterministic A/B/C price assignment based on anon_id + scenario_id.
 * Same user + same scenario always sees the same price.
 *
 * Variants: $9.99 / $12.99 / $14.99
 */

const VARIANTS = ["999", "1299", "1499"] as const;
export type PriceVariant = (typeof VARIANTS)[number];

const PRICE_ENV_MAP: Record<PriceVariant, string> = {
  "999": "STRIPE_PRICE_USD_999",
  "1299": "STRIPE_PRICE_USD_1299",
  "1499": "STRIPE_PRICE_USD_1499",
};

const DISPLAY_MAP: Record<PriceVariant, string> = {
  "999": "$9.99",
  "1299": "$12.99",
  "1499": "$14.99",
};

const AMOUNT_MAP: Record<PriceVariant, number> = {
  "999": 999,
  "1299": 1299,
  "1499": 1499,
};

/**
 * Simple deterministic hash for variant assignment.
 * Uses djb2 algorithm — fast, good distribution, no crypto dependency on client.
 */
function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // ensure unsigned
}

/**
 * Assign a price variant deterministically.
 * Same anon_id + scenario_id always returns the same variant.
 */
export function assignPriceVariant(
  anonId: string,
  scenarioId: string
): PriceVariant {
  const key = `${anonId}:${scenarioId}`;
  const idx = simpleHash(key) % VARIANTS.length;
  return VARIANTS[idx];
}

/**
 * Get the Stripe Price ID for a variant from env vars.
 * Returns null if the env var is not configured.
 */
export function getStripePriceId(variant: PriceVariant): string | null {
  const envKey = PRICE_ENV_MAP[variant];
  return process.env[envKey] || null;
}

/**
 * Get display price string for a variant.
 */
export function getDisplayPrice(variant: PriceVariant): string {
  return DISPLAY_MAP[variant] || "$9.99";
}

/**
 * Get amount in cents for a variant.
 */
export function getAmountCents(variant: PriceVariant): number {
  return AMOUNT_MAP[variant] || 999;
}

/**
 * Validate that a string is a valid price variant.
 */
export function isValidVariant(v: string): v is PriceVariant {
  return VARIANTS.includes(v as PriceVariant);
}
