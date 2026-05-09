/**
 * computeRoutineFit - V2 Primary Scoring Engine (Phase 4)
 *
 * Pure function: MVR + optional vehicle basics + optional charger context → RoutineFitScore
 * Client-safe (no fs imports). Works WITHOUT battery/VIN data.
 *
 * Scoring dimensions (weighted):
 * - Charging Stress (30%): access type + feasibility + subtype (L1/L2) + dwell time + charger density
 * - Range Buffer (25%): sigmoid curve — smooth, no step-bucket cliffs
 * - Recovery Resilience (10%): long-day frequency × charging access compound
 * - Climate Friction (10%): winter/hot × parking exposure compound × physics model
 * - Budget Fit (15%): effective price (MSRP - incentives) vs user budget
 * - Utility Fit (10%): body style match + towing compatibility
 *
 * Cross-dimension interactions applied after individual dimension scoring:
 * - Low charging × low range = compound penalty (multiplicative)
 * - Winter × street parking = extra climate friction
 * - Public charging × high mileage = recovery penalty escalation
 * - Catastrophic failure zone: collapses score when routine is near-unworkable
 *
 * Phase 4 additions:
 * - 4A: Sigmoid range buffer (replaces piecewise linear)
 * - 4B: Charger density integration (ChargerContext)
 * - 4C: Three-factor winter range model (climate × speed × battery)
 * - 4D: Incentive-adjusted budget scoring
 * - 4E: Penalty asymmetry (catastrophic failure zone)
 * - 4F: New outputs: failure_probability, top_risk_dimension, confidence_adjusted_score
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
  /** Federal + state incentive amount to subtract from MSRP for budget scoring */
  incentive_amount?: number;
  /** "used" applies a market discount to MSRP before budget scoring */
  purchase_type?: "new" | "used";
  /** Home charging type — used for L1+winter cross-penalty */
  home_charging_type?: "L1" | "L2" | "UNKNOWN";
  /** Maximum seating capacity — used for passenger fit scoring */
  seating_capacity?: number;
  /** Cargo volume behind rear seats (cu ft) — used for utility fit scoring */
  cargo_volume_cuft?: number;
  /** Battery winter sensitivity — inferred from chemistry. LFP loses ~35%, NMC811 ~25%, NMC ~18% */
  winter_sensitivity_band?: "mild" | "moderate" | "strong";
};

/** Charger availability context for the user's home area */
export type ChargerContext = {
  zip?: string;
  /** Total DCFC chargers in user's ZIP (from charger_density_v2.json) */
  dcfc_count?: number;
  /** Density tier from charger_density_v2.json */
  density_score?: "Excellent" | "Good" | "Moderate" | "Poor";
};

// ── Range buffer: sigmoid curve ───────────────────────────────────────────────
//
// Phase 4A: Replaces piecewise linear (Phase 2) with logistic sigmoid.
// Centered at 62% usage — steeper at both extremes, smooth throughout.
//
// Approximate values:
//   0%  → 100   30% → ~96   50% → ~82   60% → ~68
//  70%  →  ~50  80% → ~31   90% → ~17  100% →  ~8

function rangeScoreFromUsagePct(usagePct: number): number {
  const pct = Math.max(0, Math.min(100, usagePct));
  // Logistic sigmoid: 100 / (1 + e^(k*(pct - center)))
  const raw = 100 / (1 + Math.exp(0.085 * (pct - 62)));
  return Math.max(5, Math.round(raw));
}

// ── Budget fit: smooth exponential decay ──────────────────────────────────────
//
// score = 100 × e^(-2.3 × overBudgetRatio)
//   at budget     → 100
//   10% over      →  82
//   20% over      →  68
//   40% over      →  45
//  100%+ over     →  10

function budgetScoreFromRatio(overBudgetRatio: number): number {
  if (overBudgetRatio <= 0) return 100;
  return Math.max(10, Math.round(100 * Math.exp(-2.3 * overBudgetRatio)));
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function computeRoutineFit(
  mvr: MinimumViableRoutine,
  vehicle?: VehicleBasics,
  chargerCtx?: ChargerContext
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
        const shortfallRatio = (effectiveDailyMiles - l1RecoveryPerNight) / effectiveDailyMiles;
        chargingScore = Math.max(30, chargingScore - Math.round(shortfallRatio * 35));
      }
      // L1 cap: even when keeping up, adds dwell-time stress
      chargingScore = Math.min(chargingScore, 85);
    }

    // Short dwell time penalty
    if (mvr.overnight_dwell_hours != null && mvr.overnight_dwell_hours < 6) {
      chargingScore = Math.max(0, chargingScore - 15);
    } else if (mvr.overnight_dwell_hours != null && mvr.overnight_dwell_hours < 8) {
      chargingScore = Math.max(0, chargingScore - 8);
    }

    // 12B: L1 + winter cross-penalty — L1 can't precondition in cold
    if (vehicle?.home_charging_type === "L1" && mvr.climate === "winter") {
      chargingScore = Math.max(0, chargingScore - 8);
    }

    // Shared charger contention — raised from -8 to -12 for HIGH shared infra
    if (mvr.shared_charger || mvr.shared_infrastructure === "HIGH") {
      chargingScore = Math.max(0, chargingScore - 12);
    } else if (mvr.shared_infrastructure === "SOME") {
      chargingScore = Math.max(0, chargingScore - 5);
    }

  } else if (mvr.charging_access === "work") {
    chargingScore = 65;

    // 4B: Charger density affects work charging fallback reliability
    if (chargerCtx?.density_score === "Poor")           chargingScore = Math.max(0,   chargingScore - 8);
    else if (chargerCtx?.density_score === "Good")      chargingScore = Math.min(100, chargingScore + 5);
    else if (chargerCtx?.density_score === "Excellent") chargingScore = Math.min(100, chargingScore + 10);

    // Single public charger = no backup
    if (chargerCtx?.dcfc_count !== undefined && chargerCtx.dcfc_count <= 1) {
      chargingScore = Math.max(0, chargingScore - 6);
    }

  } else {
    // Public only — base is now 38 (up from 28); density can swing it ±20
    chargingScore = 38;

    // 4B: Density directly impacts public charging reliability
    if (chargerCtx?.density_score === "Poor")           chargingScore = Math.max(0,   chargingScore - 18);
    else if (chargerCtx?.density_score === "Moderate")  chargingScore = Math.max(0,   chargingScore - 6);
    else if (chargerCtx?.density_score === "Good")      chargingScore = Math.min(100, chargingScore + 10);
    else if (chargerCtx?.density_score === "Excellent") chargingScore = Math.min(100, chargingScore + 20);

    // Single charger = no redundancy
    if (chargerCtx?.dcfc_count !== undefined && chargerCtx.dcfc_count <= 1) {
      chargingScore = Math.max(0, chargingScore - 8);
    }

    // High usage on public charging compounds the problem
    const publicDailyPct = (effectiveDailyMiles / effectiveRange) * 100;
    if (publicDailyPct > 60) chargingScore = Math.max(10, chargingScore - 8);
  }

  // ── DIMENSION 2: Range Buffer (25%) ───────────────────────────────────────
  const peakDailyMiles = mvr.longest_day_miles
    ? Math.max(effectiveDailyMiles, mvr.longest_day_miles)
    : effectiveDailyMiles;

  // 4C: Three-factor winter range model (replaces flat multipliers)
  let adjustedRange = effectiveRange;
  if (mvr.climate === "winter") {
    // Climate factor varies by battery chemistry: LFP loses ~35%, NMC811 ~25%, NMC ~18%
    const climate_factor =
      vehicle?.winter_sensitivity_band === "mild"   ? 0.65   // LFP: severe cold loss
      : vehicle?.winter_sensitivity_band === "strong" ? 0.75  // NMC811: high energy density but poor cold
      : 0.82;                                                  // NMC default (moderate)
    const speed_factor   = effectiveDailyMiles > 70 ? 0.96 : 1.0;  // highway drain in cold
    const battery_factor = vehicle?.has_heat_pump ? 1.09 : 1.0;     // heat pump recovers ~9%
    adjustedRange = effectiveRange * climate_factor * speed_factor * battery_factor;
    // Street parking: precondition unavailable → extra cold penalty
    if (mvr.parking_exposure === "street") adjustedRange *= 0.95;
    else if (mvr.parking_exposure === "outdoor") adjustedRange *= 0.98;
  } else if (mvr.climate === "hot") {
    // AC load in extreme heat
    adjustedRange *= 0.93;
  }

  // SOC buffer
  if (mvr.min_comfortable_soc && mvr.min_comfortable_soc > 0) {
    adjustedRange *= (1 - mvr.min_comfortable_soc / 100);
  }

  const dailyUsagePct = (peakDailyMiles / adjustedRange) * 100;
  let rangeScore = rangeScoreFromUsagePct(dailyUsagePct);

  // ── DIMENSION 3: Recovery Resilience (10%) ────────────────────────────────
  // Base: how often does the user push range limits?
  let recoveryScore: number;
  if (mvr.longest_day_pattern === "once_a_week")       recoveryScore = 45;
  else if (mvr.longest_day_pattern === "monthly_trip") recoveryScore = 72;
  else                                                  recoveryScore = 95;

  // Charging access shapes recovery ability: home L2 = reliable nightly reset
  if (mvr.charging_access === "home") {
    recoveryScore = Math.min(100, recoveryScore + 15);
  } else if (mvr.charging_access === "work") {
    recoveryScore = Math.min(100, recoveryScore + 5);
    if (mvr.longest_day_pattern === "once_a_week") {
      recoveryScore = Math.max(0, recoveryScore - 10);
    }
  } else {
    // Public only: recovery depends heavily on density
    if (mvr.longest_day_pattern === "once_a_week") {
      recoveryScore = Math.max(0, recoveryScore - 20);
    }
    if (chargerCtx?.density_score === "Excellent") recoveryScore = Math.min(100, recoveryScore + 12);
    else if (chargerCtx?.density_score === "Good")  recoveryScore = Math.min(100, recoveryScore + 6);
    else if (chargerCtx?.density_score === "Poor")  recoveryScore = Math.max(0,   recoveryScore - 10);
  }

  if (mvr.charging_access === "public" && effectiveDailyMiles > 80) {
    recoveryScore = Math.max(0, recoveryScore - 10);
  }

  // 12D: DC fast charge speed affects road-trip recovery ability
  if (mvr.longest_day_pattern === "once_a_week" || mvr.longest_day_pattern === "monthly_trip") {
    if (vehicle?.dc_fast_kw !== undefined) {
      if (vehicle.dc_fast_kw >= 150)     recoveryScore = Math.min(100, recoveryScore + 10);
      else if (vehicle.dc_fast_kw < 75)  recoveryScore = Math.max(0,   recoveryScore - 12);
    }
  }

  // ── DIMENSION 4: Climate Friction (10%) ───────────────────────────────────
  let climateScore: number;
  if (mvr.climate === "winter") {
    climateScore = 60;
    if (mvr.charging_access === "public") climateScore = 38;
    if (mvr.parking_exposure === "street") {
      climateScore = Math.max(0, climateScore - 12);
    } else if (mvr.parking_exposure === "outdoor") {
      climateScore = Math.max(0, climateScore - 6);
    }
    if (vehicle?.has_heat_pump) climateScore = Math.min(100, climateScore + 8);
  } else if (mvr.climate === "hot") {
    climateScore = 75;
    if (vehicle?.dc_fast_kw && vehicle.dc_fast_kw >= 150) climateScore = 80;
  } else {
    climateScore = 100;
  }

  // ── DIMENSION 5: Budget Fit (15%) ─────────────────────────────────────────
  // null = dimension excluded from weighted sum (no data to score it)
  let budgetScore: number | null = null;
  if (mvr.budget_max && vehicle?.msrp_usd != null && vehicle.msrp_usd > 0) {
    // 12C: Used market discount — used EVs trade below MSRP, ~6% per year up to 30%
    const currentYear = new Date().getFullYear();
    const vehicleAge = vehicle.year ? Math.max(0, currentYear - vehicle.year) : 0;
    const usedDiscount = vehicle.purchase_type === "used"
      ? Math.min(0.30, vehicleAge * 0.06)
      : 0;
    // 4D: Subtract used discount + incentives from MSRP for effective price
    const effectivePrice = vehicle.msrp_usd * (1 - usedDiscount) - (vehicle.incentive_amount ?? 0);
    const overBudgetRatio = (effectivePrice - mvr.budget_max) / mvr.budget_max;
    budgetScore = budgetScoreFromRatio(overBudgetRatio);
  }
  // When budget or vehicle price is absent, this dimension is excluded (null)
  // so the other dimensions' weights are renormalized to sum to 1.0.

  // ── DIMENSION 6: Utility Fit (10%) ────────────────────────────────────────
  // null = excluded when there's no vehicle or user preference to evaluate against
  let utilityScore: number | null = null;
  const hasUtilityData = !!(vehicle?.sub_category || mvr.towing_needs === "heavy" || mvr.towing_needs === "light");
  if (hasUtilityData) {
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

    // Seating fit — penalize if vehicle can't seat the requested passenger count
    if (mvr.passenger_count && vehicle?.seating_capacity) {
      if (mvr.passenger_count > vehicle.seating_capacity) {
        const shortfall = mvr.passenger_count - vehicle.seating_capacity;
        utilityScore = Math.max(0, utilityScore - Math.min(30, shortfall * 15));
      }
    }

    // Cargo fit — SUV buyers needing cargo space: penalize low-cargo vehicles (<20 cu ft)
    if (mvr.body_style === "suv" && vehicle?.cargo_volume_cuft !== undefined) {
      if (vehicle.cargo_volume_cuft < 20) {
        utilityScore = Math.max(0, utilityScore - 15);
      }
    }
  }

  // ── 12A: CONFIDENCE PENALTY — missing range data inflates uncertainty ────────
  // Applied only to range score (the most impacted dimension). Recovery is now
  // shaped by real infrastructure data so we don't double-penalize it.
  const hasRangeData = !!vehicle?.real_world_range_mi;
  if (!hasRangeData) {
    rangeScore = Math.max(0, rangeScore - 8);
  }

  // ── CROSS-DIMENSION INTERACTIONS ──────────────────────────────────────────

  let interactionMultiplier = 1.0;

  // Compound 1: Low charging AND tight range
  if (chargingScore < 50 && rangeScore < 55) {
    interactionMultiplier *= 0.93;
  }

  // Compound 2: Winter + street parking + public charging
  if (mvr.climate === "winter" && mvr.parking_exposure === "street" && mvr.charging_access === "public") {
    interactionMultiplier *= 0.91;
  }

  // Compound 3: High mileage + no home charging
  if (effectiveDailyMiles > 100 && mvr.charging_access !== "home") {
    interactionMultiplier *= 0.95;
  }

  // 4E: Penalty asymmetry — catastrophic failure zone
  // Near-failure conditions hurt more than near-perfect conditions help
  const catastrophicRisk =
    dailyUsagePct > 90 ||
    (mvr.charging_access === "public" &&
      chargerCtx?.density_score === "Poor" &&
      mvr.longest_day_pattern === "once_a_week");

  if (catastrophicRisk) {
    interactionMultiplier *= 0.85;
  }

  // ── WEIGHTED TOTAL — renormalize when budget/utility are absent ───────────
  // Base weights: charging 30%, range 25%, recovery 10%, climate 10%, budget 15%, utility 10%
  // When budget or utility are null (no data), redistribute their weight to the
  // core operational dimensions (charging + range) proportionally.
  let totalWeight = 0.75; // charging + range + recovery + climate always present
  let rawScore =
    chargingScore * 0.30 +
    rangeScore    * 0.25 +
    recoveryScore * 0.10 +
    climateScore  * 0.10;

  if (budgetScore !== null) {
    rawScore    += budgetScore * 0.15;
    totalWeight += 0.15;
  }
  if (utilityScore !== null) {
    rawScore    += utilityScore * 0.10;
    totalWeight += 0.10;
  }

  // Renormalize to a 0-100 scale
  rawScore = rawScore / totalWeight;

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
  const hasRange  = !!vehicle?.real_world_range_mi;
  const hasMsrp   = vehicle?.msrp_usd != null && vehicle.msrp_usd > 0;
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

  // ── 4F: DERIVED OUTPUT FIELDS ─────────────────────────────────────────────

  // failure_probability: inverse of score, amplified by interaction penalty depth
  const interactionPenaltyDepth = 1 - interactionMultiplier;
  const failure_probability = Math.max(0, Math.min(1,
    1 - (score / 100) * (1 - 0.3 * interactionPenaltyDepth)
  ));

  // top_risk_dimension: the weakest scoring dimension among present dimensions
  const dimScores: Record<string, number> = {
    charging: chargingScore,
    range: rangeScore,
    recovery: recoveryScore,
    climate: climateScore,
    ...(budgetScore !== null  ? { budget:  budgetScore  } : {}),
    ...(utilityScore !== null ? { utility: utilityScore } : {}),
  };

  const top_risk_dimension = (Object.keys(dimScores) as Array<keyof typeof dimScores>)
    .reduce((a, b) => dimScores[a] < dimScores[b] ? a : b) as RoutineFitScore["top_risk_dimension"];

  // confidence_adjusted_score: small nudge for missing data (not a 25% hammer)
  // The dimension penalties already account for uncertainty — keep multiplier tight.
  const confMultiplier =
    confidenceLevel === "high"   ? 1.0
    : confidenceLevel === "medium" ? 0.95
    :                               0.88;
  const confidence_adjusted_score = Math.round(score * confMultiplier);

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
      budget: budgetScore ?? undefined,
      utility: utilityScore ?? undefined,
    },
    failure_probability,
    top_risk_dimension,
    confidence_adjusted_score,
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
