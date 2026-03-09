/**
 * Batch Vehicle Scorer
 *
 * Scores all vehicles from range_delta.csv against a user's routine.
 * Pure function — no I/O, no external calls.
 */

import { computeRoutineFit } from "./compute-routine-fit";
import { classifyVehicle } from "./vehicle-classifier";
import type { MinimumViableRoutine } from "@/types/v2";
import type { RangeDeltaRow } from "./data";
import type { VehicleRecommendation } from "@/types/recommendations";

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

/**
 * Score all vehicles against a routine and return sorted recommendations.
 * Does NOT include dealer_listings — those are added by the API endpoint.
 */
export function batchScoreVehicles(
  mvr: MinimumViableRoutine,
  rangeData: RangeDeltaRow[]
): Omit<VehicleRecommendation, "dealer_listings">[] {
  return rangeData
    .map((row) => {
      const fit = computeRoutineFit(mvr, {
        model: row.model,
        year: row.year,
        real_world_range_mi: row.real_world_range_mi,
      });

      const { make, model_short } = extractMakeAndModel(row.model);
      const classification = classifyVehicle(make, model_short);

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
        top_stress_flag: fit.stress_flags[0]?.label,
        make,
        model_short,
        sub_category: classification.subCategory,
      };
    })
    .sort((a, b) => b.fit_score - a.fit_score);
}
