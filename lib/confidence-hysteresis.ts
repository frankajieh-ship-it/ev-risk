/**
 * Report Rendering Stability - Confidence Hysteresis
 *
 * Purpose: Prevent text flickering when confidence changes slightly
 * Problem: Tiny confidence changes cause text variants to flip back and forth
 * Solution: Sticky thresholds - require larger drop to downgrade tier
 */

/**
 * Confidence tiers for stable text variants
 *
 * Tier 3 (High): 75-100% confidence
 * Tier 2 (Medium): 50-74% confidence
 * Tier 1 (Low): 25-49% confidence
 * Tier 0 (Very Low): 0-24% confidence
 */
export type ConfidenceTier = 0 | 1 | 2 | 3;

/**
 * Tier thresholds (upgrade thresholds)
 */
const TIER_THRESHOLDS = {
  tier3: 0.75, // 75%+
  tier2: 0.5, // 50%+
  tier1: 0.25, // 25%+
  tier0: 0, // 0%+
};

/**
 * Downgrade thresholds (hysteresis)
 * Require confidence to drop BELOW these values to downgrade
 */
const DOWNGRADE_THRESHOLDS = {
  fromTier3: 0.68, // Drop from tier 3 to tier 2 only if < 68%
  fromTier2: 0.42, // Drop from tier 2 to tier 1 only if < 42%
  fromTier1: 0.18, // Drop from tier 1 to tier 0 only if < 18%
};

/**
 * Calculate confidence tier with hysteresis
 *
 * @param prevTier - Previous tier (0-3)
 * @param nextConf - New confidence value (0-1)
 * @returns New tier (0-3)
 */
export function stableTier(
  prevTier: ConfidenceTier | null,
  nextConf: number
): ConfidenceTier {
  // Normalize confidence to 0-1
  const conf = Math.max(0, Math.min(1, nextConf));

  // Calculate tier based on current thresholds (without hysteresis)
  const nextTier: ConfidenceTier =
    conf >= TIER_THRESHOLDS.tier3
      ? 3
      : conf >= TIER_THRESHOLDS.tier2
      ? 2
      : conf >= TIER_THRESHOLDS.tier1
      ? 1
      : 0;

  // If no previous tier, return calculated tier
  if (prevTier === null || prevTier === undefined) {
    return nextTier;
  }

  // If tier is upgrading or staying same, no hysteresis needed
  if (nextTier >= prevTier) {
    return nextTier;
  }

  // Apply hysteresis: require confidence to drop below downgrade threshold
  const downgradeThreshold =
    prevTier === 3
      ? DOWNGRADE_THRESHOLDS.fromTier3
      : prevTier === 2
      ? DOWNGRADE_THRESHOLDS.fromTier2
      : prevTier === 1
      ? DOWNGRADE_THRESHOLDS.fromTier1
      : 0;

  // If confidence hasn't dropped enough, keep previous tier
  if (conf >= downgradeThreshold) {
    return prevTier;
  }

  // Confidence has dropped enough, accept the downgrade
  return nextTier;
}

/**
 * Get tier label for display
 */
export function getTierLabel(tier: ConfidenceTier): string {
  switch (tier) {
    case 3:
      return "High";
    case 2:
      return "Medium";
    case 1:
      return "Low";
    case 0:
      return "Very Low";
  }
}

/**
 * Get tier color classes
 */
export function getTierColorClasses(tier: ConfidenceTier): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  switch (tier) {
    case 3:
      return {
        bg: "bg-green-100",
        border: "border-green-400",
        text: "text-green-900",
        icon: "text-green-600",
      };
    case 2:
      return {
        bg: "bg-yellow-100",
        border: "border-yellow-400",
        text: "text-yellow-900",
        icon: "text-yellow-600",
      };
    case 1:
      return {
        bg: "bg-orange-100",
        border: "border-orange-400",
        text: "text-orange-900",
        icon: "text-orange-600",
      };
    case 0:
      return {
        bg: "bg-red-100",
        border: "border-red-400",
        text: "text-red-900",
        icon: "text-red-600",
      };
  }
}

/**
 * Hook to manage stable tier state
 */
import { useState, useEffect } from "react";

export function useStableTier(confidence: number): ConfidenceTier {
  const [tier, setTier] = useState<ConfidenceTier>(() =>
    stableTier(null, confidence)
  );

  useEffect(() => {
    setTier((prevTier) => stableTier(prevTier, confidence));
  }, [confidence]);

  return tier;
}

/**
 * Get tier-specific messaging
 */
export function getTierMessaging(tier: ConfidenceTier): {
  summary: string;
  recommendation: string;
} {
  switch (tier) {
    case 3:
      return {
        summary: "We have high confidence in this assessment",
        recommendation:
          "Proceed with standard due diligence (test drive, inspection)",
      };
    case 2:
      return {
        summary: "We have medium confidence in this assessment",
        recommendation:
          "Recommend obtaining battery health report before purchase",
      };
    case 1:
      return {
        summary: "We have lower confidence in this assessment",
        recommendation:
          "Strongly recommend battery diagnostic and detailed inspection",
      };
    case 0:
      return {
        summary: "We have limited confidence in this assessment",
        recommendation:
          "Critical: Obtain comprehensive battery report and professional inspection",
      };
  }
}
