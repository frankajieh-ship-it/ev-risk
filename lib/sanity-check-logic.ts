/**
 * EV Routine Sanity-Check - Selection Logic Engine
 *
 * Handles sentence matching, fit context calculation, and ScoringInput mapping.
 */

import {
  FRICTION_SENTENCES,
  type SanityCheckAnswers,
  type FrictionSentence,
  getSentenceText
} from "./sanity-check-sentences";
import type { Region } from "./regionCopy";
import type {
  SeasonalSensitivity,
  SeasonalTriggerTag,
  PredictabilityLevel,
  PlanningTolerance,
} from "@/types";

/**
 * Select Friction Sentences
 *
 * Matches user answers against trigger conditions and returns 3-6 sentences.
 *
 * Priority Rules:
 * 1. Priority-based sorting (interaction sentences > generic sentences)
 * 2. Limit to at most 1 execution and 1 recovery sentence
 * 3. Multi-match sentences preferred within each category
 * 4. Target 3-6 sentences total
 * 5. Add baselines if fewer than 3 matched
 * 6. Exclude conflicting sentences (e.g., don't show stability with high friction)
 *
 * P0 LANGUAGE GATING:
 * - NEVER show public/shared charging friction if user has home + full_control
 * - NEVER show "unpredictable schedule" friction if schedule === "predictable"
 * - ALWAYS show stability language when conditions warrant
 */
export function selectFrictionSentences(answers: SanityCheckAnswers, region: Region = "US"): string[] {
  const matchedSentences: Array<{ sentence: FrictionSentence; matchCount: number; priority: number }> = [];

  // P0 LANGUAGE GATING: Determine hard exclusions based on user inputs
  const hasHomeCharging = answers.chargingAccess === "home";
  const hasFullControl = answers.dependency === "full_control";
  const hasPredictableSchedule = answers.schedule === "predictable";
  const hasEasyBackup = answers.backup === "easy";

  // Sentences to NEVER show for low-friction setups
  const hardExclusions: string[] = [];

  // If home charging + full control → exclude all public/shared friction sentences
  if (hasHomeCharging && hasFullControl) {
    hardExclusions.push(
      "shared_competition",
      "public_variability",
      "variable_schedule_overhead",
      "occasional_backup_fragility",
      "apartment_no_backup_compound",
      "work_charging_dependency",
      "public_unpredictable_peak",
      "execution_shared_public",
      "low_predictability_public_routine",
      "planning_tolerance_friction"
    );
  }

  // If predictable schedule → exclude "unpredictable schedule" sentences
  if (hasPredictableSchedule) {
    hardExclusions.push(
      "schedule_rigidity",
      "downtime_unpredictable",
      "public_unpredictable_peak"
    );
  }

  // If easy backup → exclude "no backup" sentences
  if (hasEasyBackup) {
    hardExclusions.push(
      "no_backup_amplification",
      "downtime_no_backup",
      "apartment_no_backup_compound",
      "no_backup_anchor",
      "cold_recovery_risk"
    );
  }

  // Priority map (higher = more important)
  const priorityMap: Record<string, number> = {
    "execution_shared_public": 100,  // S_EXEC_003 - Interaction sentence
    "downtime_no_backup": 95,        // S_REC_002 - Interaction sentence
    "downtime_unpredictable": 95,    // S_REC_003 - Interaction sentence
    "execution_uncertainty_low": 50,  // S_EXEC_001 - Generic
    "downtime_recovery_low": 50,      // S_REC_001 - Generic
    "execution_uncertainty_high": 30, // S_EXEC_002 - Optional positive
    "full_control_stability": 120     // P0: Boost stability sentence for low-friction users
  };

  // Check each sentence against user answers
  for (const sentence of FRICTION_SENTENCES) {
    // P0 LANGUAGE GATING: Skip hard-excluded sentences
    if (hardExclusions.includes(sentence.id)) {
      continue;
    }

    let matchCount = 0;

    for (const trigger of sentence.triggers) {
      const triggerMatches = Object.entries(trigger).every(
        ([key, value]) => answers[key as keyof SanityCheckAnswers] === value
      );

      if (triggerMatches) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      const priority = priorityMap[sentence.id] || 0;
      matchedSentences.push({ sentence, matchCount, priority });
    }
  }

  // Sort by priority first, then match count
  matchedSentences.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.matchCount - a.matchCount;
  });

  // Limit to at most 1 execution bullet and 1 recovery bullet
  let executionCount = 0;
  let recoveryCount = 0;
  const filteredSentences: string[] = [];

  for (const { sentence } of matchedSentences) {
    const text = getSentenceText(sentence, region);
    if (sentence.id.startsWith("execution_")) {
      if (executionCount < 1) {
        filteredSentences.push(text);
        executionCount++;
      }
    } else if (sentence.id.startsWith("downtime_")) {
      if (recoveryCount < 1) {
        filteredSentences.push(text);
        recoveryCount++;
      }
    } else {
      // Include all non-tolerance sentences (original 10)
      filteredSentences.push(text);
    }
  }

  // Check if high friction scenario (exclude stability sentence)
  const hasHighFriction =
    answers.dependency === "public" &&
    answers.schedule === "unpredictable" &&
    (answers.backup === "none" || answers.backup === "occasional");

  let selectedSentences = filteredSentences;
  if (hasHighFriction) {
    const stabilitySentence = FRICTION_SENTENCES.find(s => s.id === "full_control_stability");
    if (stabilitySentence) {
      const stabilityText = getSentenceText(stabilitySentence, region);
      selectedSentences = filteredSentences.filter(s => s !== stabilityText);
    }
  }

  // Add baselines if fewer than 3 matched
  // P0 LANGUAGE GATING: Don't add public/shared baselines for home + full_control users
  const isLowFrictionSetup = hasHomeCharging && hasFullControl;

  if (selectedSentences.length < 3) {
    // For low-friction users, add stability-affirming sentences instead
    if (isLowFrictionSetup) {
      const stabilitySentence = FRICTION_SENTENCES.find(s => s.id === "full_control_stability");
      if (stabilitySentence) {
        const stabilityText = getSentenceText(stabilitySentence, region);
        if (!selectedSentences.includes(stabilityText)) {
          selectedSentences.push(stabilityText);
        }
      }
    } else {
      // For other users, add shared/public baselines as before
      const sharedCompetitionSentence = FRICTION_SENTENCES.find(s => s.id === "shared_competition");
      const publicVariabilitySentence = FRICTION_SENTENCES.find(s => s.id === "public_variability");

      if (sharedCompetitionSentence) {
        const sharedCompetition = getSentenceText(sharedCompetitionSentence, region);
        if (!selectedSentences.includes(sharedCompetition)) {
          selectedSentences.push(sharedCompetition);
        }
      }

      if (selectedSentences.length < 3 && publicVariabilitySentence) {
        const publicVariability = getSentenceText(publicVariabilitySentence, region);
        if (!selectedSentences.includes(publicVariability)) {
          selectedSentences.push(publicVariability);
        }
      }
    }
  }

  // Return 3-6 sentences (cap at 6)
  return selectedSentences.slice(0, 6);
}

/**
 * Calculate Fit Context
 *
 * Determines overall fit label based on user answers.
 *
 * Returns:
 * - "High Friction": public + unpredictable + (none|occasional backup)
 * - "Conditional": shared/public OR variable schedule OR occasional backup
 * - "Good Fit": full_control + home + predictable/variable + backup available
 *
 * NEW: Includes tolerance-based modifiers:
 * - Conditional → High Friction if low execution tolerance + shared/public
 * - Good Fit → Conditional if low downtime tolerance + no backup
 */
export function calculateFitContext(answers: SanityCheckAnswers): "Good Fit" | "Conditional" | "High Friction" {
  // Determine base label
  let baseLabel: "Good Fit" | "Conditional" | "High Friction";

  // High Friction
  if (
    answers.dependency === "public" &&
    answers.schedule === "unpredictable" &&
    (answers.backup === "none" || answers.backup === "occasional")
  ) {
    baseLabel = "High Friction";
  }
  // Good Fit (check before Conditional to allow variable schedule)
  else if (
    answers.dependency === "full_control" &&
    answers.chargingAccess === "home" &&
    (answers.schedule === "predictable" || answers.schedule === "variable") &&
    answers.backup !== "none"
  ) {
    baseLabel = "Good Fit";
  }
  // Conditional
  else if (
    answers.dependency === "shared" ||
    answers.dependency === "public" ||
    answers.backup === "occasional" ||
    answers.schedule === "variable"
  ) {
    baseLabel = "Conditional";
  }
  // Default to Conditional
  else {
    baseLabel = "Conditional";
  }

  // NEW MODIFIER 1: Conditional + low execution tolerance + shared/public → High Friction
  if (
    baseLabel === "Conditional" &&
    answers.executionUncertaintyTolerance === "low" &&
    (answers.dependency === "shared" ||
     answers.dependency === "public" ||
     answers.chargingAccess === "apartment_shared" ||
     answers.chargingAccess === "work_shared" ||
     answers.chargingAccess === "public_mixed")
  ) {
    return "High Friction";
  }

  // NEW MODIFIER 2: Good Fit + low downtime tolerance + no backup → Conditional
  if (
    baseLabel === "Good Fit" &&
    answers.downtimeRecoveryTolerance === "low" &&
    answers.backup === "none"
  ) {
    return "Conditional";
  }

  return baseLabel;
}

/**
 * Map Sanity Answers to ScoringInput
 *
 * Converts sanity-check answers to fields required by the scoring engine.
 *
 * Mapping Rules:
 * - chargingAccess → homeCharging (boolean)
 * - schedule → dailyMiles (number)
 * - backup → riskTolerance (string)
 * - dependency → used for sentence selection only (not mapped)
 * - tolerance fields → used for sentence selection and fit modifiers only (not mapped)
 */
export function mapToScoringInput(
  answers: SanityCheckAnswers,
  zipCode: string
): {
  homeCharging: boolean;
  dailyMiles: number;
  riskTolerance: "conservative" | "moderate" | "aggressive";
  zipCode: string;
} {
  // Map chargingAccess to homeCharging
  const homeCharging = answers.chargingAccess === "home";

  // Map schedule to dailyMiles
  let dailyMiles: number;
  switch (answers.schedule) {
    case "predictable":
      dailyMiles = 20;
      break;
    case "variable":
      dailyMiles = 50;
      break;
    case "unpredictable":
      dailyMiles = 100;
      break;
  }

  // Map backup to riskTolerance
  let riskTolerance: "conservative" | "moderate" | "aggressive";
  switch (answers.backup) {
    case "none":
      riskTolerance = "conservative";
      break;
    case "occasional":
      riskTolerance = "moderate";
      break;
    case "easy":
      riskTolerance = "aggressive";
      break;
  }

  return {
    homeCharging,
    dailyMiles,
    riskTolerance,
    zipCode,
  };
}

// ============================================
// P0/P1: SEASONAL SENSITIVITY CALCULATION
// ============================================

/**
 * Calculate Seasonal Sensitivity
 *
 * Rules:
 * - COLD_WINTER + public_dependency => sensitivity >= MEDIUM
 * - COLD_WINTER + LOW planning tolerance + MEDIUM => HIGH
 * - COLD_WINTER + home + !WEEKLY winter days => LOW
 * - WEEKLY winter_long_days => bump one level
 */
export function calculateSeasonalSensitivity(
  answers: SanityCheckAnswers
): { sensitivity: SeasonalSensitivity; triggerTags: SeasonalTriggerTag[] } {
  const triggerTags: SeasonalTriggerTag[] = [];
  let sensitivity: SeasonalSensitivity = "LOW";

  // If no climate data or mild climate, return LOW
  if (!answers.climateSeasonality || answers.climateSeasonality === "MILD" || answers.climateSeasonality === "UNKNOWN") {
    return { sensitivity: "LOW", triggerTags: [] };
  }

  // Hot summer has different concerns (battery degradation)
  if (answers.climateSeasonality === "HOT_SUMMER") {
    triggerTags.push("SUMMER_HEAT_DEGRADATION");
    return { sensitivity: "LOW", triggerTags }; // Heat affects battery, not daily planning
  }

  // COLD_WINTER or MIXED - check winter friction
  const isColdWinter = answers.climateSeasonality === "COLD_WINTER" || answers.climateSeasonality === "MIXED";

  if (isColdWinter) {
    // Rule 1: Cold winter + public/shared dependency => MEDIUM
    if (
      answers.dependency === "public" ||
      answers.dependency === "shared" ||
      answers.chargingAnchorType === "PUBLIC_ANCHOR" ||
      answers.chargingAnchorType === "NONE"
    ) {
      sensitivity = "MEDIUM";
      triggerTags.push("WINTER_BUFFER_COMPRESSION");
    }

    // Rule 2: Cold winter + LOW planning tolerance bumps sensitivity
    const planningTolerance = derivePlanningTolerance(answers);
    if (planningTolerance === "LOW" && sensitivity === "MEDIUM") {
      sensitivity = "HIGH";
      triggerTags.push("COLD_RECOVERY_RISK");
    }

    // Rule 3: Cold winter + home charging + not weekly long days => likely LOW
    if (
      answers.chargingAccess === "home" &&
      answers.chargingAnchorType === "HOME" &&
      answers.winterLongDays !== "WEEKLY"
    ) {
      sensitivity = "LOW";
    }

    // Rule 4: Weekly long days in winter bumps sensitivity
    if (answers.winterLongDays === "WEEKLY") {
      if (sensitivity === "LOW") sensitivity = "MEDIUM";
      else if (sensitivity === "MEDIUM") sensitivity = "HIGH";
      if (!triggerTags.includes("WINTER_BUFFER_COMPRESSION")) {
        triggerTags.push("WINTER_BUFFER_COMPRESSION");
      }
    }
  }

  return { sensitivity, triggerTags };
}

// ============================================
// P0/P1: PREDICTABILITY LEVEL CALCULATION
// ============================================

/**
 * Calculate Predictability Level
 *
 * Rules:
 * - HOME anchor + YES_RELIABLE backup => HIGH
 * - WORK/DESTINATION anchor => MEDIUM
 * - PUBLIC_ANCHOR/NONE => LOW
 */
export function calculatePredictabilityLevel(
  answers: SanityCheckAnswers
): PredictabilityLevel {
  // High predictability: Home anchor + reliable backup
  if (
    answers.chargingAnchorType === "HOME" &&
    answers.backupOption === "YES_RELIABLE"
  ) {
    return "HIGH";
  }

  // High predictability: Home anchor even without explicit backup (home is inherently reliable)
  if (answers.chargingAnchorType === "HOME") {
    return "HIGH";
  }

  // Medium predictability: Work/destination anchor
  if (
    answers.chargingAnchorType === "WORK" ||
    answers.chargingAnchorType === "DESTINATION"
  ) {
    return "MEDIUM";
  }

  // Low predictability: Public anchor or no anchor
  if (
    answers.chargingAnchorType === "PUBLIC_ANCHOR" ||
    answers.chargingAnchorType === "NONE"
  ) {
    return "LOW";
  }

  // Default to MEDIUM
  return "MEDIUM";
}

// ============================================
// P0/P1: PLANNING TOLERANCE DERIVATION
// ============================================

/**
 * Derive Planning Tolerance from existing tolerance fields
 *
 * Maps executionUncertaintyTolerance + downtimeRecoveryTolerance:
 * - Both low => LOW
 * - Either high => HIGH
 * - Mixed => MEDIUM
 */
export function derivePlanningTolerance(
  answers: SanityCheckAnswers
): PlanningTolerance {
  const execTol = answers.executionUncertaintyTolerance;
  const downTol = answers.downtimeRecoveryTolerance;

  // Both low => LOW planning tolerance
  if (execTol === "low" && downTol === "low") {
    return "LOW";
  }

  // Either high => HIGH planning tolerance (user is flexible)
  if (execTol === "high" || downTol === "high") {
    return "HIGH";
  }

  // Mixed => MEDIUM
  return "MEDIUM";
}

/**
 * Apply Planning Tolerance as Multiplier
 *
 * Low planning tolerance amplifies friction from public/shared infrastructure.
 */
export function applyPlanningToleranceMultiplier(
  baseRiskLevel: "LOW" | "MEDIUM" | "HIGH",
  planningTolerance: PlanningTolerance,
  factor: "public_dependency" | "seasonal" | "shared_competition"
): "LOW" | "MEDIUM" | "HIGH" {
  if (planningTolerance === "LOW") {
    // Bump risk up one level
    if (baseRiskLevel === "LOW") return "MEDIUM";
    if (baseRiskLevel === "MEDIUM") return "HIGH";
    return "HIGH";
  }

  if (planningTolerance === "HIGH") {
    // Optionally reduce risk for non-structural factors
    if (factor === "shared_competition" && baseRiskLevel === "HIGH") {
      return "MEDIUM";
    }
  }

  return baseRiskLevel;
}
