/**
 * EV-Risk™ Scoring Engine
 *
 * Calculates Buy Confidence Score based on:
 * - Battery Risk (40%): Age, chemistry, degradation
 * - Platform Risk (30%): Recalls, owner issues, reliability
 * - Ownership Fit (30%): Climate, charging infrastructure, usage pattern
 */

import {
  loadBatteryDegradationData,
  findRangeDataByModel,
  findRecallsForVehicle,
  findOwnerIssuesForModel,
  getClimateZoneByZip,
  getChargerDensityByZip,
  inferBatteryChemistry,
  type RecallRow,
} from "./data";

// ---------- Input Types ----------

export interface ScoringInput {
  model: string;
  year: number;
  currentMileage: number;
  zipCode: string;
  dailyMiles: number;
  homeCharging: boolean;
  riskTolerance: "conservative" | "moderate" | "aggressive";
}

// ---------- Output Types ----------

export interface BatteryRiskScore {
  score: number; // 0-100
  weight: number; // 0.4
  degradation_percent: number;
  estimated_replacement_cost: number;
  chemistry: string;
  details: string;
}

export interface PlatformRiskScore {
  score: number; // 0-100
  weight: number; // 0.3
  critical_recalls: number;
  total_recalls: number;
  reliability_score: number;
  details: string;
}

export interface OwnershipFitScore {
  score: number; // 0-100
  weight: number; // 0.3
  climate_impact: "Favorable" | "Moderate" | "Challenging";
  charger_density: string;
  annual_miles_fit: "Good" | "Moderate" | "Poor";
  details: string;
}

export interface BuyConfidence {
  overall_score: number; // 0-100
  rating: "GREEN" | "YELLOW" | "RED";
  emoji: "🟢" | "🟡" | "🔴";
  recommendation: string;
  battery_risk: BatteryRiskScore;
  platform_risk: PlatformRiskScore;
  ownership_fit: OwnershipFitScore;
}

// ---------- Scoring Logic ----------

/**
 * Calculate battery degradation risk
 * 40% of total score
 */
function calculateBatteryRisk(input: ScoringInput): BatteryRiskScore {
  const batteryData = loadBatteryDegradationData();
  const rangeData = findRangeDataByModel(input.model, input.year);

  // Infer battery chemistry
  const chemistry = rangeData?.chemistry || inferBatteryChemistry(input.model, input.year);
  const chemistryData = batteryData.chemistry_map[chemistry];

  if (!chemistryData) {
    // Default fallback if chemistry unknown
    return {
      score: 50,
      weight: 0.4,
      degradation_percent: 20,
      estimated_replacement_cost: 12000,
      chemistry: "Unknown",
      details: "Battery chemistry unknown - using conservative estimates",
    };
  }

  // Calculate vehicle age
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - input.year;

  // Calculate expected degradation based on BOTH age and mileage
  // Time-based degradation
  // CRITICAL FIX: Air-cooled Nissan Leaf needs higher base degradation
  let baseRate = chemistryData.degradation_rate_per_year;
  const normalizedModel = input.model.toLowerCase();
  if (normalizedModel.includes("leaf") && input.year <= 2022) {
    // Pre-2023 Leafs use air-cooled battery (no thermal management)
    baseRate = 3.0; // 3%/year vs 2%/year for liquid-cooled NMC
  }

  const ageDegradation = baseRate * vehicleAge;

  // Mileage-based degradation (additional wear from heavy use)
  // Assume 12k miles/year is "normal" - add penalty for high mileage
  const expectedMileage = vehicleAge * 12000;
  const excessMileage = Math.max(0, input.currentMileage - expectedMileage);
  const mileageDegradationPenalty = (excessMileage / 50000) * 5; // +5% per 50k excess miles

  const baseDegradation = ageDegradation + mileageDegradationPenalty;

  // Apply climate modifier
  const climateZone = getClimateZoneByZip(input.zipCode);
  let climateModifier = 1.0;
  if (climateZone) {
    if (climateZone.zone === "Extreme Hot" || climateZone.zone === "Extreme Cold") {
      // CRITICAL FIX: Air-cooled batteries + extreme heat = catastrophic degradation
      if (normalizedModel.includes("leaf") && climateZone.zone === "Extreme Hot") {
        climateModifier = 2.0; // 2x for air-cooled in extreme heat
      } else {
        climateModifier = 1.7; // Increased from 1.5x
      }
    } else if (climateZone.zone === "Hot" || climateZone.zone === "Hot Humid" || climateZone.zone === "Cold") {
      climateModifier = 1.35; // Increased from 1.25x
    }
  }

  const degradation_percent = Math.min(baseDegradation * climateModifier, 40); // Cap at 40%

  // Estimate replacement cost based on battery size
  const batteryKwh = rangeData?.battery_kwh || 75; // Default 75kWh
  let estimated_replacement_cost = 12000;

  if (batteryKwh < 60) {
    estimated_replacement_cost = batteryData.replacement_cost_estimates.compact.typical_cost;
  } else if (batteryKwh < 80) {
    estimated_replacement_cost = batteryData.replacement_cost_estimates.midsize.typical_cost;
  } else if (batteryKwh < 100) {
    estimated_replacement_cost = batteryData.replacement_cost_estimates.large.typical_cost;
  } else {
    estimated_replacement_cost = batteryData.replacement_cost_estimates.premium.typical_cost;
  }

  // Calculate score (inverse of degradation)
  // CRITICAL FIX: Adjusted thresholds to penalize 20%+ degradation more heavily
  // 0-12% degradation = 100-80 score (green)
  // 12-20% degradation = 80-50 score (yellow)
  // 20%+ degradation = 50-0 score (red)
  let score = 100;
  if (degradation_percent <= 12) {
    score = 100 - (degradation_percent / 12) * 20; // 12% → 80
  } else if (degradation_percent <= 20) {
    score = 80 - ((degradation_percent - 12) / 8) * 30; // 20% → 50
  } else {
    score = Math.max(0, 50 - (degradation_percent - 20) * 2.5); // 30% → 25
  }

  const details = `${chemistry} chemistry, ${vehicleAge} years old, ${degradation_percent.toFixed(1)}% estimated degradation${climateModifier > 1 ? ` (${climateZone?.zone} climate accelerates wear)` : ""}`;

  return {
    score: Math.round(score),
    weight: 0.4,
    degradation_percent: parseFloat(degradation_percent.toFixed(1)),
    estimated_replacement_cost,
    chemistry,
    details,
  };
}

/**
 * Calculate platform reliability risk
 * 30% of total score
 */
function calculatePlatformRisk(input: ScoringInput): PlatformRiskScore {
  const recalls = findRecallsForVehicle(input.model, input.year);
  const ownerIssues = findOwnerIssuesForModel(input.model);

  const total_recalls = recalls.length;
  const critical_recalls = recalls.filter(
    r => r.severity === "Critical" || r.severity === "High"
  ).length;

  // Base reliability score from owner data (0-10 scale)
  const base_reliability = ownerIssues?.reliability_score || 7.0;

  // Recall penalty
  let recallPenalty = 0;
  recalls.forEach((recall: RecallRow) => {
    if (recall.severity === "Critical") recallPenalty += 20;
    else if (recall.severity === "High") recallPenalty += 10;
    else if (recall.severity === "Medium") recallPenalty += 5;
    else recallPenalty += 2;
  });

  // Owner issue penalty
  let issuePenalty = 0;
  if (ownerIssues) {
    ownerIssues.common_issues.forEach(issue => {
      if (issue.severity === "Critical" && issue.frequency === "High") issuePenalty += 15;
      else if (issue.severity === "Critical" || issue.frequency === "High") issuePenalty += 10;
      else if (issue.severity === "High" && issue.frequency === "Medium") issuePenalty += 7;
      else if (issue.severity === "High" || issue.frequency === "Medium") issuePenalty += 5;
      else issuePenalty += 2;
    });
  }

  // Calculate final score
  // Start from reliability score (0-10 → 0-100)
  let score = base_reliability * 10;
  score -= recallPenalty;
  score -= issuePenalty;
  score = Math.max(0, Math.min(100, score));

  const details = `${total_recalls} recall(s) (${critical_recalls} critical), reliability score ${base_reliability}/10${ownerIssues ? `, ${ownerIssues.common_issues.length} known issue categories` : ""}`;

  return {
    score: Math.round(score),
    weight: 0.3,
    critical_recalls,
    total_recalls,
    reliability_score: base_reliability,
    details,
  };
}

/**
 * Calculate ownership fit
 * 30% of total score
 */
function calculateOwnershipFit(input: ScoringInput): OwnershipFitScore {
  const climateZone = getClimateZoneByZip(input.zipCode);
  const chargerDensity = getChargerDensityByZip(input.zipCode);
  const rangeData = findRangeDataByModel(input.model, input.year);

  let score = 100;

  // Climate impact
  let climate_impact: "Favorable" | "Moderate" | "Challenging" = "Favorable";
  if (climateZone) {
    if (climateZone.zone === "Extreme Hot" || climateZone.zone === "Extreme Cold") {
      climate_impact = "Challenging";
      score -= 25;
    } else if (climateZone.zone === "Hot" || climateZone.zone === "Hot Humid" || climateZone.zone === "Cold") {
      climate_impact = "Moderate";
      score -= 15;
    }
  }

  // Charger density impact
  const charger_density = chargerDensity?.density_score || "Moderate"; // Default to Moderate if unknown
  if (!input.homeCharging) {
    // CRITICAL FIX: No home charging is major lifestyle penalty
    if (charger_density === "Poor") score -= 50;
    else if (charger_density === "Moderate") score -= 35;
    else if (charger_density === "Good") score -= 25;
    else if (charger_density === "Excellent") score -= 20; // Increased from -10
    else if (charger_density === "Unknown") score -= 30; // Increased from -20
  } else {
    // Mild penalty even with home charging
    if (charger_density === "Poor") score -= 10;
    else if (charger_density === "Moderate") score -= 5;
    else if (charger_density === "Unknown") score -= 3; // Minor penalty for unknown
  }

  // Annual miles fit
  const annualMiles = input.dailyMiles * 365;
  const real_world_range = rangeData?.real_world_range_mi || 250;

  let annual_miles_fit: "Good" | "Moderate" | "Poor" = "Good";
  const dailyRangeRatio = input.dailyMiles / real_world_range;

  if (dailyRangeRatio > 0.7) {
    // Daily commute uses >70% of range
    annual_miles_fit = "Poor";
    score -= 30;
  } else if (dailyRangeRatio > 0.5) {
    // Daily commute uses >50% of range
    annual_miles_fit = "Moderate";
    score -= 15;
  }

  // High annual miles penalty (battery wear)
  if (annualMiles > 20000) {
    score -= 10;
  } else if (annualMiles > 15000) {
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));

  const details = `${climate_impact} climate, ${charger_density} charging infrastructure${!input.homeCharging ? " (no home charging)" : ""}, ${annual_miles_fit.toLowerCase()} daily range fit (${input.dailyMiles} mi/day vs ${real_world_range} mi range)`;

  return {
    score: Math.round(score),
    weight: 0.3,
    climate_impact,
    charger_density,
    annual_miles_fit,
    details,
  };
}

/**
 * Main scoring function
 */
export function calculateBuyConfidence(input: ScoringInput): BuyConfidence {
  const battery_risk = calculateBatteryRisk(input);
  const platform_risk = calculatePlatformRisk(input);
  const ownership_fit = calculateOwnershipFit(input);

  // Weighted overall score
  const overall_score = Math.round(
    battery_risk.score * battery_risk.weight +
    platform_risk.score * platform_risk.weight +
    ownership_fit.score * ownership_fit.weight
  );

  // Apply risk tolerance modifier
  let adjusted_score = overall_score;
  if (input.riskTolerance === "conservative") {
    // Conservative buyers: penalize yellow zone
    if (overall_score >= 60 && overall_score < 75) {
      adjusted_score -= 10;
    }
  } else if (input.riskTolerance === "aggressive") {
    // Aggressive buyers: boost yellow zone
    if (overall_score >= 60 && overall_score < 75) {
      adjusted_score += 10;
    }
  }
  adjusted_score = Math.max(0, Math.min(100, adjusted_score));

  // Determine rating
  let rating: "GREEN" | "YELLOW" | "RED";
  let emoji: "🟢" | "🟡" | "🔴";
  let recommendation: string;

  if (adjusted_score >= 75) {
    rating = "GREEN";
    emoji = "🟢";
    recommendation = "Low Risk - Good purchase candidate. Proceed with standard pre-purchase inspection.";
  } else if (adjusted_score >= 50) {
    rating = "YELLOW";
    emoji = "🟡";
    recommendation = "Moderate Risk - Consider carefully. Get detailed battery health report and extended warranty if available.";
  } else {
    rating = "RED";
    emoji = "🔴";
    recommendation = "High Risk - Proceed with caution. Budget for potential battery replacement or major repairs within 2-3 years.";
  }

  return {
    overall_score: adjusted_score,
    rating,
    emoji,
    recommendation,
    battery_risk,
    platform_risk,
    ownership_fit,
  };
}

/**
 * Generate detailed risk breakdown for report
 */
export function generateRiskBreakdown(confidence: BuyConfidence): string[] {
  const breakdown: string[] = [];

  // Battery Risk Details
  breakdown.push(`**Battery Risk (${confidence.battery_risk.score}/100)** - Weight: 40%`);
  breakdown.push(`• ${confidence.battery_risk.details}`);
  breakdown.push(`• Estimated replacement cost: $${confidence.battery_risk.estimated_replacement_cost.toLocaleString()}`);
  breakdown.push("");

  // Platform Risk Details
  breakdown.push(`**Platform Risk (${confidence.platform_risk.score}/100)** - Weight: 30%`);
  breakdown.push(`• ${confidence.platform_risk.details}`);
  if (confidence.platform_risk.critical_recalls > 0) {
    breakdown.push(`• ⚠️ ${confidence.platform_risk.critical_recalls} critical recall(s) - verify completion with seller`);
  }
  breakdown.push("");

  // Ownership Fit Details
  breakdown.push(`**Ownership Fit (${confidence.ownership_fit.score}/100)** - Weight: 30%`);
  breakdown.push(`• ${confidence.ownership_fit.details}`);
  breakdown.push("");

  return breakdown;
}
