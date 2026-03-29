/**
 * Enhanced Routine Fit Scoring (V2)
 *
 * Wraps the existing computeRoutineFit() with real-time adjustments:
 * - Weather data (actual temperature vs assumed climate band)
 * - Charger availability context (saved charger count)
 *
 * Does NOT replace the original engine. Returns the same RoutineFitScore shape.
 */

import type {
  MinimumViableRoutine,
  RoutineFitScore,
  RoutineFitConfidence,
} from "@/types/v2";
import type { WeatherData, VehicleProfile } from "@/types/routine-v2";
import { computeRoutineFit, type ChargerContext } from "./compute-routine-fit";

export interface EnhancedInputs {
  routine: MinimumViableRoutine;
  vehicle?: VehicleProfile;
  weather?: WeatherData;
  chargerCount?: number;
}

export function computeRoutineFitV2(inputs: EnhancedInputs): RoutineFitScore {
  const { routine, vehicle, weather, chargerCount = 0 } = inputs;

  // Map vehicle profile to baseline VehicleBasics
  const vehicleBasics = vehicle
    ? {
        model: vehicle.model,
        year: vehicle.year,
        real_world_range_mi: vehicle.usable_range_mi_estimate,
      }
    : undefined;

  // Build ChargerContext from chargerCount for Phase 4B integration
  const chargerCtx: ChargerContext | undefined = chargerCount > 0 || chargerCount === 0
    ? {
        dcfc_count: chargerCount,
        // Derive density tier from count (rough heuristic when ZIP not available)
        density_score:
          chargerCount === 0 ? "Poor"
          : chargerCount <= 2 ? "Moderate"
          : chargerCount <= 6 ? "Good"
          : "Excellent",
      }
    : undefined;

  // Get baseline score from existing engine — pass charger context
  const baseline = computeRoutineFit(routine, vehicleBasics, chargerCtx);

  // Apply real-time adjustments (weather only — charger density handled in base engine)
  let adjustedScore = baseline.score_0_100;

  // Weather adjustment
  if (weather) {
    const weatherDelta = calculateWeatherImpact(weather, routine);
    adjustedScore += weatherDelta;
  }

  // Clamp to 0-100
  adjustedScore = Math.max(0, Math.min(100, Math.round(adjustedScore)));

  // Re-classify based on adjusted score
  const label: RoutineFitScore["label"] =
    adjustedScore >= 80
      ? "Great Fit"
      : adjustedScore >= 65
        ? "Good Fit"
        : adjustedScore >= 45
          ? "Mixed Fit"
          : "High Friction";

  const mental_load: RoutineFitScore["mental_load"] =
    adjustedScore >= 75 ? "low" : adjustedScore >= 50 ? "medium" : "high";

  // Update confidence
  const hasRealTimeWeather = weather?.source === "openweathermap";
  const confidence: RoutineFitConfidence = {
    ...baseline.confidence,
    level:
      hasRealTimeWeather && vehicle
        ? "high"
        : vehicle
          ? "medium"
          : baseline.confidence.level,
    note: hasRealTimeWeather
      ? `Based on your routine, vehicle profile, and current ${weather!.location_used} weather.`
      : baseline.confidence.note,
    has_vehicle_data: !!vehicle,
  };

  // Recalculate derived fields based on adjusted score
  const confMultiplier =
    confidence.level === "high" ? 1.0 : confidence.level === "medium" ? 0.9 : 0.75;

  return {
    score_0_100: adjustedScore,
    label,
    mental_load,
    stress_flags: baseline.stress_flags,
    breakpoints_ranked: baseline.breakpoints_ranked,
    confidence,
    // Propagate dimension sub-scores from baseline — V2 only adjusts the total
    dimensions: baseline.dimensions,
    // Propagate Phase 4F fields, recalculated for adjusted score
    failure_probability: Math.max(0, Math.min(1, 1 - adjustedScore / 100)),
    top_risk_dimension: baseline.top_risk_dimension,
    confidence_adjusted_score: Math.round(adjustedScore * confMultiplier),
  };
}

// ============================================
// WEATHER IMPACT
// ============================================

function calculateWeatherImpact(
  weather: WeatherData,
  routine: MinimumViableRoutine
): number {
  const { temperature_band, current_temp_f } = weather;

  // Extreme cold + public charging = extra penalty beyond baseline
  if (temperature_band === "freezing" && routine.climate === "winter") {
    return routine.charging_access === "public" ? -5 : -3;
  }

  // Extreme heat penalty
  if (temperature_band === "hot" && current_temp_f > 95) {
    return -3;
  }

  // Mild weather bonus when user selected "winter" climate
  // (actual conditions are better than assumed worst case)
  if (temperature_band === "mild" && routine.climate === "winter") {
    return +3;
  }

  return 0;
}
