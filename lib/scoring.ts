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
  type ChargerDensityRow,
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
  // Optional metadata for manual entry tracking
  batteryInfoAvailable?: boolean;
  dataSource?: 'url-extraction' | 'manual-entry';
  missingFields?: string[];
  // Constraint Impact Layer - capacity multiplier for constrained vehicles
  constraintMultiplier?: number; // e.g., 0.70 for 70% cap
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

export interface AreaChargingContext {
  contentionLevel: "minimal" | "low" | "moderate" | "high";
  summary: string; // One-line explanation
  confidenceImpact: "reduces" | "neutral";
}

export interface BuyConfidence {
  overall_score: number; // 0-100
  rating: "GREEN" | "YELLOW" | "RED"; // DEPRECATED: Use fit_signal instead
  fit_signal: "Good Fit" | "Good Fit — with conditions" | "Conditional Fit" | "High Friction";
  emoji: "🟢" | "🟡" | "🔴";
  recommendation: string;
  one_sentence_verdict: string; // "Fits if X stays true..."
  becomes_annoying_if: string; // "...becomes annoying if Y changes"
  what_breaks_first: string[]; // ["Weeknight charging predictability", "Backup option reliability"]
  confidence: "High" | "Medium" | "Low"; // Changed from ALL CAPS to Title Case
  confidence_note: string; // Why this confidence level
  confidence_why: string[]; // ["Listing data incomplete", "Local charging competition varies"]
  top_drivers: Array<{ label: string; impact: "HIGH" | "MEDIUM" | "LOW" }>;
  plan_b: string[]; // ["Identify a backup L2 within 10-15 minutes", ...]
  battery_risk: BatteryRiskScore;
  platform_risk: PlatformRiskScore;
  ownership_fit: OwnershipFitScore;
  routine_fit?: RoutineFitAssessment;
  history_routine_signals?: HistoryRoutineSignal[];
  battery_health_context?: BatteryHealthContext;
  ev_history_flags?: EVHistoryFlag[];
  confidence_drivers?: ConfidenceDriver[];
  area_charging_context?: AreaChargingContext;
}

export interface RoutineFitAssessment {
  verdict: 'good-fit' | 'conditional-fit' | 'high-friction';
  condition?: string;
  mental_load: 'low' | 'medium' | 'high';
  reasons: Array<{
    text: string;
    type: 'positive' | 'neutral' | 'negative';
  }>;
  confidence_current: number;
  confidence_with_battery_data: number;
  missing_data: string[];
}

export interface HistoryRoutineSignal {
  type: "friction" | "buffer" | "low-stress";
  headline: string;
  explanation: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
}

export interface BatteryHealthContext {
  currentHealth: number; // Percentage (0-100)
  assessment: "typical" | "above-average" | "below-average" | "unusually-strong" | "faster-decline";
  comparisonText: string; // "92% after 3 years = typical"
  benchmarkNote: string; // "Compared to similar vehicles of this age and usage pattern"
}

export interface EVHistoryFlag {
  type: "warning" | "caution" | "neutral";
  flag: string;
  explanation: string;
  probability: "inferred" | "likely" | "observed";
}

export interface ConfidenceDriver {
  category: "data-completeness" | "history-clarity" | "routine-predictability";
  strength: "high" | "medium" | "low";
  reason: string;
}

// ---------- Scoring Logic ----------

/**
 * Generate Battery Health Contextualization
 * Converts absolute battery health % into relative assessment
 */
function generateBatteryHealthContext(degradation_percent: number, vehicleAge: number, chemistry: string): BatteryHealthContext {
  // Calculate current health (inverse of degradation)
  const currentHealth = Math.max(0, 100 - degradation_percent);

  // Expected degradation ranges by age
  // For NMC/NCM (most EVs): ~2% per year
  // For LFP: ~1.5% per year
  // For air-cooled (Nissan Leaf pre-2023): ~3% per year
  let expectedDegradation = 0;
  let typicalMin = 0;
  let typicalMax = 0;

  if (chemistry === "NMC" || chemistry === "NCM" || chemistry === "Unknown") {
    expectedDegradation = vehicleAge * 2; // 2% per year
    typicalMin = vehicleAge * 1.5;
    typicalMax = vehicleAge * 3;
  } else if (chemistry === "LFP") {
    expectedDegradation = vehicleAge * 1.5; // 1.5% per year
    typicalMin = vehicleAge * 1;
    typicalMax = vehicleAge * 2.5;
  } else {
    // Air-cooled or other
    expectedDegradation = vehicleAge * 3; // 3% per year
    typicalMin = vehicleAge * 2;
    typicalMax = vehicleAge * 4;
  }

  // Determine assessment
  let assessment: "typical" | "above-average" | "below-average" | "unusually-strong" | "faster-decline";
  let comparisonText = "";

  if (degradation_percent < typicalMin) {
    // Better than expected
    if (degradation_percent < typicalMin * 0.5) {
      assessment = "unusually-strong";
      comparisonText = `${currentHealth.toFixed(0)}% after ${vehicleAge} year${vehicleAge !== 1 ? 's' : ''} = unusually strong`;
    } else {
      assessment = "above-average";
      comparisonText = `${currentHealth.toFixed(0)}% after ${vehicleAge} year${vehicleAge !== 1 ? 's' : ''} = slightly above average`;
    }
  } else if (degradation_percent > typicalMax) {
    // Worse than expected
    assessment = "faster-decline";
    comparisonText = `${currentHealth.toFixed(0)}% after ${vehicleAge} year${vehicleAge !== 1 ? 's' : ''} = faster than expected decline`;
  } else if (degradation_percent >= typicalMin - 1 && degradation_percent <= expectedDegradation + 1) {
    // Within normal range
    assessment = "typical";
    comparisonText = `${currentHealth.toFixed(0)}% after ${vehicleAge} year${vehicleAge !== 1 ? 's' : ''} = typical`;
  } else if (degradation_percent < expectedDegradation) {
    assessment = "above-average";
    comparisonText = `${currentHealth.toFixed(0)}% after ${vehicleAge} year${vehicleAge !== 1 ? 's' : ''} = slightly above average`;
  } else {
    assessment = "below-average";
    comparisonText = `${currentHealth.toFixed(0)}% after ${vehicleAge} year${vehicleAge !== 1 ? 's' : ''} = slightly below average`;
  }

  return {
    currentHealth,
    assessment,
    comparisonText,
    benchmarkNote: "Compared to similar vehicles of this age and usage pattern.",
  };
}

/**
 * Generate EV-Specific History Flags
 * Non-mechanical risk flags specific to EVs (not covered by traditional Carfax)
 */
function generateEVHistoryFlags(input: ScoringInput, battery_risk: BatteryRiskScore): EVHistoryFlag[] {
  const flags: EVHistoryFlag[] = [];
  const age = new Date().getFullYear() - input.year;
  const avgMilesPerYear = age > 0 ? input.currentMileage / age : 0;

  // High DCFC dependency (inferred from no home charging + high miles)
  if (!input.homeCharging && input.dailyMiles > 40) {
    flags.push({
      type: "warning",
      flag: "High DCFC dependency (inferred)",
      explanation: "Without home charging and high daily miles, this vehicle likely relied heavily on fast charging, which accelerates battery degradation 2-3x faster than L2 charging.",
      probability: "inferred",
    });
  }

  // Long idle periods (inferred from low annual miles on older vehicle)
  if (age >= 3 && avgMilesPerYear < 5000) {
    flags.push({
      type: "caution",
      flag: "Likely long idle periods at unknown SOC",
      explanation: `Averaging ${Math.round(avgMilesPerYear).toLocaleString()} miles/year suggests extended periods of non-use. If stored at low state of charge, this accelerates degradation.`,
      probability: "likely",
    });
  }

  // Repeated deep discharge patterns (inferred from high degradation + no home charging)
  if (battery_risk.degradation_percent > 20 && age < 5 && !input.homeCharging) {
    flags.push({
      type: "warning",
      flag: "Possible repeated deep discharge patterns",
      explanation: `${battery_risk.degradation_percent.toFixed(0)}% degradation in ${age} years without home charging suggests frequent deep discharge cycles, which stress the battery.`,
      probability: "inferred",
    });
  }

  // Ownership churn correlated with charging access (inferred from age vs typical ownership)
  if (age <= 2 && input.currentMileage < 15000) {
    flags.push({
      type: "neutral",
      flag: "Early ownership transfer (neutral)",
      explanation: "Vehicle changed hands early in its life with low mileage. Could indicate charging access issues, relocation, or simply buyer preference change.",
      probability: "inferred",
    });
  }

  // Extreme climate exposure compounded by chemistry
  const climateZone = getClimateZoneByZip(input.zipCode);
  const normalizedModel = input.model.toLowerCase();
  if (climateZone?.zone === "Extreme Hot" && normalizedModel.includes("leaf") && input.year <= 2022) {
    flags.push({
      type: "warning",
      flag: "Air-cooled battery + extreme heat exposure",
      explanation: "Pre-2023 Nissan Leaf lacks active thermal management. Combined with extreme heat climate, this vehicle likely experienced accelerated degradation (2x normal rate).",
      probability: "likely",
    });
  }

  // Low-risk indicator: Home charging + moderate use
  if (input.homeCharging && input.dailyMiles >= 20 && input.dailyMiles <= 50 && avgMilesPerYear >= 8000 && avgMilesPerYear <= 15000) {
    flags.push({
      type: "neutral",
      flag: "Consistent moderate use pattern (positive indicator)",
      explanation: "Home charging access and moderate daily miles suggest healthy, consistent use pattern with minimal fast charging stress.",
      probability: "inferred",
    });
  }

  return flags;
}

/**
 * Calculate Area Charging Context
 *
 * Combines charger density + public charging dependency
 * to provide one line of interpretive context.
 *
 * NOT infrastructure intelligence - just interpretation support.
 */
function calculateAreaChargingContext(
  input: ScoringInput,
  chargerDensity: ChargerDensityRow | null
): AreaChargingContext {
  const hasPublicDependency = !input.homeCharging;

  // Case 1: No charger data OR poor density
  if (!chargerDensity || chargerDensity.density_score === "Poor") {
    if (hasPublicDependency) {
      return {
        contentionLevel: "high",
        summary: "High shared-charging contention risk in your area",
        confidenceImpact: "reduces"
      };
    }
    return {
      contentionLevel: "low",
      summary: "Home charging buffers against area-level charger contention",
      confidenceImpact: "neutral"
    };
  }

  // Case 2: Moderate density + public dependency
  if (hasPublicDependency && chargerDensity.density_score === "Moderate") {
    return {
      contentionLevel: "moderate",
      summary: "Moderate shared-charging contention risk (Confidence 68%)",
      confidenceImpact: "reduces"
    };
  }

  // Case 3: Good/Excellent density + public dependency
  if (hasPublicDependency && (chargerDensity.density_score === "Good" || chargerDensity.density_score === "Excellent")) {
    return {
      contentionLevel: "low",
      summary: "Low shared-charging contention risk in your area",
      confidenceImpact: "neutral"
    };
  }

  // Case 4: Home charging exists (minimal contention relevance)
  return {
    contentionLevel: "minimal",
    summary: "Home charging provides buffer against area-level charger contention",
    confidenceImpact: "neutral"
  };
}

/**
 * Generate Confidence Drivers
 * Explains why we're confident (or not) in this assessment
 */
function generateConfidenceDrivers(input: ScoringInput, battery_risk: BatteryRiskScore, confidence_level: "High" | "Medium" | "Low"): ConfidenceDriver[] {
  const drivers: ConfidenceDriver[] = [];

  // Data Completeness
  let dataStrength: "high" | "medium" | "low" = "medium";
  let dataReason = "";

  if (input.currentMileage > 0 && input.zipCode && input.dailyMiles && typeof input.homeCharging === 'boolean') {
    if (input.batteryInfoAvailable !== false) {
      dataStrength = "high";
      dataReason = "Complete vehicle data with user context (mileage, location, routine). Battery health data would further improve confidence.";
    } else {
      dataStrength = "medium";
      dataReason = "Good vehicle and routine data available. Missing: actual battery state of health report.";
    }
  } else {
    dataStrength = "low";
    dataReason = "Limited vehicle data. Using estimates for missing fields (mileage, location, or routine).";
  }

  drivers.push({
    category: "data-completeness",
    strength: dataStrength,
    reason: dataReason,
  });

  // History Clarity
  let historyStrength: "high" | "medium" | "low" = "medium";
  let historyReason = "";

  const age = new Date().getFullYear() - input.year;
  if (battery_risk.chemistry !== "Unknown" && input.currentMileage > 0) {
    historyStrength = "high";
    historyReason = `Battery chemistry identified (${battery_risk.chemistry}) and ${age}-year history with ${input.currentMileage.toLocaleString()} miles provides clear degradation baseline.`;
  } else if (battery_risk.chemistry === "Unknown") {
    historyStrength = "low";
    historyReason = "Battery chemistry could not be determined. Using conservative estimates, which may be less accurate.";
  } else {
    historyStrength = "medium";
    historyReason = "Some history details available, but gaps remain (e.g., charging habits, storage conditions).";
  }

  drivers.push({
    category: "history-clarity",
    strength: historyStrength,
    reason: historyReason,
  });

  // Routine Predictability
  let routineStrength: "high" | "medium" | "low" = "medium";
  let routineReason = "";

  if (input.homeCharging && input.dailyMiles >= 20 && input.dailyMiles <= 70) {
    routineStrength = "high";
    routineReason = "Home charging access and moderate daily miles create a predictable, low-friction ownership pattern.";
  } else if (!input.homeCharging && input.dailyMiles > 70) {
    routineStrength = "low";
    routineReason = "No home charging + high daily miles creates variable routine with dependency on public charger availability.";
  } else if (input.homeCharging || input.dailyMiles < 30) {
    routineStrength = "medium";
    routineReason = "Routine has some predictability, but variability in charging access or daily miles introduces uncertainty.";
  } else {
    routineStrength = "medium";
    routineReason = "Routine predictability depends on maintaining current charging access and mileage patterns.";
  }

  drivers.push({
    category: "routine-predictability",
    strength: routineStrength,
    reason: routineReason,
  });

  return drivers;
}

/**
 * Generate History × Routine Interaction Signals
 * This explains how the car's history will feel in the user's daily life
 */
function generateHistoryRoutineSignals(input: ScoringInput, battery_risk: BatteryRiskScore, ownership_fit: OwnershipFitScore): HistoryRoutineSignal[] {
  const signals: HistoryRoutineSignal[] = [];
  const age = new Date().getFullYear() - input.year;
  const chargerDensity = ownership_fit.charger_density;

  // Friction: Frequent fast charging + no home charging
  if (!input.homeCharging && input.dailyMiles > 50) {
    signals.push({
      type: "friction",
      headline: "Frequent fast charging + no home charging = higher routine friction",
      explanation: "Without home charging, you'll rely on public DCFC frequently. This creates daily planning overhead, charger competition stress, and faster battery degradation from repeated fast charging cycles.",
      impact: "HIGH",
    });
  }

  // Buffer reduced: Cold climate history + long daily miles
  if (ownership_fit.climate_impact === "Challenging" && input.dailyMiles > 70) {
    signals.push({
      type: "buffer",
      headline: "Cold-climate operation + long daily miles = reduced buffer in winter",
      explanation: "Cold temperatures reduce range by 20-40%. Combined with long commutes, you'll have little margin for error on cold days. This creates range anxiety and forces more frequent charging stops.",
      impact: "HIGH",
    });
  }

  // Low stress: Short-trip urban history + predictable home charging
  if (input.homeCharging && input.dailyMiles < 40 && chargerDensity !== "Low") {
    signals.push({
      type: "low-stress",
      headline: "Short-trip urban history + predictable home charging = low stress",
      explanation: "Home charging covers most of your routine. Short daily miles mean you can skip charging days without worry. This is the lowest-friction EV ownership pattern.",
      impact: "LOW",
    });
  }

  // Friction: High mileage + aging battery + no home charging
  if (input.currentMileage > 75000 && age > 5 && !input.homeCharging) {
    signals.push({
      type: "friction",
      headline: "High mileage + aging battery + public charging = compounding friction",
      explanation: `At ${input.currentMileage.toLocaleString()} miles and ${age} years old, battery capacity has likely degraded 15-25%. Without home charging, you'll feel this loss more acutely through reduced range and more frequent public charging stops.`,
      impact: "HIGH",
    });
  }

  // Buffer: Moderate use + home charging + good charger density
  if (input.homeCharging && input.dailyMiles >= 30 && input.dailyMiles <= 60 && chargerDensity === "High") {
    signals.push({
      type: "buffer",
      headline: "Moderate use + home charging + good infrastructure = healthy buffer",
      explanation: "Your daily miles fit well within typical EV range. Home charging handles routine needs, and local charger density provides backup options. You have flexibility for occasional longer trips.",
      impact: "MEDIUM",
    });
  }

  // Friction: Low charger density + no home charging
  if (!input.homeCharging && chargerDensity === "Low") {
    signals.push({
      type: "friction",
      headline: "Low charger density + no home charging = daily planning burden",
      explanation: "Limited public charging options mean you'll spend mental energy planning charging windows, competing for stations, and building your routine around charger availability rather than your schedule.",
      impact: "HIGH",
    });
  }

  // Low stress: New battery + low daily miles
  if (age <= 2 && input.dailyMiles < 30) {
    signals.push({
      type: "low-stress",
      headline: "Newer battery + minimal daily miles = years of low-maintenance operation",
      explanation: `At ${age} year(s) old with light daily use, the battery should maintain 90%+ capacity for 5+ more years. Range anxiety is minimal, and charging frequency stays low.`,
      impact: "LOW",
    });
  }

  // If no signals generated, add a default neutral signal
  if (signals.length === 0) {
    signals.push({
      type: "buffer",
      headline: "Standard EV ownership pattern - routine dependent",
      explanation: "Your history and routine create a typical EV ownership experience. Friction will depend mostly on maintaining consistent charging access and avoiding major routine changes.",
      impact: "MEDIUM",
    });
  }

  return signals;
}

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
  } else {
    // Mild penalty even with home charging
    if (charger_density === "Poor") score -= 10;
    else if (charger_density === "Moderate") score -= 5;
  }

  // Annual miles fit
  const annualMiles = input.dailyMiles * 365;
  let real_world_range = rangeData?.real_world_range_mi || 250;

  // Constraint Impact Layer: Apply capacity multiplier if vehicle has constraint
  if (input.constraintMultiplier && input.constraintMultiplier < 1) {
    real_world_range = real_world_range * input.constraintMultiplier;
  }

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

  const rangeNote = input.constraintMultiplier && input.constraintMultiplier < 1
    ? `${Math.round(real_world_range)} mi effective range`
    : `${real_world_range} mi range`;
  const details = `${climate_impact} climate, ${charger_density} charging infrastructure${!input.homeCharging ? " (no home charging)" : ""}, ${annual_miles_fit.toLowerCase()} daily range fit (${input.dailyMiles} mi/day vs ${rangeNote})`;

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

  // Determine rating and fit signal
  let rating: "GREEN" | "YELLOW" | "RED";
  let fit_signal: "Good Fit" | "Good Fit — with conditions" | "Conditional Fit" | "High Friction";
  let emoji: "🟢" | "🟡" | "🔴";
  let recommendation: string;
  let one_sentence_verdict: string;
  let confidence_note: string;

  if (adjusted_score >= 75) {
    rating = "GREEN";

    // Check for HIGH impact conditions that require qualifier
    const hasNoHomeCharging = !input.homeCharging;
    const hasHighMileage = input.dailyMiles > 70;
    const hasLowChargerDensity = ownership_fit.charger_density === "Low";

    // Add "with conditions" qualifier if there are HIGH impact friction points
    if (hasNoHomeCharging || (hasHighMileage && hasLowChargerDensity)) {
      fit_signal = "Good Fit — with conditions";
    } else {
      fit_signal = "Good Fit";
    }

    emoji = "🟢";
    recommendation = "Low Risk - Proceed with standard pre-purchase inspection.";

    // Generate one-sentence verdict based on context
    if (input.homeCharging) {
      one_sentence_verdict = `Fits well if your routine stays consistent.`;
    } else {
      one_sentence_verdict = `Fits if public charging stays predictable.`;
    }

    confidence_note = `Based on ${battery_risk.chemistry} battery chemistry, ${platform_risk.total_recalls} recall record, and charging infrastructure.`;

    // Add note about missing battery info improving confidence
    if (input.batteryInfoAvailable === false) {
      confidence_note += " Note: Confidence would improve with battery state of health data.";
    }
  } else if (adjusted_score >= 50) {
    rating = "YELLOW";
    fit_signal = "Conditional Fit";
    emoji = "🟡";
    recommendation = "Moderate Risk - Consider carefully. Get detailed battery health report and extended warranty if available.";

    // Identify the main friction point
    const mainFriction = battery_risk.score < 60 ? "battery degradation" :
                        !input.homeCharging ? "public charging dependency" :
                        "platform reliability concerns";

    one_sentence_verdict = `Fits if you can manage ${mainFriction}... becomes annoying if daily routine changes.`;
    confidence_note = `Moderate confidence - ${mainFriction} is the primary concern. Additional battery health data would improve accuracy.`;
  } else {
    rating = "RED";
    fit_signal = "High Friction";
    emoji = "🔴";
    recommendation = "High Risk - Proceed with caution. Budget for potential battery replacement or major repairs within 2-3 years.";

    // Identify multiple friction points
    const frictions: string[] = [];
    if (battery_risk.score < 40) frictions.push("battery degradation");
    if (!input.homeCharging) frictions.push("no home charging");
    if (platform_risk.critical_recalls > 0) frictions.push("critical recalls");

    const frictionList = frictions.length > 0 ? frictions.join(" + ") : "multiple risk factors";
    one_sentence_verdict = `High friction due to ${frictionList}... likely becomes annoying quickly unless circumstances improve.`;
    confidence_note = `Lower confidence - multiple risk factors present. Professional battery inspection strongly recommended before purchase.`;
  }

  // Generate becomes_annoying_if
  let becomes_annoying_if = "";
  if (fit_signal === "Good Fit") {
    becomes_annoying_if = input.homeCharging
      ? "you lose home charging access or daily routine becomes unpredictable"
      : "public charger availability becomes less reliable";
  } else if (fit_signal === "Conditional Fit") {
    becomes_annoying_if = "daily routine changes or charging becomes less predictable";
  } else {
    becomes_annoying_if = "circumstances don't improve significantly";
  }

  // Get charger density from ownership_fit
  const charger_density = ownership_fit.charger_density;

  // Generate what_breaks_first
  const what_breaks_first: string[] = [];
  if (!input.homeCharging) {
    what_breaks_first.push("Weeknight charging predictability");
  }
  if (battery_risk.score < 60) {
    what_breaks_first.push("Battery degradation timeline");
  }
  if (charger_density === "Low") {
    what_breaks_first.push("Backup charging option reliability");
  }
  if (input.dailyMiles > 70) {
    what_breaks_first.push("Range anxiety on longer days");
  }

  // Ensure at least one item
  if (what_breaks_first.length === 0) {
    what_breaks_first.push("Charging routine predictability");
  }

  // Generate confidence level
  const confidence_level: "High" | "Medium" | "Low" =
    adjusted_score >= 75 ? "High" : adjusted_score >= 50 ? "Medium" : "Low";

  // Generate confidence_why
  const confidence_why: string[] = [];
  if (!input.currentMileage || input.currentMileage === 0) {
    confidence_why.push("Listing data incomplete (manual details used)");
  }
  if (battery_risk.chemistry === "Unknown") {
    confidence_why.push("Battery chemistry could not be determined");
  }
  if (!input.homeCharging && charger_density === "Low") {
    confidence_why.push("Local charging competition varies by time of day");
  }

  // Handle missing battery info flag from manual entry
  if (input.batteryInfoAvailable === false) {
    confidence_why.push("Battery health data not available - using age-based estimates");
  }

  // Handle other missing fields from manual entry
  if (input.missingFields && input.missingFields.length > 0) {
    const fieldsToReport = input.missingFields.filter(f => f !== 'battery health'); // Already handled above
    if (fieldsToReport.length > 0) {
      confidence_why.push(`Missing: ${fieldsToReport.join(', ')}`);
    }
  }

  if (confidence_why.length === 0) {
    confidence_why.push(`Based on ${battery_risk.chemistry} battery chemistry and ${charger_density.toLowerCase()} charger density`);
  }

  // Generate top_drivers
  const top_drivers: Array<{ label: string; impact: "HIGH" | "MEDIUM" | "LOW" }> = [];
  if (!input.homeCharging) {
    top_drivers.push({ label: "No home charging", impact: "HIGH" });
  }
  if (input.dailyMiles > 70) {
    top_drivers.push({ label: "Long daily miles", impact: "MEDIUM" });
  }
  if (battery_risk.score < 60) {
    top_drivers.push({ label: "Battery age/degradation", impact: "HIGH" });
  }
  if (platform_risk.critical_recalls > 0) {
    top_drivers.push({ label: `${platform_risk.critical_recalls} critical recall(s)`, impact: "HIGH" });
  }
  if (charger_density === "Low") {
    top_drivers.push({ label: "Low charger density", impact: "MEDIUM" });
  }

  // Ensure at least one driver
  if (top_drivers.length === 0) {
    top_drivers.push({ label: "Standard EV ownership factors", impact: "MEDIUM" });
  }

  // Generate plan_b
  const plan_b: string[] = [];
  if (!input.homeCharging) {
    plan_b.push("Identify a backup L2 within 10-15 minutes");
    plan_b.push("Pick 2 recurring charging windows you can protect weekly");
    plan_b.push("Avoid relying on DCFC as routine charging");
  }
  if (battery_risk.score < 60) {
    plan_b.push("Get a professional battery health inspection before purchase");
    plan_b.push("Budget $8,000-15,000 for potential battery replacement");
  }
  if (input.dailyMiles > 70) {
    plan_b.push("Map out 2-3 reliable charging locations along your route");
    plan_b.push("Consider workplace charging if available");
  }
  if (charger_density === "Low") {
    plan_b.push("Download multiple charging apps to maximize options");
    plan_b.push("Identify 24/7 charging locations for emergencies");
  }

  // Ensure at least one plan B item
  if (plan_b.length === 0) {
    plan_b.push("Monitor battery health regularly");
    plan_b.push("Keep charging routine consistent");
    plan_b.push("Have backup charging options identified");
  }

  // Generate history × routine interaction signals
  const history_routine_signals = generateHistoryRoutineSignals(input, battery_risk, ownership_fit);

  // Generate battery health contextualization
  const vehicleAge = new Date().getFullYear() - input.year;
  const battery_health_context = generateBatteryHealthContext(
    battery_risk.degradation_percent,
    vehicleAge,
    battery_risk.chemistry
  );

  // Generate EV-specific history flags
  const ev_history_flags = generateEVHistoryFlags(input, battery_risk);

  // Generate confidence drivers
  const confidence_drivers = generateConfidenceDrivers(input, battery_risk, confidence_level);

  // Calculate area charging context
  const chargerDensityData = getChargerDensityByZip(input.zipCode);
  const area_charging_context = calculateAreaChargingContext(input, chargerDensityData);

  // Add area context to confidence explanation if it reduces confidence
  if (area_charging_context.confidenceImpact === "reduces") {
    confidence_why.push("Public charger reliability and queueing can't be predicted precisely");
  }

  return {
    overall_score: adjusted_score,
    rating,
    fit_signal,
    emoji,
    recommendation,
    one_sentence_verdict,
    becomes_annoying_if,
    what_breaks_first,
    confidence: confidence_level,
    confidence_note,
    confidence_why,
    top_drivers,
    plan_b,
    battery_risk,
    platform_risk,
    ownership_fit,
    history_routine_signals,
    battery_health_context,
    ev_history_flags,
    confidence_drivers,
    area_charging_context,
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

/**
 * Calculate Routine Fit Assessment
 * This is the key differentiator for the free version
 */
export function calculateRoutineFit(input: ScoringInput, confidence: BuyConfidence): RoutineFitAssessment {
  const rangeData = findRangeDataByModel(input.model, input.year);
  const realWorldRange = rangeData?.real_world_range_mi || 200;
  const dailyRangeUsage = (input.dailyMiles / realWorldRange) * 100;
  const chargerDensity = confidence.ownership_fit.charger_density;

  const reasons: Array<{ text: string; type: 'positive' | 'neutral' | 'negative' }> = [];
  let verdict: 'good-fit' | 'conditional-fit' | 'high-friction' = 'good-fit';
  let condition: string | undefined;
  let mental_load: 'low' | 'medium' | 'high' = 'low';

  // Analyze home charging
  if (input.homeCharging) {
    reasons.push({
      text: `Home charging available → charging becomes automatic`,
      type: 'positive'
    });
  } else {
    reasons.push({
      text: `No home charging → charging becomes a recurring task`,
      type: 'negative'
    });
  }

  // Analyze charger density
  if (chargerDensity === "Excellent" || chargerDensity === "Good") {
    reasons.push({
      text: `${chargerDensity} charger density → infrastructure supports public charging`,
      type: input.homeCharging ? 'neutral' : 'positive'
    });
  } else {
    reasons.push({
      text: `${chargerDensity} charger density → requires planning + backup options`,
      type: 'negative'
    });
  }

  // Analyze daily usage
  if (dailyRangeUsage < 50) {
    reasons.push({
      text: `Daily usage (${dailyRangeUsage.toFixed(0)}%) well within range → range is not the issue`,
      type: 'positive'
    });
  } else if (dailyRangeUsage < 70) {
    reasons.push({
      text: `Daily usage (${dailyRangeUsage.toFixed(0)}%) moderate → some buffer for spontaneous trips`,
      type: 'neutral'
    });
  } else {
    reasons.push({
      text: `Daily usage (${dailyRangeUsage.toFixed(0)}%) high → limited flexibility for detours or weather`,
      type: 'negative'
    });
  }

  // Determine verdict
  if (input.homeCharging && dailyRangeUsage < 50) {
    verdict = 'good-fit';
    mental_load = 'low';
  } else if (input.homeCharging && dailyRangeUsage < 70) {
    verdict = 'good-fit';
    mental_load = 'low';
  } else if (!input.homeCharging && (chargerDensity === "Excellent" || chargerDensity === "Good")) {
    verdict = 'conditional-fit';
    condition = 'secure reliable charging access';
    mental_load = 'medium';
  } else if (!input.homeCharging && chargerDensity === "Moderate") {
    verdict = 'conditional-fit';
    condition = 'identify and test backup charging locations';
    mental_load = 'medium';
  } else {
    verdict = 'high-friction';
    mental_load = 'high';
  }

  // Calculate confidence levels
  const confidence_current = confidence.overall_score;
  const confidence_with_battery_data = Math.min(95, confidence_current + 22); // ~22% boost with battery data

  // Missing data points
  const missing_data = [
    'Battery State of Health (SOH) percentage from OBD-II scan',
    'Actual degradation curve vs expected for this model/year',
    'Battery temperature management history',
    'Fast-charging frequency (impacts long-term degradation)',
    'Detailed recall completion status and outstanding issues'
  ];

  return {
    verdict,
    condition,
    mental_load,
    reasons,
    confidence_current,
    confidence_with_battery_data,
    missing_data
  };
}
