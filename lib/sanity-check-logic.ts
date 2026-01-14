/**
 * EV Routine Sanity-Check - Selection Logic Engine
 *
 * Handles sentence matching, fit context calculation, and ScoringInput mapping.
 */

import {
  FRICTION_SENTENCES,
  type SanityCheckAnswers,
  type FrictionSentence
} from "./sanity-check-sentences";

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
 */
export function selectFrictionSentences(answers: SanityCheckAnswers): string[] {
  const matchedSentences: Array<{ sentence: FrictionSentence; matchCount: number; priority: number }> = [];

  // Priority map (higher = more important)
  const priorityMap: Record<string, number> = {
    "execution_shared_public": 100,  // S_EXEC_003 - Interaction sentence
    "downtime_no_backup": 95,        // S_REC_002 - Interaction sentence
    "downtime_unpredictable": 95,    // S_REC_003 - Interaction sentence
    "execution_uncertainty_low": 50,  // S_EXEC_001 - Generic
    "downtime_recovery_low": 50,      // S_REC_001 - Generic
    "execution_uncertainty_high": 30  // S_EXEC_002 - Optional positive
  };

  // Check each sentence against user answers
  for (const sentence of FRICTION_SENTENCES) {
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
    if (sentence.id.startsWith("execution_")) {
      if (executionCount < 1) {
        filteredSentences.push(sentence.text);
        executionCount++;
      }
    } else if (sentence.id.startsWith("downtime_")) {
      if (recoveryCount < 1) {
        filteredSentences.push(sentence.text);
        recoveryCount++;
      }
    } else {
      // Include all non-tolerance sentences (original 10)
      filteredSentences.push(sentence.text);
    }
  }

  // Check if high friction scenario (exclude stability sentence)
  const hasHighFriction =
    answers.dependency === "public" &&
    answers.schedule === "unpredictable" &&
    (answers.backup === "none" || answers.backup === "occasional");

  let selectedSentences = filteredSentences;
  if (hasHighFriction) {
    const stabilityText = FRICTION_SENTENCES.find(s => s.id === "full_control_stability")?.text;
    selectedSentences = filteredSentences.filter(s => s !== stabilityText);
  }

  // Add baselines if fewer than 3 matched
  if (selectedSentences.length < 3) {
    const sharedCompetition = FRICTION_SENTENCES.find(s => s.id === "shared_competition")?.text;
    const publicVariability = FRICTION_SENTENCES.find(s => s.id === "public_variability")?.text;

    if (sharedCompetition && !selectedSentences.includes(sharedCompetition)) {
      selectedSentences.push(sharedCompetition);
    }

    if (selectedSentences.length < 3 && publicVariability && !selectedSentences.includes(publicVariability)) {
      selectedSentences.push(publicVariability);
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
