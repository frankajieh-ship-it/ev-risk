/**
 * computeRoutineFit - V2 Primary Scoring Engine
 *
 * Pure function: MVR + optional vehicle basics → RoutineFitScore
 * Client-safe (no fs imports). Works WITHOUT battery/VIN data.
 *
 * Scoring dimensions (weighted):
 * - Charging Stress (30%): home=100, work=65, public=30 + home feasibility modifiers
 * - Range Buffer (25%): dailyMiles / effectiveRange ratio + deep fit modifiers
 * - Recovery Resilience (10%): longest_day_pattern, compounds with charging_access
 * - Climate Friction (10%): winter/hot penalties, compounds with parking exposure
 * - Budget Fit (15%): vehicle MSRP vs user budget
 * - Utility Fit (10%): body style match + towing compatibility
 */

import type {
  MinimumViableRoutine,
  RoutineFitScore,
  StressFlag,
  BreakPoint,
  RoutineFitConfidence,
} from "@/types/v2";
import { buildRankedBreakpoints, type BreakpointContext } from "./breakpoint-rules";

export type VehicleBasics = {
  model?: string;
  year?: number;
  real_world_range_mi?: number;
  msrp_usd?: number;
  sub_category?: string;
};

export function computeRoutineFit(
  mvr: MinimumViableRoutine,
  vehicle?: VehicleBasics
): RoutineFitScore {
  const effectiveDailyMiles = mvr.commute_miles_roundtrip
    ? mvr.commute_miles_roundtrip
    : (mvr.weekly_miles ?? 100) / 5;

  const effectiveRange = vehicle?.real_world_range_mi ?? 200;

  // ---- DIMENSION 1: Charging Stress (30%) ----
  let chargingScore: number;
  if (mvr.charging_access === "home") {
    chargingScore = 100;

    // Home feasibility modifiers
    if (mvr.can_install_charger === "need_permission") {
      chargingScore = 80;
    } else if (mvr.can_install_charger === "no") {
      chargingScore = 55;
    }

    // Short dwell time penalty (Level 1 may not fully recharge)
    if (mvr.overnight_dwell_hours != null && mvr.overnight_dwell_hours < 8) {
      chargingScore = Math.max(0, chargingScore - 10);
    }
  } else if (mvr.charging_access === "work") {
    chargingScore = 65;
  } else {
    chargingScore = 30;
  }

  // ---- DIMENSION 2: Range Buffer (25%) ----
  // Use longest_day_miles if provided and greater than average daily
  const peakDailyMiles = mvr.longest_day_miles
    ? Math.max(effectiveDailyMiles, mvr.longest_day_miles)
    : effectiveDailyMiles;

  // Adjust effective range for parking exposure + winter
  let adjustedRange = effectiveRange;
  if (mvr.climate === "winter") {
    if (mvr.parking_exposure === "street") {
      adjustedRange *= 0.80; // 20% winter range loss, no preconditioning
    } else if (mvr.parking_exposure === "outdoor") {
      adjustedRange *= 0.85; // 15% winter range loss
    }
    // garage = no extra penalty (preconditioning possible)
  }

  // Reduce effective range by minimum comfortable SOC buffer
  if (mvr.min_comfortable_soc && mvr.min_comfortable_soc > 0) {
    adjustedRange *= (1 - mvr.min_comfortable_soc / 100);
  }

  const dailyUsagePct = (peakDailyMiles / adjustedRange) * 100;
  let rangeScore: number;
  if (dailyUsagePct < 30) rangeScore = 100;
  else if (dailyUsagePct < 50) rangeScore = 80;
  else if (dailyUsagePct < 70) rangeScore = 55;
  else rangeScore = 25;

  // ---- DIMENSION 3: Recovery Resilience (10%) ----
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

  // ---- DIMENSION 4: Climate Friction (10%) ----
  let climateScore: number;
  if (mvr.climate === "winter") {
    climateScore = 60;
    if (mvr.charging_access === "public") climateScore = 40;
    // Outdoor parking in winter adds extra friction
    if (mvr.parking_exposure === "street") climateScore = Math.max(0, climateScore - 10);
    else if (mvr.parking_exposure === "outdoor") climateScore = Math.max(0, climateScore - 5);
  } else if (mvr.climate === "hot") {
    climateScore = 75;
  } else {
    climateScore = 100;
  }

  // ---- DIMENSION 5: Budget Fit (15%) ----
  let budgetScore: number;
  if (mvr.budget_max && vehicle?.msrp_usd) {
    const overBudgetRatio = (vehicle.msrp_usd - mvr.budget_max) / mvr.budget_max;
    if (overBudgetRatio <= 0) budgetScore = 100;        // within budget
    else if (overBudgetRatio <= 0.2) budgetScore = 70;   // 0-20% over
    else if (overBudgetRatio <= 0.5) budgetScore = 40;   // 20-50% over
    else budgetScore = 15;                                // 50%+ over
  } else {
    budgetScore = 75; // neutral when no budget or no vehicle price
  }

  // ---- DIMENSION 6: Utility Fit (10%) ----
  let utilityScore: number;
  if (mvr.body_style && mvr.body_style !== "any" && vehicle?.sub_category) {
    if (vehicle.sub_category === mvr.body_style) {
      utilityScore = 100; // exact match
    } else {
      utilityScore = 50; // mismatch
    }
  } else {
    utilityScore = 85; // neutral — no preference or no vehicle data
  }

  // Towing penalty: sedan/hatchback can't tow well
  if (mvr.towing_needs === "heavy" && vehicle?.sub_category) {
    if (vehicle.sub_category === "sedan" || vehicle.sub_category === "hatchback") {
      utilityScore = Math.min(utilityScore, 30);
    }
  } else if (mvr.towing_needs === "light" && vehicle?.sub_category) {
    if (vehicle.sub_category === "sedan" || vehicle.sub_category === "hatchback") {
      utilityScore = Math.min(utilityScore, 50);
    }
  }

  // ---- WEIGHTED TOTAL ----
  const rawScore = Math.round(
    chargingScore * 0.30 +
    rangeScore * 0.25 +
    recoveryScore * 0.10 +
    climateScore * 0.10 +
    budgetScore * 0.15 +
    utilityScore * 0.10
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
