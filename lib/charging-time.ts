/**
 * Charging time calculator — pure functions, no I/O.
 *
 * L1: 120V/12A → ~1.44 kW usable (after overhead). 4.5 mi/hr matches compute-routine-fit.ts.
 * L2: rate = min(vehicle onboard_ac_kw, EVSE output kW).
 * DCFC: rate from dc_fast_kw, time-to-80% adjusted by charging_curve.
 */

export type ChargingCurve = "flat" | "tapered" | "steep_taper";

export interface ChargerResult {
  label: string;
  power_kw: number;
  miles_per_hour: number;
  hours_to_80: number;
  hours_to_100: number;
  minutes_to_80: number;
  minutes_to_100: number;
}

export interface ChargingTimeResult {
  l1: ChargerResult;
  l2_720: ChargerResult;   // 7.2 kW home EVSE (40A)
  l2_1150: ChargerResult;  // 11.5 kW home EVSE (48A)
  l2_192: ChargerResult;   // 19.2 kW EVSE (80A, bidirectional trucks)
  dcfc: ChargerResult;
  morning_readiness: MorningReadiness;
}

export interface MorningReadiness {
  hours_plugged: number;   // always 8
  miles_recovered_l1: number;
  daily_miles: number;
  l1_sufficient: boolean;
}

const L1_KW = 1.44; // 120V × 12A × 0.94 charger efficiency ≈ 1.35, round up for 16A circuit
const L1_MI_PER_HR = 4.5; // established constant from compute-routine-fit.ts

function mphFromKw(real_world_range_mi: number, battery_kwh: number, kw: number): number {
  // miles per kWh × kW = miles per hour
  const efficiency = real_world_range_mi / battery_kwh;
  return Math.round(efficiency * kw * 10) / 10;
}

function hoursToCharge(battery_kwh: number, from_pct: number, to_pct: number, kw: number): number {
  const kwh_needed = battery_kwh * (to_pct - from_pct) / 100;
  return kwh_needed / kw;
}

/** DCFC curve multiplier: how much longer than flat-rate to reach 80% */
function dcfcCurveMultiplier(curve: ChargingCurve): number {
  if (curve === "tapered") return 1.25;
  if (curve === "steep_taper") return 1.5;
  return 1.0; // flat
}

function buildL2Result(
  label: string,
  evse_kw: number,
  onboard_ac_kw: number,
  battery_kwh: number,
  real_world_range_mi: number
): ChargerResult {
  const actual_kw = Math.min(onboard_ac_kw, evse_kw);
  const h80 = hoursToCharge(battery_kwh, 10, 80, actual_kw);
  const h100 = hoursToCharge(battery_kwh, 10, 100, actual_kw);
  return {
    label,
    power_kw: Math.round(actual_kw * 10) / 10,
    miles_per_hour: mphFromKw(real_world_range_mi, battery_kwh, actual_kw),
    hours_to_80: h80,
    hours_to_100: h100,
    minutes_to_80: Math.round(h80 * 60),
    minutes_to_100: Math.round(h100 * 60),
  };
}

export function computeChargingTimes(
  battery_kwh: number,
  real_world_range_mi: number,
  onboard_ac_kw: number,
  dc_fast_kw: number,
  charging_curve: ChargingCurve = "tapered",
  daily_miles: number = 40
): ChargingTimeResult {
  // ── L1 ──────────────────────────────────────────────────────────────────
  const l1_h80 = hoursToCharge(battery_kwh, 10, 80, L1_KW);
  const l1_h100 = hoursToCharge(battery_kwh, 10, 100, L1_KW);
  const l1: ChargerResult = {
    label: "L1 (120V outlet)",
    power_kw: L1_KW,
    miles_per_hour: L1_MI_PER_HR,
    hours_to_80: l1_h80,
    hours_to_100: l1_h100,
    minutes_to_80: Math.round(l1_h80 * 60),
    minutes_to_100: Math.round(l1_h100 * 60),
  };

  // ── L2 variants ─────────────────────────────────────────────────────────
  const l2_720  = buildL2Result("L2 Home (7.2 kW)", 7.2,  onboard_ac_kw, battery_kwh, real_world_range_mi);
  const l2_1150 = buildL2Result("L2 Home (11.5 kW)", 11.5, onboard_ac_kw, battery_kwh, real_world_range_mi);
  const l2_192  = buildL2Result("L2 (19.2 kW)", 19.2, onboard_ac_kw, battery_kwh, real_world_range_mi);

  // ── DCFC ────────────────────────────────────────────────────────────────
  const curve_mult = dcfcCurveMultiplier(charging_curve);
  // Time from 10% to 80% (70% SOC window) at peak rate × curve penalty
  const dcfc_h80_flat = hoursToCharge(battery_kwh, 10, 80, dc_fast_kw);
  const dcfc_h80 = dcfc_h80_flat * curve_mult;
  // 80% → 100% always throttled to ~30% peak rate
  const dcfc_h_tail = hoursToCharge(battery_kwh, 80, 100, dc_fast_kw * 0.30);
  const dcfc_h100 = dcfc_h80 + dcfc_h_tail;
  const dcfc: ChargerResult = {
    label: "DCFC (fast charge)",
    power_kw: dc_fast_kw,
    miles_per_hour: mphFromKw(real_world_range_mi, battery_kwh, dc_fast_kw),
    hours_to_80: dcfc_h80,
    hours_to_100: dcfc_h100,
    minutes_to_80: Math.round(dcfc_h80 * 60),
    minutes_to_100: Math.round(dcfc_h100 * 60),
  };

  // ── Morning readiness ────────────────────────────────────────────────────
  const hours_plugged = 8;
  const miles_recovered_l1 = Math.round(L1_MI_PER_HR * hours_plugged);
  const morning_readiness: MorningReadiness = {
    hours_plugged,
    miles_recovered_l1,
    daily_miles,
    l1_sufficient: miles_recovered_l1 >= daily_miles,
  };

  return { l1, l2_720, l2_1150, l2_192, dcfc, morning_readiness };
}

/** Format hours as "Xh Ym" string for display */
export function formatHours(hours: number): string {
  if (hours <= 0) return "< 1 min";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
