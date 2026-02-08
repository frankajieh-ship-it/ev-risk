/**
 * Generates a deterministic human-readable slug from MVR inputs.
 * Example: "no_home_charging_winter_weekly_long_days_viability"
 */

import type { MinimumViableRoutine } from "@/types/v2";

export function generateScenarioSlug(mvr: MinimumViableRoutine): string {
  const parts: string[] = [];

  if (mvr.charging_access === "public") parts.push("no_home_charging");
  else if (mvr.charging_access === "work") parts.push("work_charging");
  else parts.push("home_charging");

  if (mvr.climate === "winter") parts.push("winter");
  else if (mvr.climate === "hot") parts.push("hot_climate");

  if (mvr.longest_day_pattern === "once_a_week") parts.push("weekly_long_days");
  else if (mvr.longest_day_pattern === "monthly_trip") parts.push("monthly_trips");

  parts.push("viability");

  return parts.join("_");
}
