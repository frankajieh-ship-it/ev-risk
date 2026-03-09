/**
 * Score Improvement Analyzer
 *
 * Analyzes a vehicle's fit score and generates actionable suggestions
 * for improving the score by testing hypothetical changes to the routine or vehicle.
 */

import type { MinimumViableRoutine, RoutineFitScore } from "@/types/v2";
import type { ScoreImprovement } from "@/types/recommendations";
import { computeRoutineFit } from "./compute-routine-fit";
import type { VehicleBasics } from "./compute-routine-fit";

const MIN_DELTA_THRESHOLD = 3; // Minimum point improvement to suggest

interface SuggestionCandidate extends ScoreImprovement {
  raw_delta: number; // Before rounding
}

export function computeScoreImprovements(
  routine: MinimumViableRoutine,
  vehicle: VehicleBasics,
  currentScore: RoutineFitScore
): ScoreImprovement[] {
  const suggestions: SuggestionCandidate[] = [];
  const baseScore = currentScore.score_0_100;

  // ============================================
  // 1. CHARGING STRESS (30% weight)
  // ============================================

  // Suggestion: Upgrade charging access
  if (routine.charging_access === "public") {
    // Test home charging
    const withHome = { ...routine, charging_access: "home" as const };
    const homeScore = computeRoutineFit(withHome, vehicle).score_0_100;
    const homeDelta = homeScore - baseScore;

    if (homeDelta >= MIN_DELTA_THRESHOLD) {
      suggestions.push({
        type: "routine_change",
        suggestion: "Add home charging access",
        score_delta: Math.round(homeDelta),
        raw_delta: homeDelta,
        dimension: "Charging Stress",
        priority: 0,
      });
    }

    // Test work charging (if home wasn't good enough)
    const withWork = { ...routine, charging_access: "work" as const };
    const workScore = computeRoutineFit(withWork, vehicle).score_0_100;
    const workDelta = workScore - baseScore;

    if (workDelta >= MIN_DELTA_THRESHOLD && workDelta > homeDelta) {
      suggestions.push({
        type: "routine_change",
        suggestion: "Add work charging access",
        score_delta: Math.round(workDelta),
        raw_delta: workDelta,
        dimension: "Charging Stress",
        priority: 0,
      });
    }
  } else if (routine.charging_access === "work") {
    // Test home charging (better than work)
    const withHome = { ...routine, charging_access: "home" as const };
    const homeScore = computeRoutineFit(withHome, vehicle).score_0_100;
    const homeDelta = homeScore - baseScore;

    if (homeDelta >= MIN_DELTA_THRESHOLD) {
      suggestions.push({
        type: "routine_change",
        suggestion: "Upgrade to home charging access",
        score_delta: Math.round(homeDelta),
        raw_delta: homeDelta,
        dimension: "Charging Stress",
        priority: 0,
      });
    }
  }

  // Suggestion: Increase overnight dwell time
  if (routine.charging_access === "home" &&
      routine.overnight_dwell_hours != null &&
      routine.overnight_dwell_hours < 10) {
    const withLongerDwell = { ...routine, overnight_dwell_hours: 12 };
    const dwellScore = computeRoutineFit(withLongerDwell, vehicle).score_0_100;
    const dwellDelta = dwellScore - baseScore;

    if (dwellDelta >= MIN_DELTA_THRESHOLD) {
      suggestions.push({
        type: "routine_change",
        suggestion: "Increase overnight dwell time to 10+ hours for full recharge",
        score_delta: Math.round(dwellDelta),
        raw_delta: dwellDelta,
        dimension: "Charging Stress",
        priority: 0,
      });
    }
  }

  // Suggestion: Resolve charger installation permission
  if (routine.charging_access === "home" &&
      routine.can_install_charger === "need_permission") {
    const withPermission = { ...routine, can_install_charger: "yes" as const };
    const permScore = computeRoutineFit(withPermission, vehicle).score_0_100;
    const permDelta = permScore - baseScore;

    if (permDelta >= MIN_DELTA_THRESHOLD) {
      suggestions.push({
        type: "routine_change",
        suggestion: "Get landlord/HOA approval to install a Level 2 charger",
        score_delta: Math.round(permDelta),
        raw_delta: permDelta,
        dimension: "Charging Stress",
        priority: 0,
      });
    }
  }

  // ============================================
  // 2. RANGE BUFFER (25% weight)
  // ============================================

  // Suggestion: Choose a vehicle with more range
  const currentRange = vehicle.real_world_range_mi ?? 200;
  const targetRange = currentRange + 80; // Test with +80 mi more range

  const withMoreRange = { ...vehicle, real_world_range_mi: targetRange };
  const rangeScore = computeRoutineFit(routine, withMoreRange).score_0_100;
  const rangeDelta = rangeScore - baseScore;

  if (rangeDelta >= MIN_DELTA_THRESHOLD) {
    suggestions.push({
      type: "vehicle_selection",
      suggestion: `Select a vehicle with ${targetRange}+ mi range instead of ${currentRange} mi`,
      score_delta: Math.round(rangeDelta),
      raw_delta: rangeDelta,
      dimension: "Range Buffer",
      priority: 0,
    });
  }

  // Suggestion: Reduce minimum comfortable SOC buffer
  if (routine.min_comfortable_soc != null && routine.min_comfortable_soc > 10) {
    const withLowerBuffer = { ...routine, min_comfortable_soc: 10 };
    const socScore = computeRoutineFit(withLowerBuffer, vehicle).score_0_100;
    const socDelta = socScore - baseScore;

    if (socDelta >= MIN_DELTA_THRESHOLD) {
      suggestions.push({
        type: "routine_change",
        suggestion: "Lower your minimum SOC buffer to 10% (from current higher setting)",
        score_delta: Math.round(socDelta),
        raw_delta: socDelta,
        dimension: "Range Buffer",
        priority: 0,
      });
    }
  }

  // ============================================
  // 3. RECOVERY RESILIENCE (10% weight)
  // ============================================

  // Suggestion: Change longest day pattern to less frequent
  if (routine.longest_day_pattern === "once_a_week") {
    const withMonthly = { ...routine, longest_day_pattern: "monthly_trip" as const };
    const monthlyScore = computeRoutineFit(withMonthly, vehicle).score_0_100;
    const monthlyDelta = monthlyScore - baseScore;

    if (monthlyDelta >= MIN_DELTA_THRESHOLD) {
      suggestions.push({
        type: "routine_change",
        suggestion: "If your long days are actually monthly (not weekly), update your routine",
        score_delta: Math.round(monthlyDelta),
        raw_delta: monthlyDelta,
        dimension: "Recovery Resilience",
        priority: 0,
      });
    }
  }

  // ============================================
  // 4. CLIMATE FRICTION (10% weight)
  // ============================================

  // Suggestion: Improve parking exposure in winter
  if (routine.climate === "winter" && routine.parking_exposure === "street") {
    const withGarage = { ...routine, parking_exposure: "garage" as const };
    const garageScore = computeRoutineFit(withGarage, vehicle).score_0_100;
    const garageDelta = garageScore - baseScore;

    if (garageDelta >= MIN_DELTA_THRESHOLD) {
      suggestions.push({
        type: "routine_change",
        suggestion: "Park in a garage to enable cabin preconditioning and reduce winter range loss",
        score_delta: Math.round(garageDelta),
        raw_delta: garageDelta,
        dimension: "Climate Friction",
        priority: 0,
      });
    }
  } else if (routine.climate === "winter" && routine.parking_exposure === "outdoor") {
    const withGarage = { ...routine, parking_exposure: "garage" as const };
    const garageScore = computeRoutineFit(withGarage, vehicle).score_0_100;
    const garageDelta = garageScore - baseScore;

    if (garageDelta >= MIN_DELTA_THRESHOLD) {
      suggestions.push({
        type: "routine_change",
        suggestion: "Park in a covered or garage space to reduce winter range loss",
        score_delta: Math.round(garageDelta),
        raw_delta: garageDelta,
        dimension: "Climate Friction",
        priority: 0,
      });
    }
  }

  // ============================================
  // 5. BUDGET FIT (15% weight)
  // ============================================

  // Suggestion: Choose a vehicle within budget
  if (routine.budget_max && vehicle.msrp_usd && vehicle.msrp_usd > routine.budget_max) {
    const withinBudgetVehicle = { ...vehicle, msrp_usd: routine.budget_max };
    const budgetScore = computeRoutineFit(routine, withinBudgetVehicle).score_0_100;
    const budgetDelta = budgetScore - baseScore;

    if (budgetDelta >= MIN_DELTA_THRESHOLD) {
      const budgetFormatted = `$${(routine.budget_max / 1000).toFixed(0)}k`;
      suggestions.push({
        type: "vehicle_selection",
        suggestion: `Choose a vehicle under ${budgetFormatted} (your budget)`,
        score_delta: Math.round(budgetDelta),
        raw_delta: budgetDelta,
        dimension: "Budget Fit",
        priority: 0,
      });
    }
  }

  // ============================================
  // 6. UTILITY FIT (10% weight)
  // ============================================

  // Suggestion: Choose a vehicle matching body style preference
  if (routine.body_style &&
      routine.body_style !== "any" &&
      vehicle.sub_category &&
      vehicle.sub_category !== routine.body_style) {
    const matchingVehicle = { ...vehicle, sub_category: routine.body_style };
    const utilityScore = computeRoutineFit(routine, matchingVehicle).score_0_100;
    const utilityDelta = utilityScore - baseScore;

    if (utilityDelta >= MIN_DELTA_THRESHOLD) {
      const styleLabel = routine.body_style === "suv" ? "SUV" :
                         routine.body_style === "sedan" ? "sedan" :
                         routine.body_style === "truck" ? "truck" : routine.body_style;
      suggestions.push({
        type: "vehicle_selection",
        suggestion: `Choose a ${styleLabel} (matches your preference)`,
        score_delta: Math.round(utilityDelta),
        raw_delta: utilityDelta,
        dimension: "Utility Fit",
        priority: 0,
      });
    }
  }

  // Suggestion: Choose a tow-capable vehicle
  if (routine.towing_needs && routine.towing_needs !== "none" && vehicle.sub_category) {
    if (vehicle.sub_category === "sedan" || vehicle.sub_category === "hatchback") {
      // Test with SUV or truck (tow-capable)
      const towCapableVehicle = { ...vehicle, sub_category: "suv" };
      const towScore = computeRoutineFit(routine, towCapableVehicle).score_0_100;
      const towDelta = towScore - baseScore;

      if (towDelta >= MIN_DELTA_THRESHOLD) {
        suggestions.push({
          type: "vehicle_selection",
          suggestion: "Choose a tow-capable vehicle like an SUV or truck",
          score_delta: Math.round(towDelta),
          raw_delta: towDelta,
          dimension: "Utility Fit",
          priority: 0,
        });
      }
    }
  }

  // ============================================
  // RANK AND RETURN
  // ============================================

  // Sort by raw_delta descending (highest impact first)
  suggestions.sort((a, b) => b.raw_delta - a.raw_delta);

  // Assign priority (1 = highest)
  const rankedSuggestions = suggestions.slice(0, 3).map((s, idx) => ({
    type: s.type,
    suggestion: s.suggestion,
    score_delta: s.score_delta,
    dimension: s.dimension,
    priority: idx + 1,
  }));

  // If no meaningful suggestions, return "optimized" message
  if (rankedSuggestions.length === 0 || baseScore >= 85) {
    return [{
      type: "optimized",
      suggestion: "This vehicle is already well-matched to your routine",
      score_delta: 0,
      dimension: "Overall",
      priority: 1,
    }];
  }

  return rankedSuggestions;
}
