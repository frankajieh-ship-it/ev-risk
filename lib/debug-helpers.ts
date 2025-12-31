/**
 * Debug helpers for ensuring distinct outputs
 */

import { ScoringInput, BuyConfidence } from "./scoring";

/**
 * Generate input hash for debugging
 */
export function generateInputHash(input: ScoringInput): string {
  const normalized = normalizeInputs(input);
  const str = JSON.stringify(normalized);

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `hash_${Math.abs(hash).toString(36)}`;
}

/**
 * Normalize inputs for consistent hashing
 */
export function normalizeInputs(input: ScoringInput): Record<string, any> {
  return {
    model: input.model.toLowerCase().trim(),
    year: input.year,
    currentMileage: input.currentMileage,
    zipCode: input.zipCode,
    dailyMiles: input.dailyMiles,
    homeCharging: input.homeCharging ? "yes" : "no",
    riskTolerance: input.riskTolerance,
  };
}

/**
 * Extract derived features from scoring
 */
export function extractDerivedFeatures(input: ScoringInput, confidence: BuyConfidence): Record<string, any> {
  return {
    batteryChemistry: confidence.battery_risk.chemistry,
    batteryScore: confidence.battery_risk.score,
    degradationPercent: confidence.battery_risk.degradation_percent,
    platformScore: confidence.platform_risk.score,
    criticalRecalls: confidence.platform_risk.critical_recalls,
    totalRecalls: confidence.platform_risk.total_recalls,
    ownershipScore: confidence.ownership_fit.score,
    climateImpact: confidence.ownership_fit.climate_impact,
    chargerDensity: confidence.ownership_fit.charger_density,
    annualMilesFit: confidence.ownership_fit.annual_miles_fit,
    adjustedScore: confidence.overall_score,
  };
}

/**
 * Extract rule triggers from scoring logic
 */
export function extractRuleTriggers(input: ScoringInput, confidence: BuyConfidence): string[] {
  const triggers: string[] = [];

  // Home charging rules
  if (input.homeCharging) {
    triggers.push("Home charging available → +10 ownership score");
  } else {
    triggers.push("No home charging → -15 ownership score");
  }

  // Daily miles rules
  if (input.dailyMiles > 70) {
    triggers.push("High daily miles (>70) → Stress on range");
  } else if (input.dailyMiles < 30) {
    triggers.push("Low daily miles (<30) → Good fit for EV range");
  }

  // Battery degradation rules
  if (confidence.battery_risk.degradation_percent > 30) {
    triggers.push("High degradation (>30%) → Battery risk penalty");
  }

  // Recall rules
  if (confidence.platform_risk.critical_recalls > 0) {
    triggers.push(`Critical recalls detected (${confidence.platform_risk.critical_recalls}) → Platform risk penalty`);
  }

  // Fit signal rules
  if (confidence.overall_score >= 75) {
    triggers.push("Score ≥75 → Good Fit signal");
  } else if (confidence.overall_score >= 50) {
    triggers.push("Score 50-74 → Conditional Fit signal");
  } else {
    triggers.push("Score <50 → High Friction signal");
  }

  // Confidence level rules
  if (!input.currentMileage || input.currentMileage === 0) {
    triggers.push("Missing mileage data → Lower confidence");
  }

  if (confidence.battery_risk.chemistry === "Unknown") {
    triggers.push("Unknown battery chemistry → Lower confidence");
  }

  // Climate rules
  if (confidence.ownership_fit.climate_impact === "Challenging") {
    triggers.push("Challenging climate → Ownership penalty");
  }

  // Charger density rules
  if (confidence.ownership_fit.charger_density === "Low" && !input.homeCharging) {
    triggers.push("Low charger density + no home charging → High friction");
  }

  return triggers;
}

/**
 * Generate complete debug data
 */
export function generateDebugData(input: ScoringInput, confidence: BuyConfidence) {
  return {
    inputHash: generateInputHash(input),
    normalizedInputs: normalizeInputs(input),
    derivedFeatures: extractDerivedFeatures(input, confidence),
    ruleTriggers: extractRuleTriggers(input, confidence),
  };
}
