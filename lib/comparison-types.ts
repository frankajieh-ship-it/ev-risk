/**
 * Routine Delta Comparison Types
 *
 * Types for comparing two EV options based on routine fit.
 * No specs, no recommendations - just routine-focused evaluation.
 */

import type { Region } from "./regionCopy";

// Option-specific buckets (no specs, just user perception)
export type BodyTypeBucket = 'HATCH_SEDAN_WAGON' | 'SUV_CUV' | 'VAN_PICKUP' | 'UNKNOWN';
export type BatteryBucket = 'SMALL' | 'MID' | 'LARGE' | 'UNKNOWN';
export type EfficiencyBucket = 'MORE_EFFICIENT' | 'NEUTRAL' | 'LESS_EFFICIENT' | 'UNKNOWN';
export type ChargingCurveBucket = 'FAST_CONSISTENT' | 'AVERAGE' | 'SLOW' | 'UNKNOWN';

export type FitSignal = 'GOOD' | 'CONDITIONAL' | 'HIGH_FRICTION';
export type FadeLabel = 'LIKELY_BACKGROUND' | 'MAY_RESURFACE' | 'ACTIVE_ATTENTION';

export interface OptionInput {
  label?: string; // Optional user label e.g. "Polestar 2"
  body_type_bucket: BodyTypeBucket;
  battery_bucket: BatteryBucket;
  efficiency_bucket: EfficiencyBucket;
  charging_curve_bucket: ChargingCurveBucket;
}

export interface BaseRoutineInput {
  region: Region;
  has_home_charging: boolean;
  home_charging_type?: 'L1' | 'L2' | 'UNKNOWN';
  can_charge_at_work: boolean;
  public_charging_dependency: 'RARE' | 'SOMETIMES' | 'OFTEN';
  routine_pattern: 'LOCAL' | 'MIXED' | 'MOTORWAY_HEAVY';
  long_day_frequency: 'RARE' | 'MONTHLY' | 'WEEKLY';
  planning_tolerance: 'LOW' | 'MED' | 'HIGH';
  shared_infrastructure: 'NONE' | 'SOME' | 'HIGH';
}

export interface ComparisonInput extends BaseRoutineInput {
  optionA: OptionInput;
  optionB: OptionInput;
}

export interface FitResult {
  fit_signal: FitSignal;
  fade_label: FadeLabel;
  strengths: string[];     // What works well for this routine (green bullets)
  friction_bullets: string[];
  why_not_100: string[];
  risk_tags: string[]; // Internal: ['WINTER_MOTORWAY', 'PUBLIC_DEPENDENCY', ...]
}

export interface ComparisonResult {
  optionA: FitResult & { label?: string };
  optionB: FitResult & { label?: string };
  routine_delta_bullets: string[];
  neutral_closer: string;
}

// ============================================
// SPEC TYPES + BUCKET DERIVATION HELPERS
// ============================================

/** Raw numeric specs for a vehicle option (page-level only, not passed to engine) */
export interface OptionSpec {
  range_mi?: number;
  battery_kwh?: number;
  dc_fast_kw?: number;
  efficiency_mi_per_kwh?: number;
  drivetrain?: 'FWD' | 'RWD' | 'AWD' | 'UNKNOWN';
  price?: number;
}

export function deriveBodyBucket(make: string, model: string): BodyTypeBucket {
  const s = `${make} ${model}`.toLowerCase();
  if (/van|pickup|f-150|silverado|r1t|ram|canyon|colorado|transit|promaster/.test(s)) return 'VAN_PICKUP';
  if (/suv|crossover|model y|model x|ioniq 5|ioniq 7|ioniq 9|ev6|ev9|mach-e|ariya|bz4x|blazer|equinox|forester|outback|qx60|tiguan|id\.4|id\.6|enyaq/.test(s)) return 'SUV_CUV';
  return 'HATCH_SEDAN_WAGON';
}

export function deriveBatteryBucket(range_mi?: number, battery_kwh?: number): BatteryBucket {
  if (!range_mi && !battery_kwh) return 'UNKNOWN';
  const kwh = battery_kwh ?? (range_mi ? range_mi / 3.5 : 0);
  if (kwh >= 75) return 'LARGE';
  if (kwh >= 55) return 'MID';
  return 'SMALL';
}

export function deriveEfficiencyBucket(efficiency_mi_per_kwh?: number): EfficiencyBucket {
  if (!efficiency_mi_per_kwh) return 'UNKNOWN';
  if (efficiency_mi_per_kwh >= 3.8) return 'MORE_EFFICIENT';
  if (efficiency_mi_per_kwh <= 3.0) return 'LESS_EFFICIENT';
  return 'NEUTRAL';
}

export function deriveChargingBucket(dc_fast_kw?: number): ChargingCurveBucket {
  if (!dc_fast_kw) return 'UNKNOWN';
  if (dc_fast_kw >= 150) return 'FAST_CONSISTENT';
  if (dc_fast_kw >= 80) return 'AVERAGE';
  return 'SLOW';
}

// UI display helpers
export const FIT_SIGNAL_LABELS: Record<FitSignal, string> = {
  GOOD: "Good Fit",
  CONDITIONAL: "Conditional Fit",
  HIGH_FRICTION: "High Friction",
};

export const FADE_LABEL_DISPLAY: Record<FadeLabel, string> = {
  LIKELY_BACKGROUND: "Likely to fade into the background",
  MAY_RESURFACE: "Works, but may keep resurfacing",
  ACTIVE_ATTENTION: "Requires active attention",
};

// Bucket display labels for UI
export const BODY_TYPE_LABELS: Record<BodyTypeBucket, string> = {
  HATCH_SEDAN_WAGON: "Hatchback / Sedan / Wagon",
  SUV_CUV: "SUV / Crossover",
  VAN_PICKUP: "Van / Pickup",
  UNKNOWN: "Not sure",
};

export const BATTERY_LABELS: Record<BatteryBucket, string> = {
  SMALL: "Smaller battery (shorter range)",
  MID: "Mid-size battery",
  LARGE: "Larger battery (longer range)",
  UNKNOWN: "Not sure",
};

export const EFFICIENCY_LABELS: Record<EfficiencyBucket, string> = {
  MORE_EFFICIENT: "More efficient (better mi/kWh)",
  NEUTRAL: "Average efficiency",
  LESS_EFFICIENT: "Less efficient (lower mi/kWh)",
  UNKNOWN: "Not sure",
};

export const CHARGING_CURVE_LABELS: Record<ChargingCurveBucket, string> = {
  FAST_CONSISTENT: "Fast & consistent charging",
  AVERAGE: "Average charging speed",
  SLOW: "Slower charging",
  UNKNOWN: "Not sure",
};
