/**
 * Batch Vehicle Scorer
 *
 * Scores all vehicles from range_delta.csv against a user's routine.
 * Pure function — no I/O, no external calls.
 */

import { computeRoutineFit } from "./compute-routine-fit";
import { computeRoutineFitV2 } from "./compute-routine-fit-v2";
import { classifyVehicle } from "./vehicle-classifier";
import { computeScoreImprovements } from "./compute-score-improvements";
import type { MinimumViableRoutine } from "@/types/v2";
import type { RangeDeltaRow } from "./data";
import type { VehicleRecommendation, FitDimensions, TieChips } from "@/types/recommendations";
import type { WeatherData } from "@/types/routine-v2";

/** Known two-word make prefixes */
const TWO_WORD_MAKES = ["mercedes"];

/**
 * Parse make and short model from full model string.
 * e.g. "Tesla Model 3 Long Range" → { make: "Tesla", model_short: "Model 3 Long Range" }
 * e.g. "Mercedes EQS 450+" → { make: "Mercedes", model_short: "EQS 450+" }
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
// Tie-break helpers
// ---------------------------------------------------------------------------

/**
 * Compute a secondary tie-break score from dimension sub-scores.
 * Weights shift based on charging_access: home users care more about range,
 * public charging users care more about charging convenience.
 */
function computeTieScore(
  dimensions: FitDimensions,
  mvr: MinimumViableRoutine
): number {
  const homePriority = mvr.charging_access === "home";
  const w = {
    range:    homePriority ? 0.35 : 0.25,
    charging: homePriority ? 0.20 : 0.40,
    budget:   0.20,
    recovery: homePriority ? 0.10 : 0.15,
    utility:  0.15,
  };

  return (
    dimensions.range    * w.range    +
    dimensions.charging * w.charging +
    dimensions.budget   * w.budget   +
    dimensions.recovery * w.recovery +
    dimensions.utility  * w.utility
  );
}

/**
 * Derive vehicle-specific top stress flag from the weakest dimension score.
 * Returns a concrete, vehicle-specific message rather than a generic breakpoint title.
 */
function getTopStressFlag(dimensions: FitDimensions): string {
  const candidates: [number, string][] = [
    [dimensions.range,    "Range buffer is tight for your longest day"],
    [dimensions.charging, "Charging setup adds weekly friction"],
    [dimensions.budget,   "Likely above your budget band"],
    [dimensions.recovery, "Recovery on long days may need planning"],
    [dimensions.climate,  "Cold weather will reduce effective range"],
    [dimensions.utility,  "Body style or towing doesn't match well"],
  ];

  // Lowest dimension score is the primary stress
  candidates.sort((a, b) => a[0] - b[0]);
  return candidates[0][1];
}

/**
 * Compute bucketed chip labels for the tie-break comparison UI.
 * Each chip summarises one dimension at a glance.
 */
function computeTieChips(dimensions: FitDimensions, subCategory: string): TieChips {
  return {
    buffer:   dimensions.range    >= 70 ? "strong" : dimensions.range    >= 45 ? "ok"       : "tight",
    charging: dimensions.charging >= 70 ? "low"    : dimensions.charging >= 45 ? "medium"   : "high",
    winter:   dimensions.climate  >= 80 ? "safe"   : dimensions.climate  >= 55 ? "moderate" : "tight",
    budget:   dimensions.budget   >= 60 ? "likely" : "uncertain",
    space:    subCategory === "truck" ? "large"
              : subCategory === "suv" ? "midsize"
              : "compact",
  };
}

/**
 * Score all vehicles against a routine and return sorted recommendations.
 * Does NOT include dealer_listings — those are added by the API endpoint.
 *
 * @param mvr - User's routine
 * @param rangeData - Vehicle data from range_delta.csv
 * @param realTimeData - Optional weather + charger data for V2 scoring
 */
export function batchScoreVehicles(
  mvr: MinimumViableRoutine,
  rangeData: RangeDeltaRow[],
  realTimeData?: RealTimeData
): Omit<VehicleRecommendation, "dealer_listings">[] {
  const useV2 = !!realTimeData;

  const scored = rangeData.map((row) => {
    const { make, model_short } = extractMakeAndModel(row.model);
    const classification = classifyVehicle(make, model_short);

    const vehicleBasics = {
      model: row.model,
      year: row.year,
      real_world_range_mi: row.real_world_range_mi,
      sub_category: classification.subCategory,
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

    // Compute score improvements
    const scoreImprovements = computeScoreImprovements(mvr, vehicleBasics, fit);

    // Dimension sub-scores (previously stripped — now propagated)
    const dimensions: FitDimensions = fit.dimensions ?? {
      charging: 50, range: 50, recovery: 50, climate: 50, budget: 50, utility: 50,
    };

    return {
      model: row.model,
      year: row.year,
      epa_range_mi: row.epa_range_mi,
      real_world_range_mi: row.real_world_range_mi,
      battery_kwh: row.battery_kwh,
      chemistry: row.chemistry,
      fit_score: fit.score_0_100,
      fit_label: fit.label,
      mental_load: fit.mental_load,
      // Vehicle-specific: derived from weakest dimension, not first breakpoint title
      top_stress_flag: getTopStressFlag(dimensions),
      // Sub-scores for tie-breaking and UI chip display
      dimensions,
      tie_chips: computeTieChips(dimensions, classification.subCategory),
      make,
      model_short,
      sub_category: classification.subCategory,
      score_improvements: scoreImprovements,
    };
  });

  // Primary sort: fit_score descending.
  // Secondary sort: tie_score descending within same fit_score group.
  return scored.sort((a, b) => {
    if (b.fit_score !== a.fit_score) return b.fit_score - a.fit_score;
    // Both dimensions are guaranteed non-null at this point
    const tieA = computeTieScore(a.dimensions!, mvr);
    const tieB = computeTieScore(b.dimensions!, mvr);
    return tieB - tieA;
  });
}
