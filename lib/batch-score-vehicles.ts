/**
 * Batch Vehicle Scorer — Phase 5/6 Unified Score
 *
 * Scores all vehicles from range_delta.csv against a user's routine.
 * Phase 5/6: Unified final score = weighted composite of 4 components:
 *   routine_fit (45%) + hardware_match (25%) + ownership_cost (20%) + reliability (10%)
 *
 * Pure function — no I/O, no external calls.
 */

import { computeRoutineFit } from "./compute-routine-fit";
import { computeRoutineFitV2 } from "./compute-routine-fit-v2";
import { classifyVehicle } from "./vehicle-classifier";
import { computeScoreImprovements } from "./compute-score-improvements";
import { getTraits, reliabilityTierToScore } from "./specs-scorer";
import { computeOffoScore } from "./offo-score";
import type { MinimumViableRoutine, OffoScore } from "@/types/v2";
import type { RangeDeltaRow } from "./data";
import type { VehicleRecommendation, FitDimensions, TieChips } from "@/types/recommendations";
import type { WeatherData } from "@/types/routine-v2";
import type { SpecsMatchResult } from "./specs-scorer";

/** Known two-word make prefixes */
const TWO_WORD_MAKES = ["mercedes"];

/**
 * Parse make and short model from full model string.
 * e.g. "Tesla Model 3 Long Range" → { make: "Tesla", model_short: "Model 3 Long Range" }
 */
function extractMakeAndModel(fullModel: string): { make: string; model_short: string } {
  const words = fullModel.split(" ");
  const firstLower = words[0].toLowerCase();

  if (TWO_WORD_MAKES.some(m => firstLower.startsWith(m)) && words.length > 2) {
    return { make: words.slice(0, 2).join(" "), model_short: words.slice(2).join(" ") };
  }
  return { make: words[0], model_short: words.slice(1).join(" ") };
}

export interface RealTimeData {
  weather?: WeatherData;
  chargerCount?: number;
}

// ---------------------------------------------------------------------------
// Ownership cost scoring (deterministic — no LLM)
// ---------------------------------------------------------------------------

/**
 * Compute a 0–100 ownership cost score.
 * Components: price vs budget (55%) + vehicle efficiency (35%) + charging cost (10%)
 */
function computeOwnershipCostScore(
  row: RangeDeltaRow,
  mvr: MinimumViableRoutine
): number {
  // Effective price after federal incentive
  const incentiveAmount = row.incentive_new ? 7500 : 0;
  const effectivePrice = (row.msrp_usd ?? 50000) - incentiveAmount;

  // Price score: exponential decay above budget.
  // Default 75k (not 60k) — when user hasn't set a budget, don't penalise
  // mid-premium vehicles that are perfectly reasonable choices.
  const budgetMax = mvr.budget_max ?? 75000;
  const budgetRatio = effectivePrice / budgetMax;
  const priceScore = Math.min(100, Math.max(0, Math.round(100 * Math.exp(-1.8 * (budgetRatio - 1)))));

  // Efficiency score: higher MPGe = lower running cost
  const traits = getTraits(row.model);
  const mpge = traits.efficiency_mpge ?? 100;
  const efficiencyScore = Math.min(100, Math.round((mpge / 130) * 100));

  // Charging cost score: penalize slow onboard AC for L1/L2 home chargers
  // Vehicles with weak AC chargers (< 7.2 kW) cost more in L1/L2 time-of-use for high-mileage users
  let chargingCostScore = 100;
  const onboardAcKw = traits.onboard_ac_kw ?? 11;
  const dailyMiles = mvr.commute_miles_roundtrip ?? (mvr.weekly_miles ?? 100) / 5;
  if (mvr.home_charging_type === "L1" && onboardAcKw < 7 && dailyMiles > 30) {
    // Very slow L1-equivalent onboard AC + heavy usage = higher effective energy cost
    chargingCostScore = 70;
  } else if (onboardAcKw >= 19) {
    // 19.2 kW+ (bidirectional-capable trucks) = excellent L2 utilization bonus
    chargingCostScore = 100;
  } else if (onboardAcKw < 7.4) {
    // Below 7.4 kW is slower than typical L2 EVSE output — minor penalty
    chargingCostScore = 85;
  }

  return Math.round(priceScore * 0.55 + efficiencyScore * 0.35 + chargingCostScore * 0.10);
}

// ---------------------------------------------------------------------------
// Tie-break helpers (preserved from Phase 2)
// ---------------------------------------------------------------------------

function computeTieScore(
  dimensions: FitDimensions,
  mvr: MinimumViableRoutine
): number {
  const homePriority = mvr.charging_access === "home";
  const pw = mvr.priority_weights;

  // If the user ranked priorities, use their order to shape tie-break weights.
  // Each priority maps to a dimension; top pick gets +0.15, second +0.08, third +0.04.
  const priorityBoosts: Record<string, number> = {};
  if (pw && pw.length > 0) {
    const dimMap: Record<string, string> = {
      range: "range", charging: "charging", cost: "budget",
      reliability: "recovery", interior: "utility", tech: "range",
    };
    const boosts = [0.15, 0.08, 0.04];
    pw.slice(0, 3).forEach((key, i) => {
      const dim = dimMap[key];
      if (dim) priorityBoosts[dim] = (priorityBoosts[dim] ?? 0) + boosts[i];
    });
  }

  const boost = (dim: string) => priorityBoosts[dim] ?? 0;

  let score =
    dimensions.range    * (homePriority ? 0.35 : 0.25) + boost("range") * dimensions.range / 100 +
    dimensions.charging * (homePriority ? 0.20 : 0.40) + boost("charging") * dimensions.charging / 100 +
    dimensions.recovery * (homePriority ? 0.10 : 0.15) + boost("recovery") * dimensions.recovery / 100;
  let totalW = homePriority ? 0.65 : 0.80;

  if (dimensions.budget !== undefined) {
    score   += dimensions.budget * 0.20 + boost("budget") * dimensions.budget / 100;
    totalW  += 0.20;
  }
  if (dimensions.utility !== undefined) {
    score   += dimensions.utility * 0.15 + boost("utility") * dimensions.utility / 100;
    totalW  += 0.15;
  }

  return score / totalW;
}

function getTopStressFlag(dimensions: FitDimensions): string {
  const candidates: [number, string][] = [
    [dimensions.range,    "Range buffer is tight for your longest day"],
    [dimensions.charging, "Charging setup adds weekly friction"],
    [dimensions.recovery, "Recovery on long days may need planning"],
    [dimensions.climate,  "Cold weather will reduce effective range"],
  ];
  if (dimensions.budget !== undefined)  candidates.push([dimensions.budget,  "Likely above your budget band"]);
  if (dimensions.utility !== undefined) candidates.push([dimensions.utility, "Body style or towing doesn't match well"]);

  candidates.sort((a, b) => a[0] - b[0]);
  return candidates[0][1];
}

function computeTieChips(dimensions: FitDimensions, subCategory: string): TieChips {
  return {
    buffer:   dimensions.range    >= 70 ? "strong" : dimensions.range    >= 45 ? "ok"       : "tight",
    charging: dimensions.charging >= 70 ? "low"    : dimensions.charging >= 45 ? "medium"   : "high",
    winter:   dimensions.climate  >= 80 ? "safe"   : dimensions.climate  >= 55 ? "moderate" : "tight",
    budget:   (dimensions.budget ?? 50) >= 60 ? "likely" : "uncertain",
    space:    subCategory === "truck" ? "large"
              : subCategory === "suv" ? "midsize"
              : "compact",
  };
}

// ---------------------------------------------------------------------------
// Helper: map sub_category → body_type for preference filters
// ---------------------------------------------------------------------------

function subCategoryToBodyType(subCategory: string): VehicleRecommendation["body_type"] {
  const s = subCategory.toLowerCase();
  if (s === "truck") return "truck";
  if (s === "van" || s === "minivan") return "van";
  if (s === "suv" || s === "crossover") return "suv";
  if (s === "hatchback") return "hatchback";
  if (s === "sedan" || s === "fastback") return "sedan";
  if (s === "coupe") return "coupe";
  return "suv"; // safe default
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Score all vehicles against a routine and return sorted recommendations.
 * Does NOT include dealer_listings — those are added by the API endpoint.
 */
export function batchScoreVehicles(
  mvr: MinimumViableRoutine,
  rangeData: RangeDeltaRow[],
  realTimeData?: RealTimeData,
  specsResults?: SpecsMatchResult[]
): Omit<VehicleRecommendation, "dealer_listings">[] {
  const useV2 = !!realTimeData;

  // Build penalty lookup map for O(1) access per vehicle
  const specsPenaltyMap = new Map<string, number>();
  if (specsResults) {
    for (const sr of specsResults) {
      specsPenaltyMap.set(sr.candidate.vehicle_label.toLowerCase(), sr.penalty_score);
    }
  }

  const scored = rangeData.map((row) => {
    const { make, model_short } = extractMakeAndModel(row.model);
    const classification = classifyVehicle(make, model_short);
    const traits = getTraits(row.model);

    const vehicleBasics = {
      model: row.model,
      year: row.year,
      real_world_range_mi: row.real_world_range_mi,
      sub_category: classification.subCategory,
      msrp_usd: row.msrp_usd,
      dc_fast_kw: row.dc_fast_kw || undefined,
      // Pass incentive amount so budget scoring uses effective price
      incentive_amount: row.incentive_new ? 7500 : 0,
      // Pass enriched spec data for utility fit scoring
      seating_capacity: traits.seating_capacity,
      cargo_volume_cuft: traits.cargo_volume_cuft,
    };

    // Use V2 scoring if real-time data is available, otherwise baseline
    const fit = useV2
      ? computeRoutineFitV2({
          routine: mvr,
          vehicle: {
            id: `batch-${row.model}-${row.year}`,
            year: row.year,
            make,
            model: row.model,
            usable_range_band: "medium",
            usable_range_mi_estimate: row.real_world_range_mi,
            dc_fast_band: "okay",
            ac_home_charge_band: "okay",
            winter_sensitivity_band: "moderate",
            efficiency_band: "medium",
            connector_types: [],
            is_active: true,
            data_source: "range_delta_csv",
            created_at: new Date().toISOString(),
          },
          weather: realTimeData.weather,
          chargerCount: realTimeData.chargerCount,
        })
      : computeRoutineFit(mvr, vehicleBasics);

    const scoreImprovements = computeScoreImprovements(mvr, vehicleBasics, fit);

    const dimensions: FitDimensions = fit.dimensions ?? {
      charging: 50, range: 50, recovery: 50, climate: 50,
    };

    // ── UNIFIED FINAL SCORE (Phase 5/6D) ────────────────────────────────────
    // confidence_adjusted_score from Phase 4F — downgrades when data is missing
    const routine_fit = fit.confidence_adjusted_score ?? fit.score_0_100;

    // hardware_match: use penalty from specsResults if provided, else neutral 75
    const penaltyScore = specsPenaltyMap.get(row.model.toLowerCase());
    const hw_match = penaltyScore !== undefined
      ? Math.max(0, Math.min(100, 100 - penaltyScore))
      : 75;

    // ownership_cost: deterministic price + efficiency
    const own_cost = computeOwnershipCostScore(row, mvr);

    // reliability: from JD Power / CR tier in traits
    const reliability = reliabilityTierToScore(traits.reliability_tier);

    // Long ownership horizon boosts reliability weight at the expense of utility
    const longOwner = mvr.ownership_timeline === "long_5_plus";
    const reliabilityW = longOwner ? 0.15 : 0.10;
    const ownCostW     = longOwner ? 0.20 : 0.20;
    const routineFitW  = longOwner ? 0.40 : 0.45;
    const hwMatchW     = longOwner ? 0.25 : 0.25;

    const unified_score = Math.min(100, Math.max(0, Math.round(
      routine_fit  * routineFitW +
      hw_match     * hwMatchW +
      own_cost     * ownCostW +
      reliability  * reliabilityW
    )));

    const offoScore: OffoScore = computeOffoScore({
      context:     "retail",
      financial:   own_cost,
      usability:   routine_fit,
      feasibility: hw_match,
      reliability,
      confidence:  fit.confidence?.level ?? "medium",
      hints: {
        top_risk_dimension: fit.top_risk_dimension ?? null,
      },
    });

    return {
      model: row.model,
      year: row.year,
      epa_range_mi: row.epa_range_mi,
      real_world_range_mi: row.real_world_range_mi,
      battery_kwh: row.battery_kwh,
      chemistry: row.chemistry,
      fit_score: unified_score,
      fit_label: fit.label,
      mental_load: fit.mental_load,
      top_stress_flag: getTopStressFlag(dimensions),
      dimensions,
      tie_chips: computeTieChips(dimensions, classification.subCategory),
      make,
      model_short,
      sub_category: classification.subCategory,
      score_improvements: scoreImprovements,
      msrp_usd: row.msrp_usd || undefined,
      dc_fast_kw: row.dc_fast_kw || undefined,
      incentive_new: row.incentive_new || undefined,
      offo_score: offoScore,
      seating_capacity: traits.seating_capacity,
      cargo_volume_cuft: traits.cargo_volume_cuft,
      hp_combined: traits.hp_combined,
      zero_to_60_sec: traits.zero_to_60_sec,
      tow_capacity_lbs: traits.tow_capacity_lbs,
      battery_warranty_years: traits.battery_warranty_years,
      has_heat_pump: traits.has_heat_pump,
      body_type: subCategoryToBodyType(classification.subCategory),
      // Phase 2 rich specs
      drivetrain: (traits.awd ? "awd" : traits.rwd ? "rwd" : traits.fwd ? "fwd" : undefined) as "awd" | "rwd" | "fwd" | undefined,
      charge_time_l2_hours: traits.charge_time_l2_hours,
      has_carplay: traits.has_carplay,
      has_android_auto: traits.has_android_auto,
      has_keyless_entry: traits.has_keyless_entry,
      has_alarm: traits.has_alarm,
      has_satellite_radio: traits.has_satellite_radio,
      // Phase 2b rich specs
      has_ac: traits.has_ac,
      has_power_windows: traits.has_power_windows,
      has_power_locks: traits.has_power_locks,
      has_power_steering: traits.has_power_steering,
      has_tilt_wheel: traits.has_tilt_wheel,
      has_am_fm_radio: traits.has_am_fm_radio,
      has_immobilizer: traits.has_immobilizer,
      has_active_seatbelts: traits.has_active_seatbelts,
      has_passenger_airbag: traits.has_passenger_airbag,
      has_dual_airbags: traits.has_dual_airbags,
      has_side_airbags: traits.has_side_airbags,
      has_abs: traits.has_abs,
      doors: traits.doors,
      front_legroom_in: traits.front_legroom_in,
      rear_legroom_in: traits.rear_legroom_in,
      exterior_colors: traits.exterior_colors,
      interior_colors: traits.interior_colors,
    };
  });

  // Sort by unified fit_score descending; tie-break by dimension tie score
  return scored.sort((a, b) => {
    if (b.fit_score !== a.fit_score) return b.fit_score - a.fit_score;
    const tieA = computeTieScore(a.dimensions!, mvr);
    const tieB = computeTieScore(b.dimensions!, mvr);
    return tieB - tieA;
  });
}
