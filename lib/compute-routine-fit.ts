/**
 * computeRoutineFit - V2 Primary Scoring Engine
 *
 * Pure function: MVR + optional vehicle basics → RoutineFitScore
 * Client-safe (no fs imports). Works WITHOUT battery/VIN data.
 *
 * Scoring dimensions (weighted):
 * - Charging Stress (30%): access type + feasibility + subtype (L1/L2) + dwell time
 * - Range Buffer (25%): continuous usage curve — no step-bucket cliffs
 * - Recovery Resilience (10%): long-day frequency × charging access compound
 * - Climate Friction (10%): winter/hot × parking exposure compound
 * - Budget Fit (15%): vehicle MSRP vs user budget
 * - Utility Fit (10%): body style match + towing compatibility
 *
 * Cross-dimension interactions applied after individual dimension scoring:
 * - Low charging × low range = compound penalty (multiplicative, not additive)
 * - Winter × street parking = extra climate friction
 * - Public charging × high mileage = recovery penalty escalation
 *
 * Uncertainty: missing vehicle data is tracked and propagates to confidence level.
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
  /** DC fast charge max kW — used to assess road-trip feasibility */
  dc_fast_kw?: number;
  /** True if vehicle has heat pump — reduces winter climate friction */
  has_heat_pump?: boolean;
};

// ── Range buffer: continuous curve ────────────────────────────────────────────
//
// Replaces four hard step buckets (<30%→100, <50%→80, <70%→55, else→25).
// A linear interpolation within each meaningful zone produces smooth scores:
//   0% usage → 100   (always charge to full, totally carefree)
//  30% usage → 100   (generous buffer, no friction)
//  50% usage →  78   (comfortable but worth noting)
//  70% usage →  48   (starts to require planning)
//  85% usage →  22   (meaningful daily stress)
// 100% usage →   5   (not viable without top-ups)
//
// Formula: piecewise linear segments between control points.

const RANGE_CURVE_POINTS: [number, number][] = [
  [0,   100],
  [30,  100],
  [50,   78],
  [70,   48],
  [85,   22],
  [100,   5],
];

function rangeScoreFromUsagePct(usagePct: number): number {
  const pct = Math.max(0, Math.min(100, usagePct));
  for (let i = 1; i < RANGE_CURVE_POINTS.length; i++) {
    const [x0, y0] = RANGE_CURVE_POINTS[i - 1];
    const [x1, y1] = RANGE_CURVE_POINTS[i];
    if (pct <= x1) {
      const t = (pct - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return 5;
}

// ── Budget fit: smooth curve ──────────────────────────────────────────────────
//
// Replaces four hard thresholds (0%→100, 20%→70, 50%→40, 50%+→15).
// Smooth exponential decay above budget:
//   at budget     → 100
//   10% over      →  82
//   20% over      →  68
//   40% over      →  45
//   70% over      →  22
//  100%+ over     →  10

function budgetScoreFromRatio(overBudgetRatio: number): number {
  if (overBudgetRatio <= 0) return 100;
  // Exponential decay: score = 100 * e^(-2.3 * ratio)
  return Math.max(10, Math.round(100 * Math.exp(-2.3 * overBudgetRatio)));
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function computeRoutineFit(
  mvr: MinimumViableRoutine,
  vehicle?: VehicleBasics
): RoutineFitScore {
  const effectiveDailyMiles = mvr.commute_miles_roundtrip
    ? mvr.commute_miles_roundtrip
    : (mvr.weekly_miles ?? 100) / 5;

  const effectiveRange = vehicle?.real_world_range_mi ?? 200;

  // ── DIMENSION 1: Charging Stress (30%) ────────────────────────────────────
  let chargingScore: number;

  if (mvr.charging_access === "home") {
    chargingScore = 100;

    // Feasibility modifiers
    if (mvr.can_install_charger === "need_permission") chargingScore = 80;
    else if (mvr.can_install_charger === "no")         chargingScore = 52;

    // L1-only penalty: Level 1 adds ~4–5 miles/hr — may not recover large daily usage
    if (mvr.home_charging_type === "L1") {
      const l1RecoveryPerNight = Math.min((mvr.overnight_dwell_hours ?? 10) * 4.5, 45);
      if (effectiveDailyMiles > l1RecoveryPerNight) {
        // L1 can't keep up — penalty proportional to the shortfall
        const shortfallRatio = (effectiveDailyMiles - l1RecoveryPerNight) / effectiveDailyMiles;
        chargingScore = Math.max(30, chargingScore - Math.round(shortfallRatio * 35));
      }
      // Even if L1 keeps up, it adds dwell-time stress
      chargingScore = Math.min(chargingScore, 85);
    }

    // Short dwell time penalty (regardless of charger type)
    if (mvr.overnight_dwell_hours != null && mvr.overnight_dwell_hours < 6) {
      chargingScore = Math.max(0, chargingScore - 15);
    } else if (mvr.overnight_dwell_hours != null && mvr.overnight_dwell_hours < 8) {
      chargingScore = Math.max(0, chargingScore - 8);
    }

    // Shared charger contention
    if (mvr.shared_charger) chargingScore = Math.max(0, chargingScore - 8);

  } else if (mvr.charging_access === "work") {
    chargingScore = 65;
    // Work charging on L1 at a DCFC-primary vehicle is fine; L2 at work = stronger
    // No sub-type modifier needed here — work charging is what it is

  } else {
    // Public only
    chargingScore = 28;
    // High usage on public charging is worse than low usage
    const dailyUsagePct = (effectiveDailyMiles / effectiveRange) * 100;
    if (dailyUsagePct > 60) chargingScore = Math.max(10, chargingScore - 8);
  }

  // ── DIMENSION 2: Range Buffer (25%) ───────────────────────────────────────
  // Use longest_day_miles if provided and greater than average daily
  const peakDailyMiles = mvr.longest_day_miles
    ? Math.max(effectiveDailyMiles, mvr.longest_day_miles)
    : effectiveDailyMiles;

  // Climate-adjusted range
  let adjustedRange = effectiveRange;
  if (mvr.climate === "winter") {
    // Heat pump vehicles lose less range in cold
    const heatPumpMultiplier = vehicle?.has_heat_pump ? 0.87 : 0.80;
    if (mvr.parking_exposure === "street")       adjustedRange *= heatPumpMultiplier - 0.03;
    else if (mvr.parking_exposure === "outdoor") adjustedRange *= heatPumpMultiplier;
    // garage: heat pump vehicle slightly better, otherwise neutral
    else if (vehicle?.has_heat_pump)             adjustedRange *= 0.92;
  } else if (mvr.climate === "hot") {
    // AC load in extreme heat
    adjustedRange *= 0.93;
  }

  // SOC buffer
  if (mvr.min_comfortable_soc && mvr.min_comfortable_soc > 0) {
    adjustedRange *= (1 - mvr.min_comfortable_soc / 100);
  }

  const dailyUsagePct = (peakDailyMiles / adjustedRange) * 100;
  const rangeScore = rangeScoreFromUsagePct(dailyUsagePct);

  // ── DIMENSION 3: Recovery Resilience (10%) ────────────────────────────────
  let recoveryScore: number;
  if (mvr.longest_day_pattern === "once_a_week")   recoveryScore = 50;
  else if (mvr.longest_day_pattern === "monthly_trip") recoveryScore = 75;
  else                                              recoveryScore = 95;

  // Cross-interaction: public charging + frequent long days compounds
  if (mvr.charging_access === "public" && mvr.longest_day_pattern === "once_a_week") {
    recoveryScore = Math.max(0, recoveryScore - 22);
  } else if (mvr.charging_access === "work" && mvr.longest_day_pattern === "once_a_week") {
    recoveryScore = Math.max(0, recoveryScore - 12);
  }

  // High daily mileage with public charging = harder to recover
  if (mvr.charging_access === "public" && effectiveDailyMiles > 80) {
    recoveryScore = Math.max(0, recoveryScore - 10);
  }

  // ── DIMENSION 4: Climate Friction (10%) ───────────────────────────────────
  let climateScore: number;
  if (mvr.climate === "winter") {
    climateScore = 60;
    if (mvr.charging_access === "public") climateScore = 38;
    // Parking exposure compounds winter friction
    if (mvr.parking_exposure === "street") {
      climateScore = Math.max(0, climateScore - 12);
    } else if (mvr.parking_exposure === "outdoor") {
      climateScore = Math.max(0, climateScore - 6);
    }
    // Heat pump partially offsets winter friction
    if (vehicle?.has_heat_pump) climateScore = Math.min(100, climateScore + 8);
  } else if (mvr.climate === "hot") {
    climateScore = 75;
    // DC fast charge vehicles handle heat better (active thermal management)
    if (vehicle?.dc_fast_kw && vehicle.dc_fast_kw >= 150) climateScore = 80;
  } else {
    climateScore = 100;
  }

  // ── DIMENSION 5: Budget Fit (15%) ─────────────────────────────────────────
  let budgetScore: number;
  if (mvr.budget_max && vehicle?.msrp_usd) {
    const overBudgetRatio = (vehicle.msrp_usd - mvr.budget_max) / mvr.budget_max;
    budgetScore = budgetScoreFromRatio(overBudgetRatio);
  } else {
    budgetScore = 75; // neutral when no budget or no price
  }

  // ── DIMENSION 6: Utility Fit (10%) ────────────────────────────────────────
  let utilityScore: number;
  if (mvr.body_style && mvr.body_style !== "any" && vehicle?.sub_category) {
    utilityScore = vehicle.sub_category === mvr.body_style ? 100 : 50;
  } else {
    utilityScore = 85;
  }

  if (mvr.towing_needs === "heavy" && vehicle?.sub_category) {
    if (vehicle.sub_category === "sedan" || vehicle.sub_category === "hatchback") {
      utilityScore = Math.min(utilityScore, 28);
    }
  } else if (mvr.towing_needs === "light" && vehicle?.sub_category) {
    if (vehicle.sub_category === "sedan" || vehicle.sub_category === "hatchback") {
      utilityScore = Math.min(utilityScore, 52);
    }
  }

  // ── CROSS-DIMENSION INTERACTIONS ──────────────────────────────────────────
  // Applied as a multiplier on the weighted total to avoid double-counting.
  // Each interaction flag reduces the final score multiplicatively.

  let interactionMultiplier = 1.0;

  // Compound 1: Low charging AND tight range — both stresses at once
  // (e.g. public charging + 65% daily usage = harder than either alone)
  if (chargingScore < 50 && rangeScore < 55) {
    interactionMultiplier *= 0.93;
  }

  // Compound 2: Winter + street parking + public charging — triple friction
  if (mvr.climate === "winter" && mvr.parking_exposure === "street" && mvr.charging_access === "public") {
    interactionMultiplier *= 0.91;
  }

  // Compound 3: High mileage + no home charging — no nightly recovery
  if (effectiveDailyMiles > 100 && mvr.charging_access !== "home") {
    interactionMultiplier *= 0.95;
  }

  // ── WEIGHTED TOTAL ─────────────────────────────────────────────────────────
  const rawScore =
    chargingScore * 0.30 +
    rangeScore    * 0.25 +
    recoveryScore * 0.10 +
    climateScore  * 0.10 +
    budgetScore   * 0.15 +
    utilityScore  * 0.10;

  const score = Math.max(0, Math.min(100, Math.round(rawScore * interactionMultiplier)));

  // ── LABEL ──────────────────────────────────────────────────────────────────
  const label: RoutineFitScore["label"] =
    score >= 80 ? "Great Fit"
    : score >= 65 ? "Good Fit"
    : score >= 45 ? "Mixed Fit"
    : "High Friction";

  // ── MENTAL LOAD ────────────────────────────────────────────────────────────
  const mental_load: RoutineFitScore["mental_load"] =
    score >= 75 ? "low" : score >= 50 ? "medium" : "high";

  // ── BREAKPOINTS ────────────────────────────────────────────────────────────
  const ctx: BreakpointContext = { mvr, effectiveDailyMiles, effectiveRange, vehicle };
  const breakpoints_ranked = buildRankedBreakpoints(ctx);

  // ── STRESS FLAGS ───────────────────────────────────────────────────────────
  const stress_flags = deriveStressFlags(breakpoints_ranked);

  // ── CONFIDENCE ─────────────────────────────────────────────────────────────
  // Tracks what data is available and how much it affects accuracy
  const hasRange = !!vehicle?.real_world_range_mi;
  const hasMsrp  = !!vehicle?.msrp_usd;
  const hasSubCat = !!vehicle?.sub_category;

  const confidenceLevel: RoutineFitConfidence["level"] =
    hasRange && hasMsrp && hasSubCat ? "high"
    : hasRange                       ? "medium"
    :                                  "low";

  const confidenceNote =
    hasRange && hasMsrp
      ? "Based on your routine, vehicle range, and price data."
      : hasRange
        ? "Based on your routine and vehicle range. Adding price will improve budget fit accuracy."
        : vehicle?.model
          ? "Vehicle identified but range data unavailable — using class average."
          : "Based on routine only. Add a specific vehicle for a more accurate score.";

  const confidence: RoutineFitConfidence = {
    level: confidenceLevel,
    note: confidenceNote,
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
    dimensions: {
      charging: chargingScore,
      range: rangeScore,
      recovery: recoveryScore,
      climate: climateScore,
      budget: budgetScore,
      utility: utilityScore,
    },
  };
}

// ── Stress flags from breakpoints ─────────────────────────────────────────────

function deriveStressFlags(breakpoints: BreakPoint[]): StressFlag[] {
  return breakpoints.map((bp) => ({
    id: bp.id,
    label: bp.title,
    severity: bp.impact === "High" ? "high" : bp.impact === "Medium" ? "medium" : "low",
    routine_citation: bp.trigger,
  }));
}
