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
 * 1. Multi-match sentences first (match multiple answer fields)
 * 2. Deduplicate by ID
 * 3. Target 3-6 sentences
 * 4. Add baselines if fewer than 3 matched
 * 5. Exclude conflicting sentences (e.g., don't show stability with high friction)
 */
export function selectFrictionSentences(answers: SanityCheckAnswers): string[] {
  const matchedSentences: Array<{ sentence: FrictionSentence; matchCount: number }> = [];

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
      matchedSentences.push({ sentence, matchCount });
    }
  }

  // Sort by match count (descending) - prefer multi-match sentences
  matchedSentences.sort((a, b) => b.matchCount - a.matchCount);

  // Deduplicate by ID and extract text
  const uniqueSentences = new Map<string, string>();
  for (const { sentence } of matchedSentences) {
    if (!uniqueSentences.has(sentence.id)) {
      uniqueSentences.set(sentence.id, sentence.text);
    }
  }

  let selectedSentences = Array.from(uniqueSentences.values());

  // Check if high friction scenario (exclude stability sentence)
  const hasHighFriction =
    answers.dependency === "public" &&
    answers.schedule === "unpredictable" &&
    (answers.backup === "none" || answers.backup === "occasional");

  if (hasHighFriction) {
    const stabilityText = FRICTION_SENTENCES.find(s => s.id === "full_control_stability")?.text;
    selectedSentences = selectedSentences.filter(s => s !== stabilityText);
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
 */
export function calculateFitContext(answers: SanityCheckAnswers): "Good Fit" | "Conditional" | "High Friction" {
  // High Friction
  if (
    answers.dependency === "public" &&
    answers.schedule === "unpredictable" &&
    (answers.backup === "none" || answers.backup === "occasional")
  ) {
    return "High Friction";
  }

  // Conditional
  if (
    answers.dependency === "shared" ||
    answers.dependency === "public" ||
    answers.backup === "occasional" ||
    answers.schedule === "variable"
  ) {
    return "Conditional";
  }

  // Good Fit
  if (
    answers.dependency === "full_control" &&
    answers.chargingAccess === "home" &&
    (answers.schedule === "predictable" || answers.schedule === "variable") &&
    answers.backup !== "none"
  ) {
    return "Good Fit";
  }

  // Default to Conditional
  return "Conditional";
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
