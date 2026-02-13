// lib/routine-fit-client.ts
// Client-safe routine fit calculation (doesn't import fs-based modules)

import type {
  SeasonalSensitivity,
  SeasonalTriggerTag,
  PredictabilityLevel,
  PlanningTolerance,
  ChargingAnchorType,
  BackupOption,
} from "@/types";

export interface RoutineFitAssessment {
  verdict: 'good-fit' | 'conditional-fit' | 'high-friction';
  condition?: string;
  mental_load: 'low' | 'medium' | 'high';
  reasons: Array<{
    text: string;
    type: 'positive' | 'neutral' | 'negative';
  }>;
  confidence_current: number;
  confidence_with_battery_data: number;
  missing_data: string[];

  // P0/P1: New seasonal & predictability fields
  seasonal_sensitivity?: SeasonalSensitivity;
  seasonal_trigger_tags?: SeasonalTriggerTag[];
  predictability_level?: PredictabilityLevel;
  planning_tolerance?: PlanningTolerance;
  charging_anchor_type?: ChargingAnchorType;
  backup_option?: BackupOption;
}

interface ClientRoutineFitInput {
  dailyMiles: number;
  homeCharging: boolean;
  chargerDensity: string;
  realWorldRange: number;
  overall_score: number;
  hasActualRange?: boolean;
}

export function calculateRoutineFitClient(input: ClientRoutineFitInput): RoutineFitAssessment {
  const { dailyMiles, homeCharging, chargerDensity, realWorldRange, overall_score, hasActualRange } = input;
  const dailyRangeUsage = (dailyMiles / realWorldRange) * 100;

  const reasons: Array<{ text: string; type: 'positive' | 'neutral' | 'negative' }> = [];
  let verdict: 'good-fit' | 'conditional-fit' | 'high-friction' = 'good-fit';
  let condition: string | undefined;
  let mental_load: 'low' | 'medium' | 'high' = 'low';

  // Analyze home charging
  if (homeCharging) {
    reasons.push({
      text: `Home charging available → charging becomes automatic`,
      type: 'positive'
    });
  } else {
    reasons.push({
      text: `No home charging → charging becomes a recurring task`,
      type: 'negative'
    });
  }

  // Analyze charger density
  if (chargerDensity === "Excellent" || chargerDensity === "Good") {
    reasons.push({
      text: `${chargerDensity} charger density → infrastructure supports public charging`,
      type: homeCharging ? 'neutral' : 'positive'
    });
  } else {
    reasons.push({
      text: `${chargerDensity} charger density → requires planning + backup options`,
      type: 'negative'
    });
  }

  // Analyze daily usage
  if (dailyRangeUsage < 50) {
    if (hasActualRange) {
      reasons.push({
        text: `Daily usage (${dailyRangeUsage.toFixed(0)}%) well within range → range is not the issue`,
        type: 'positive'
      });
    }
  } else if (dailyRangeUsage < 70) {
    reasons.push({
      text: `Daily usage (${dailyRangeUsage.toFixed(0)}%) moderate → some buffer for spontaneous trips`,
      type: 'neutral'
    });
  } else {
    reasons.push({
      text: `Daily usage (${dailyRangeUsage.toFixed(0)}%) high → limited flexibility for detours or weather`,
      type: 'negative'
    });
  }

  // Determine verdict
  if (homeCharging && dailyRangeUsage < 50) {
    verdict = 'good-fit';
    mental_load = 'low';
  } else if (homeCharging && dailyRangeUsage < 70) {
    verdict = 'good-fit';
    mental_load = 'low';
  } else if (!homeCharging && (chargerDensity === "Excellent" || chargerDensity === "Good")) {
    verdict = 'conditional-fit';
    condition = 'secure reliable charging access';
    mental_load = 'medium';
  } else if (!homeCharging && chargerDensity === "Moderate") {
    verdict = 'conditional-fit';
    condition = 'identify and test backup charging locations';
    mental_load = 'medium';
  } else {
    verdict = 'high-friction';
    mental_load = 'high';
  }

  // Calculate confidence levels
  const confidence_current = overall_score;
  const confidence_with_battery_data = Math.min(95, confidence_current + 22); // ~22% boost with battery data

  // Missing data points
  const missing_data = [
    'Battery State of Health (SOH) percentage from OBD-II scan',
    'Actual degradation curve vs expected for this model/year',
    'Battery temperature management history',
    'Fast-charging frequency (impacts long-term degradation)',
    'Detailed recall completion status and outstanding issues'
  ];

  return {
    verdict,
    condition,
    mental_load,
    reasons,
    confidence_current,
    confidence_with_battery_data,
    missing_data
  };
}
