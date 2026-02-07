/**
 * computeRoutineFit - V2 Primary Scoring Engine
 *
 * Pure function: MVR + optional vehicle basics → RoutineFitScore
 * Client-safe (no fs imports). Works WITHOUT battery/VIN data.
 *
 * Scoring dimensions (weighted):
 * - Charging Stress (40%): home=100, work=65, public=30
 * - Range Buffer (30%): dailyMiles / effectiveRange ratio
 * - Recovery Resilience (15%): longest_day_pattern, compounds with charging_access
 * - Climate Friction (15%): winter/hot penalties, compounds with public charging
 */

import type {
  MinimumViableRoutine,
  RoutineFitScore,
  StressFlag,
  BreakPoint,
  RoutineFitConfidence,
} from "@/types/v2";
import { buildRankedBreakpoints, type BreakpointContext } from "./breakpoint-rules";

interface VehicleBasics {
  model?: string;
  year?: number;
  real_world_range_mi?: number;
}

export function computeRoutineFit(
  mvr: MinimumViableRoutine,
  vehicle?: VehicleBasics
): RoutineFitScore {
  const effectiveDailyMiles = mvr.commute_miles_roundtrip
    ? mvr.commute_miles_roundtrip
    : (mvr.weekly_miles ?? 100) / 5;

  const effectiveRange = vehicle?.real_world_range_mi ?? 200;

  // ---- DIMENSION 1: Charging Stress (40%) ----
  let chargingScore: number;
  if (mvr.charging_access === "home") {
    chargingScore = 100;
  } else if (mvr.charging_access === "work") {
    chargingScore = 65;
  } else {
    chargingScore = 30;
  }

  // ---- DIMENSION 2: Range Buffer (30%) ----
  const dailyUsagePct = (effectiveDailyMiles / effectiveRange) * 100;
  let rangeScore: number;
  if (dailyUsagePct < 30) rangeScore = 100;
  else if (dailyUsagePct < 50) rangeScore = 80;
  else if (dailyUsagePct < 70) rangeScore = 55;
  else rangeScore = 25;

  // ---- DIMENSION 3: Recovery Resilience (15%) ----
  let recoveryScore: number;
  if (mvr.longest_day_pattern === "once_a_week") {
    recoveryScore = 50;
  } else if (mvr.longest_day_pattern === "monthly_trip") {
    recoveryScore = 75;
  } else {
    recoveryScore = 95;
  }

  // Cross-interaction: public charging + frequent long days = worse
  if (mvr.charging_access === "public" && mvr.longest_day_pattern === "once_a_week") {
    recoveryScore = Math.max(0, recoveryScore - 20);
  }
  if (mvr.charging_access === "work" && mvr.longest_day_pattern === "once_a_week") {
    recoveryScore = Math.max(0, recoveryScore - 10);
  }

  // ---- DIMENSION 4: Climate Friction (15%) ----
  let climateScore: number;
  if (mvr.climate === "winter") {
    climateScore = 60;
    if (mvr.charging_access === "public") climateScore = 40;
  } else if (mvr.climate === "hot") {
    climateScore = 75;
  } else {
    climateScore = 100;
  }

  // ---- WEIGHTED TOTAL ----
  const rawScore = Math.round(
    chargingScore * 0.4 +
    rangeScore * 0.3 +
    recoveryScore * 0.15 +
    climateScore * 0.15
  );
  const score = Math.max(0, Math.min(100, rawScore));

  // ---- LABEL ----
  const label: RoutineFitScore["label"] =
    score >= 80 ? "Great Fit"
    : score >= 65 ? "Good Fit"
    : score >= 45 ? "Mixed Fit"
    : "High Friction";

  // ---- MENTAL LOAD ----
  const mental_load: RoutineFitScore["mental_load"] =
    score >= 75 ? "low"
    : score >= 50 ? "medium"
    : "high";

  // ---- BREAKPOINTS (ranked, max 3) ----
  const ctx: BreakpointContext = { mvr, effectiveDailyMiles, effectiveRange, vehicle };
  const breakpoints_ranked = buildRankedBreakpoints(ctx);

  // ---- STRESS FLAGS (derived from breakpoints) ----
  const stress_flags = deriveStressFlags(breakpoints_ranked);

  // ---- CONFIDENCE ----
  const confidence: RoutineFitConfidence = {
    level: vehicle?.real_world_range_mi ? "medium" : "low",
    note: vehicle
      ? "Based on your routine and vehicle range estimate."
      : "Based on routine only. Adding vehicle details will improve accuracy.",
    has_vehicle_data: !!vehicle?.model,
    has_battery_data: false,
  };

  return {
    score_0_100: score,
    label,
    mental_load,
    stress_flags,
    breakpoints_ranked,
    confidence,
  };
}

// ============================================
// DERIVE STRESS FLAGS FROM BREAKPOINTS
// ============================================

function deriveStressFlags(breakpoints: BreakPoint[]): StressFlag[] {
  return breakpoints.map((bp) => ({
    id: bp.id,
    label: bp.title,
    severity: bp.impact === "High" ? "high" : bp.impact === "Medium" ? "medium" : "low",
    routine_citation: bp.trigger,
  }));
}
