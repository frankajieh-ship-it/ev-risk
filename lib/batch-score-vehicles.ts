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
import type { VehicleRecommendation } from "@/types/recommendations";
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

  return rangeData
    .map((row) => {
      const { make, model_short } = extractMakeAndModel(row.model);
      const classification = classifyVehicle(make, model_short);

      const vehicleBasics = {
        model: row.model,
        year: row.year,
        real_world_range_mi: row.real_world_range_mi,
        msrp_usd: row.msrp_usd,
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
        score_improvements: scoreImprovements,
      };
    })
    .sort((a, b) => b.fit_score - a.fit_score);
}
