// core/signals.ts
import type { VehicleData, UserInputs } from "@/types";

/**
 * Signal Exhaustiveness System
 *
 * Single source of truth for all signal keys.
 * Using a const array ensures exhaustiveness checking and runtime validation.
 */
export const SIGNAL_KEYS = [
  // Context & Re-validation
  "context_trigger",
  "has_context_trigger",

  // Battery & Powertrain
  "has_battery_data",
  "has_battery_health_report",
  "battery_degradation_pct",
  "battery_confidence_source",

  // Usage & Personalization
  "has_annual_mileage",
  "annual_mileage",
  "has_climate_zone",
  "climate_zone",
  "has_daily_commute",
  "daily_commute_miles",
  "has_home_charging",
  "home_charging",

  // Charging Fit (Mental Overhead)
  "charging_access",
  "has_charging_access",
  "charging_reliability",
  "has_charging_reliability",
  "weekly_charging_moments",
  "has_weekly_charging_moments",

  // Safety & Recalls
  "has_recalls",
  "open_recalls_count",
  "open_recalls_critical_count",
  "recall_completion_verified",

  // Reliability & History
  "has_service_history",
  "service_record_count",
  "has_vehicle_mileage",
  "vehicle_mileage",
  "known_failure_modes_count",
  "stranded_risk_score",

  // Financial & Warranty
  "has_warranty_info",
  "warranty_remaining_months",
  "warranty_type",

  // Compatibility & Fit
  "has_charging_compatibility",
  "charging_compatibility",
  "has_range_data",
  "range_adequacy_score",
  "vehicle_range_miles",

  // Verification
  "dealer_verification",

  // Location
  "zip_code",

  // Risk
  "risk_tolerance",
] as const;

/**
 * Signal Key Type
 *
 * Derived from SIGNAL_KEYS array for perfect type safety
 */
export type SignalKey = (typeof SIGNAL_KEYS)[number];

/**
 * Signal Map Type
 *
 * Runtime values for all signals
 */
export type SignalMap = Record<SignalKey, any>;

/**
 * Validation utility
 *
 * Check if a string is a valid signal key at runtime
 */
export function isValidSignalKey(key: string): key is SignalKey {
  return SIGNAL_KEYS.includes(key as SignalKey);
}

/**
 * Build Signals from Vehicle Data + User Inputs
 *
 * Central adapter that extracts all signals from raw data.
 * Uses exhaustive signal key list for type safety.
 */
export function buildSignals(vehicle: VehicleData, inputs?: UserInputs): SignalMap {
  const recalls = vehicle?.recalls ?? [];
  const criticalRecalls = recalls.filter(r => r.priority === "high");

  return {
    // Context & Re-validation
    context_trigger: inputs?.contextTrigger,
    has_context_trigger: inputs?.contextTrigger != null,

    // Battery & Powertrain
    has_battery_data: vehicle?.batteryData != null,
    has_battery_health_report: vehicle?.batteryHealthReport != null,
    battery_degradation_pct: vehicle?.batteryData?.degradation,
    battery_confidence_source: vehicle?.batteryData?.confidence,

    // Usage & Personalization
    has_annual_mileage: inputs?.annualMileage != null,
    annual_mileage: inputs?.annualMileage,
    has_climate_zone: inputs?.climateZone != null,
    climate_zone: inputs?.climateZone,
    has_daily_commute: inputs?.dailyCommute != null,
    daily_commute_miles: inputs?.dailyCommute,
    has_home_charging: inputs?.hasHomeCharging != null,
    home_charging: inputs?.hasHomeCharging,

    // Charging Fit (Mental Overhead)
    charging_access: inputs?.chargingAccess,
    has_charging_access: inputs?.chargingAccess != null,
    charging_reliability: inputs?.chargingReliability,
    has_charging_reliability: inputs?.chargingReliability != null,
    weekly_charging_moments: inputs?.weeklyChargingMoments,
    has_weekly_charging_moments: inputs?.weeklyChargingMoments != null,

    // Safety & Recalls
    has_recalls: recalls.length > 0,
    open_recalls_count: recalls.length,
    open_recalls_critical_count: criticalRecalls.length,
    recall_completion_verified: inputs?.dealerVerification != null,

    // Reliability & History
    has_service_history: vehicle?.serviceRecords != null && vehicle.serviceRecords.length > 0,
    service_record_count: vehicle?.serviceRecords?.length ?? 0,
    has_vehicle_mileage: vehicle?.odometer != null,
    vehicle_mileage: vehicle?.odometer,
    known_failure_modes_count: vehicle?.knownIssues?.filter(i => i.severity === "high")?.length ?? 0,
    stranded_risk_score: vehicle?.reliabilityScore != null ? 100 - vehicle.reliabilityScore : undefined,

    // Financial & Warranty
    has_warranty_info: vehicle?.warrantyRemaining != null,
    warranty_remaining_months: vehicle?.warrantyRemaining,
    warranty_type: undefined, // To be populated from vehicle data when available

    // Compatibility & Fit
    has_charging_compatibility: vehicle?.chargingCompatibility != null,
    charging_compatibility: vehicle?.chargingCompatibility,
    has_range_data: vehicle?.estimatedRange != null,
    range_adequacy_score: vehicle?.rangeAdequacy,
    vehicle_range_miles: vehicle?.estimatedRange,

    // Verification
    dealer_verification: inputs?.dealerVerification,

    // Location
    zip_code: inputs?.zipCode,

    // Risk
    risk_tolerance: inputs?.riskTolerance,
  };
}

/**
 * Check if all required signals are present
 */
export function hasAllSignals(signals: SignalMap, required: SignalKey[]): boolean {
  return required.every(key => signals[key] != null);
}

/**
 * Get missing signals from required list
 */
export function missingSignals(signals: SignalMap, required: SignalKey[]): SignalKey[] {
  return required.filter(key => signals[key] == null);
}

/**
 * Get signal value with fallback
 */
export function getSignal<T = any>(
  signals: SignalMap,
  key: SignalKey,
  fallback?: T
): T {
  const value = signals[key];
  return value != null ? value : (fallback as T);
}

/**
 * Check if any of the signals are present
 */
export function hasAnySignal(signals: SignalMap, keys: SignalKey[]): boolean {
  return keys.some(key => signals[key] != null);
}

/**
 * Signal Group Helpers
 *
 * Pre-defined groups of related signals.
 * Updated to use new exhaustive signal keys.
 */
export const signalGroups = {
  battery: [
    "has_battery_data",
    "has_battery_health_report",
    "battery_degradation_pct",
    "battery_confidence_source",
  ] as SignalKey[],

  personalization: [
    "has_annual_mileage",
    "annual_mileage",
    "has_daily_commute",
    "daily_commute_miles",
    "has_home_charging",
    "home_charging",
    "has_climate_zone",
    "climate_zone",
    "zip_code",
    "risk_tolerance",
  ] as SignalKey[],

  safety: [
    "has_recalls",
    "open_recalls_count",
    "open_recalls_critical_count",
    "recall_completion_verified",
    "known_failure_modes_count",
  ] as SignalKey[],

  reliability: [
    "has_service_history",
    "service_record_count",
    "has_vehicle_mileage",
    "vehicle_mileage",
    "known_failure_modes_count",
    "stranded_risk_score",
  ] as SignalKey[],

  cost: [
    "has_warranty_info",
    "warranty_remaining_months",
    "warranty_type",
    "risk_tolerance",
    "has_annual_mileage",
    "annual_mileage",
  ] as SignalKey[],

  convenience: [
    "has_home_charging",
    "home_charging",
    "has_charging_compatibility",
    "charging_compatibility",
    "has_range_data",
    "range_adequacy_score",
    "vehicle_range_miles",
    "has_daily_commute",
    "daily_commute_miles",
  ] as SignalKey[],
};

/**
 * Get all missing signals from a group
 */
export function missingFromGroup(
  signals: SignalMap,
  groupName: keyof typeof signalGroups
): SignalKey[] {
  const group = signalGroups[groupName];
  return missingSignals(signals, group);
}

/**
 * Check if group is complete (all signals present)
 */
export function isGroupComplete(
  signals: SignalMap,
  groupName: keyof typeof signalGroups
): boolean {
  const group = signalGroups[groupName];
  return hasAllSignals(signals, group);
}
