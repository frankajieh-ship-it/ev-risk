/**
 * Risk Tags Taxonomy
 *
 * Machine-readable tags for categorizing routine friction points.
 * These enable longitudinal analysis across sessions.
 */

export const RISK_TAGS = {
  PUBLIC_CHARGING_DEPENDENCY: {
    id: "PUBLIC_CHARGING_DEPENDENCY",
    label: "Public Charging Dependency",
    description: "Relies heavily on public charging infrastructure",
    keywords: ["public charging", "no home charging", "public charger"],
  },
  SHARED_INFRA_COMPETITION: {
    id: "SHARED_INFRA_COMPETITION",
    label: "Shared Infrastructure Competition",
    description: "Competes with others for charging access",
    keywords: ["shared", "apartment", "communal", "workplace charger"],
  },
  ROUTINE_VARIABILITY_HIGH: {
    id: "ROUTINE_VARIABILITY_HIGH",
    label: "High Routine Variability",
    description: "Unpredictable daily driving patterns",
    keywords: ["varies", "unpredictable", "different each day", "irregular"],
  },
  LOW_PLANNING_TOLERANCE: {
    id: "LOW_PLANNING_TOLERANCE",
    label: "Low Planning Tolerance",
    description: "Prefers spontaneous trips without charge planning",
    keywords: ["spontaneous", "last minute", "no planning", "just go"],
  },
  WINTER_MOTORWAY_COMPRESSION: {
    id: "WINTER_MOTORWAY_COMPRESSION",
    label: "Winter Motorway Compression",
    description: "Winter + motorway driving significantly reduces range",
    keywords: ["winter", "cold", "motorway", "highway", "range loss"],
  },
  NO_DESTINATION_CHARGING: {
    id: "NO_DESTINATION_CHARGING",
    label: "No Destination Charging",
    description: "No charging available at frequent destinations",
    keywords: ["no charging at work", "no destination", "no charger there"],
  },
  LONG_DAYS_FREQUENT: {
    id: "LONG_DAYS_FREQUENT",
    label: "Frequent Long Days",
    description: "Regularly has high-mileage days",
    keywords: ["long days", "high mileage", "200+ miles", "300+ km"],
  },
  HOME_CHARGING_LIMITED: {
    id: "HOME_CHARGING_LIMITED",
    label: "Limited Home Charging",
    description: "Only has slow (Level 1/3-pin) home charging",
    keywords: ["3-pin", "granny charger", "slow charging", "level 1", "13a"],
  },
  APARTMENT_CONDITIONAL: {
    id: "APARTMENT_CONDITIONAL",
    label: "Apartment Conditional",
    description: "EV viability depends on apartment/condo charging situation",
    keywords: ["apartment", "flat", "condo", "landlord", "HOA"],
  },
  PRICE_SENSITIVITY_PUBLIC_RATES: {
    id: "PRICE_SENSITIVITY_PUBLIC_RATES",
    label: "Price Sensitive to Public Rates",
    description: "Public charging costs are a significant concern",
    keywords: ["expensive", "cost", "price", "public rates", "per kWh"],
  },
} as const;

export type RiskTagId = keyof typeof RISK_TAGS;

/**
 * Extract risk tags from prose "why not 100%" bullets
 * Returns array of matching tag IDs
 */
export function extractRiskTags(whyNot100Bullets: string[]): RiskTagId[] {
  const tags: Set<RiskTagId> = new Set();

  const bulletText = whyNot100Bullets.join(" ").toLowerCase();

  for (const [tagId, tagDef] of Object.entries(RISK_TAGS)) {
    for (const keyword of tagDef.keywords) {
      if (bulletText.includes(keyword.toLowerCase())) {
        tags.add(tagId as RiskTagId);
        break;
      }
    }
  }

  return Array.from(tags);
}

/**
 * Get human-readable labels for risk tags
 */
export function getRiskTagLabels(tagIds: RiskTagId[]): string[] {
  return tagIds.map((id) => RISK_TAGS[id]?.label || id);
}

/**
 * Validate if a string is a valid risk tag ID
 */
export function isValidRiskTag(tag: string): tag is RiskTagId {
  return tag in RISK_TAGS;
}
