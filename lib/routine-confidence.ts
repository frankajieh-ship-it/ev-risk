/**
 * computeConfidencePct
 *
 * Computes a 0–100 recommendation confidence score from a (partial) routine.
 * Extracted from RoutineStep.tsx so it can be reused in VehicleRecommendations
 * and any other consumer without duplicating the formula.
 */

import type { MinimumViableRoutine } from "@/types/v2";

export function computeConfidencePct(routine: Partial<MinimumViableRoutine>): number {
  const hasMiles =
    (routine.weekly_miles != null && routine.weekly_miles > 0) ||
    (routine.commute_miles_roundtrip != null && routine.commute_miles_roundtrip > 0);

  const hasHomeFeasibility =
    routine.charging_access === "home"
      ? !!(routine.home_type && routine.can_install_charger && routine.overnight_dwell_hours)
      : true;

  return Math.min(
    100,
    30 +
      (routine.charging_access ? 15 : 0) +
      (hasMiles ? 15 : 0) +
      (routine.climate ? 10 : 0) +
      (routine.longest_day_pattern ? 10 : 0) +
      (routine.budget_max ? 8 : 0) +
      (routine.body_style ? 4 : 0) +
      (routine.charging_access === "home" && hasHomeFeasibility ? 4 : 0) +
      (routine.longest_day_miles ? 1 : 0) +
      (routine.parking_exposure ? 1 : 0) +
      (routine.min_comfortable_soc != null ? 1 : 0) +
      (routine.towing_needs ? 1 : 0)
  );
}
