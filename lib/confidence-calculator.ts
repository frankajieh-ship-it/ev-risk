/**
 * Phase 0.5: Deterministic Confidence Calculator
 *
 * Purpose: Calculate assessment confidence based on available data
 * Approach: Simple, transparent, deterministic (not ML)
 * Cap: Maximum 95% to avoid false precision
 *
 * Formula:
 * - Start at 50% base
 * - Add points for each piece of listing data
 * - Add points for each piece of personalization data
 * - Cap at 95%
 */

export interface ConfidenceInputs {
  // Listing data (what we get from URL/listing)
  listing: {
    hasMileage: boolean;
    hasAge: boolean;
    hasModel: boolean;
    hasTrim: boolean;
    hasVIN: boolean;
  };

  // Personalization data (what user provides)
  personalization: {
    hasDrivingPattern: boolean; // dailyMiles
    hasChargingAccess: boolean; // homeCharging
    hasRiskTolerance: boolean;
    hasZipCode: boolean;
  };

  // Optional: Battery health data
  batteryHealth: {
    hasSOHReport: boolean;
    hasChargingHistory: boolean;
  };
}

export interface ConfidenceResult {
  current: number; // Current confidence (0-100)
  potential: number; // Potential with full personalization (0-100)
  basedOn: string[]; // What we have
  missing: string[]; // What we don't have
  personalizationCount: number; // How many personalization inputs provided
}

/**
 * Calculate current confidence based on available data
 */
export function calculateConfidence(inputs: ConfidenceInputs): ConfidenceResult {
  let confidence = 50; // Base confidence

  const basedOn: string[] = [];
  const missing: string[] = [];

  // Add points for listing data
  if (inputs.listing.hasMileage) {
    confidence += 10;
    basedOn.push("Vehicle age and mileage from the listing");
  } else {
    missing.push("Current mileage");
  }

  if (inputs.listing.hasAge) {
    confidence += 10;
    if (!basedOn.some((item) => item.includes("age and mileage"))) {
      basedOn.push("Vehicle age from the listing");
    }
  } else {
    missing.push("Vehicle age");
  }

  if (inputs.listing.hasModel) {
    confidence += 5;
    basedOn.push("Model-level battery degradation curves");
  } else {
    missing.push("Vehicle model");
  }

  if (inputs.listing.hasTrim) {
    confidence += 5;
    basedOn.push("Trim-specific battery chemistry data");
  } else {
    missing.push("Trim / Battery size");
  }

  if (inputs.listing.hasVIN) {
    confidence += 5;
    basedOn.push("VIN-verified vehicle specifications");
  }

  // Add points for personalization data
  let personalizationCount = 0;

  if (inputs.personalization.hasDrivingPattern) {
    confidence += 10;
    basedOn.push("Your driving pattern and daily usage");
    personalizationCount++;
  } else {
    missing.push("Driving behavior");
  }

  if (inputs.personalization.hasChargingAccess) {
    confidence += 10;
    basedOn.push("Your charging infrastructure access");
    personalizationCount++;
  } else {
    missing.push("Charging behavior");
  }

  if (inputs.personalization.hasRiskTolerance) {
    confidence += 5;
    basedOn.push("Your risk tolerance preferences");
    personalizationCount++;
  }

  if (inputs.personalization.hasZipCode) {
    confidence += 5;
    basedOn.push("Local climate and charging infrastructure data");
    personalizationCount++;
  } else {
    missing.push("Local climate impact");
  }

  // Add points for battery health data (if available)
  if (inputs.batteryHealth.hasSOHReport) {
    confidence += 10;
    basedOn.push("Vehicle-specific battery health report");
  } else {
    missing.push("Battery health report");
  }

  if (inputs.batteryHealth.hasChargingHistory) {
    confidence += 5;
    basedOn.push("DC fast-charging history");
  } else {
    missing.push("Charging intensity");
  }

  // Cap at 95% (avoid false precision)
  confidence = Math.min(confidence, 95);

  // Calculate potential confidence (if all personalization was provided)
  let potential = confidence;

  // Add missing personalization points
  if (!inputs.personalization.hasDrivingPattern) potential += 10;
  if (!inputs.personalization.hasChargingAccess) potential += 10;
  if (!inputs.personalization.hasRiskTolerance) potential += 5;
  if (!inputs.personalization.hasZipCode) potential += 5;

  // Cap potential at 95%
  potential = Math.min(potential, 95);

  return {
    current: confidence,
    potential,
    basedOn,
    missing,
    personalizationCount,
  };
}

/**
 * Helper: Determine if Phase 0.5 should activate
 */
export function shouldActivatePhase05(
  personalizationCount: number
): boolean {
  return personalizationCount === 0;
}

/**
 * Helper: Get confidence level label
 */
export function getConfidenceLevel(score: number): "High" | "Medium" | "Low" {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

/**
 * Generate confidence data for UI components
 */
export function generateConfidenceData(inputs: ConfidenceInputs) {
  const result = calculateConfidence(inputs);

  return {
    current: result.current,
    potential: result.potential,
    basedOn: result.basedOn,
    missing: result.missing,
    level: getConfidenceLevel(result.current),
    shouldShowPhase05: shouldActivatePhase05(result.personalizationCount),
  };
}
