/**
 * Pricing plans config — single source of truth.
 * Consumed by FreePaidMatrix, PricingSection, and any other UI showing plan details.
 */

export const PRICING_PLANS = {
  free: {
    label: "Free report",
    features: ["Verdict", "Top 3 risks", "3 seller questions"],
  },
  full_report: {
    label: "Full analysis",
    price_usd: 9.99,
    billing_type: "one_time" as const,
    features: [
      "Full risk breakdown",
      "Ownership & accident history (NMVTIS)",
      "Theft & salvage record check",
      "Negotiation script",
      "Checklist",
      "PDF export",
      "Compare support",
    ],
  },
  subscription: {
    enabled: false,
    label: "Unlimited reports",
    price_usd: 19,
    billing_type: "monthly" as const,
  },
} as const;

export type PricingPlans = typeof PRICING_PLANS;
