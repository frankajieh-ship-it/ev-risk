/**
 * Vehicle Reasoning - Per-Vehicle Fit Explanations
 *
 * Generates personalized reasoning for why each vehicle does (or doesn't) fit.
 * Tied to user's specific routine, not generic pros/cons.
 */

import type { VehicleRecommendation } from "@/types/recommendations";
import type { MinimumViableRoutine } from "@/types/v2";

/**
 * Generate fit verdict reasoning tied to user's routine
 */
export function generateFitVerdictReasoning(
  vehicle: VehicleRecommendation,
  routine: MinimumViableRoutine
): string {
  const weeklyMiles = routine.weekly_miles ?? (routine.commute_miles_roundtrip ? routine.commute_miles_roundtrip * 5 : 70);
  const dailyNeed = Math.round(weeklyMiles / 7);
  const range = vehicle.real_world_range_mi;

  // Calculate buffer (range / daily need ratio)
  const bufferRatio = range / dailyNeed;

  if (vehicle.fit_label === "Great Fit") {
    if (bufferRatio >= 4) {
      return `${range} mi range gives you ${Math.floor(bufferRatio)}× your ${dailyNeed} mi/day need—plenty of buffer`;
    }
    return `${range} mi range covers your ${dailyNeed} mi/day with strong buffer`;
  } else if (vehicle.fit_label === "Good Fit") {
    return `${range} mi range handles your ${dailyNeed} mi/day with normal planning`;
  } else if (vehicle.fit_label === "Mixed Fit") {
    return `${range} mi range tight for your ${dailyNeed} mi/day—requires charge planning on longer days`;
  } else {
    // High Friction
    return `${range} mi range below your ${dailyNeed} mi/day average—needs frequent charging`;
  }
}

/**
 * Generate Plan B suggestion based on charging access
 */
export function generatePlanBSuggestion(
  vehicle: VehicleRecommendation,
  routine: MinimumViableRoutine
): string {
  const weeklyMiles = routine.weekly_miles ?? (routine.commute_miles_roundtrip ? routine.commute_miles_roundtrip * 5 : 70);
  const dailyNeed = Math.round(weeklyMiles / 7);
  const range = vehicle.real_world_range_mi;
  const bufferRatio = range / dailyNeed;

  if (routine.charging_access === "home") {
    if (bufferRatio >= 3) {
      return "Charge at home 2-3× per week, keep above 30%";
    }
    return "Charge at home nightly, keep above 40% for buffer";
  } else if (routine.charging_access === "work") {
    if (bufferRatio >= 2.5) {
      return "Workplace charging + home top-ups for long weekends";
    }
    return "Workplace charging daily + backup public charger mapped";
  } else {
    // Public charging
    if (bufferRatio < 2) {
      return "Map 3-4 fast chargers along your route—you'll use them weekly";
    }
    return "Identify 2 reliable public chargers (backup + primary)";
  }
}

/**
 * Generate verification item based on vehicle characteristics
 */
export function generateVerificationItem(
  vehicle: VehicleRecommendation
): string {
  // Prioritize by chemistry first (most important for health assessment)
  if (vehicle.chemistry === "LFP") {
    return "LFP battery health — ask for charge cycles (aim for <1000), not degradation %";
  }

  // Then by age
  if (vehicle.year <= 2020) {
    return "Battery State of Health (SoH) report — should be >85% for pre-2021 models";
  }

  // Newer vehicles with NMC chemistry
  if (vehicle.chemistry.includes("NMC")) {
    if (vehicle.year >= 2023) {
      return "Service history for any battery-related recalls or software updates";
    }
    return "Battery capacity test results — compare to original spec";
  }

  // Fallback (shouldn't hit this often)
  return "Battery warranty status and any documented capacity loss";
}

/**
 * Get fit verdict label for display
 */
export function getFitVerdictLabel(fitLabel: string): string {
  switch (fitLabel) {
    case "Great Fit":
      return "Smooth sailing";
    case "Good Fit":
      return "Works with planning";
    case "Mixed Fit":
      return "Needs careful planning";
    case "High Friction":
      return "Challenging fit";
    default:
      return fitLabel;
  }
}

/**
 * Generate climate-aware note for vehicle
 */
export function generateClimateNote(
  vehicle: VehicleRecommendation,
  routine: MinimumViableRoutine
): string | null {
  if (routine.climate === "winter") {
    // Cold weather impact
    if (vehicle.chemistry === "LFP") {
      return "LFP batteries lose ~40% range in freezing temps—pre-condition while plugged in";
    } else if (vehicle.year <= 2020) {
      return "Older battery tech sees 25-35% range loss in cold—plan accordingly";
    }
    return "Expect 20-30% range reduction in winter";
  } else if (routine.climate === "hot") {
    // Hot weather impact
    if (vehicle.battery_kwh >= 100) {
      return "Large battery helps with A/C draw—expect ~10% range loss in extreme heat";
    }
    return "A/C usage reduces range ~10-15% in hot weather";
  }

  return null; // Mild climate, no special note needed
}
