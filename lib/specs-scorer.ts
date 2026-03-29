/**
 * Specs Scorer — Phase 5/6 Production Upgrade
 *
 * Phase 5/6 changes:
 * - Replaced binary hard filters with graduated penalty system
 * - Added RoutineContext for dynamic spec weighting based on user situation
 * - Expanded VehicleTraits with reliability_tier, battery_kwh, efficiency_mpge
 * - applySpecsFilter now accepts optional MVR for context-aware scoring
 */

import type { VehicleSpecsPrefs, MinimumViableRoutine } from "@/types/v2";
import type { ShortlistCandidate } from "./shortlist-coach";

// ============================================================
// TYPES
// ============================================================

export interface SpecsMatchResult {
  candidate: ShortlistCandidate;
  /** Graduated penalty 0–100 (0 = perfect match, higher = worse) */
  penalty_score: number;
  /** Human-readable reasons for penalty (shown in UI as caveats) */
  penalty_reasons: string[];
  /** For backwards compat — true when penalty_score < 35 */
  passed_hard_filters: boolean;
  hard_filter_reason?: string;
  matched_prefs: number; // 0–5 soft prefs matched
  total_prefs: number;   // always 5
  specs_bonus: number;   // 0–25 points (context-weighted)
  match_label: string;
}

/** Derived from MVR — amplifies or dampens spec penalties based on user context */
export interface RoutineContext {
  /** Winter climate AND commute/weekly miles implies >40mi daily */
  needs_awd_urgently: boolean;
  /** Long commute or frequent long days — charging speed matters more */
  highway_primary: boolean;
  /** Public charging in an area with poor charger density */
  charging_scarce: boolean;
  /** Budget below $45k — cost sensitivity is high */
  budget_tight: boolean;
}

export function deriveRoutineContext(
  mvr: MinimumViableRoutine,
  chargerDensity?: string
): RoutineContext {
  const dailyMiles = mvr.commute_miles_roundtrip
    ? mvr.commute_miles_roundtrip
    : (mvr.weekly_miles ?? 100) / 5;

  return {
    needs_awd_urgently: mvr.climate === "winter" && dailyMiles > 40,
    highway_primary:
      (mvr.commute_miles_roundtrip ?? 0) > 30 || (mvr.longest_day_miles ?? 0) > 80,
    charging_scarce: mvr.charging_access === "public" && chargerDensity === "Poor",
    budget_tight: (mvr.budget_max ?? 99999) < 45000,
  };
}

// ============================================================
// STATIC VEHICLE METADATA
// Known hardware traits keyed by model name substring (lowercase)
// ============================================================

interface VehicleTraits {
  awd: boolean;
  rwd: boolean;
  fwd: boolean;
  min_dc_kw: number;
  has_heat_pump: boolean;
  has_full_adas: boolean;
  has_premium_interior: boolean;
  tow_capable: boolean;
  estimated_winter_range_mi: number;
  /** Usable battery size (kWh) */
  battery_kwh?: number;
  /** EPA combined MPGe */
  efficiency_mpge?: number;
  /** JD Power / CR reliability tier (2023–2024 data) */
  reliability_tier?: "top" | "above_avg" | "average" | "below_avg";
  /** DC fast-charge curve shape */
  charging_curve?: "flat" | "tapered" | "steep_taper";
}

const VEHICLE_TRAITS: Record<string, Partial<VehicleTraits>> = {
  // ── Tesla ──────────────────────────────────────────────────────────────────
  "model y":          { awd: true,  min_dc_kw: 250, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 220, battery_kwh: 75,  efficiency_mpge: 123, reliability_tier: "average",    charging_curve: "flat" },
  "model 3":          { awd: true,  min_dc_kw: 250, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 240, battery_kwh: 75,  efficiency_mpge: 132, reliability_tier: "average",    charging_curve: "flat" },
  "model x":          { awd: true,  min_dc_kw: 250, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 260, battery_kwh: 100, efficiency_mpge: 102, reliability_tier: "below_avg",  charging_curve: "flat" },
  "model s":          { awd: true,  min_dc_kw: 250, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 310, battery_kwh: 100, efficiency_mpge: 120, reliability_tier: "below_avg",  charging_curve: "flat" },
  "cybertruck":       { awd: true,  min_dc_kw: 250, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 250, battery_kwh: 123, efficiency_mpge: 64,  reliability_tier: "below_avg",  charging_curve: "flat" },
  // ── Hyundai/Kia/Genesis ────────────────────────────────────────────────────
  "ioniq 6":          { awd: true,  min_dc_kw: 230, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 230, battery_kwh: 77,  efficiency_mpge: 140, reliability_tier: "top",        charging_curve: "flat" },
  "ioniq 5":          { awd: true,  min_dc_kw: 230, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: false, tow_capable: true,  estimated_winter_range_mi: 200, battery_kwh: 77,  efficiency_mpge: 110, reliability_tier: "top",        charging_curve: "flat" },
  "kia ev6":          { awd: true,  min_dc_kw: 230, has_heat_pump: true,  has_full_adas: false, has_premium_interior: false, tow_capable: true,  estimated_winter_range_mi: 220, battery_kwh: 77,  efficiency_mpge: 117, reliability_tier: "above_avg",  charging_curve: "flat" },
  "kia ev9":          { awd: true,  min_dc_kw: 230, has_heat_pump: true,  has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 210, battery_kwh: 99,  efficiency_mpge: 87,  reliability_tier: "above_avg",  charging_curve: "tapered" },
  "genesis gv60":     { awd: true,  min_dc_kw: 230, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 200, battery_kwh: 77,  efficiency_mpge: 104, reliability_tier: "above_avg",  charging_curve: "flat" },
  "genesis gv70":     { awd: true,  min_dc_kw: 230, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 215, battery_kwh: 77,  efficiency_mpge: 97,  reliability_tier: "above_avg",  charging_curve: "flat" },
  // ── GM ─────────────────────────────────────────────────────────────────────
  "bolt euv":         { fwd: true,  min_dc_kw: 55,  has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: false, estimated_winter_range_mi: 180, battery_kwh: 65,  efficiency_mpge: 125, reliability_tier: "average",    charging_curve: "steep_taper" },
  "bolt ev":          { fwd: true,  min_dc_kw: 55,  has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: false, estimated_winter_range_mi: 190, battery_kwh: 65,  efficiency_mpge: 131, reliability_tier: "average",    charging_curve: "steep_taper" },
  "chevy equinox":    { fwd: true,  min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: false, estimated_winter_range_mi: 210, battery_kwh: 85,  efficiency_mpge: 100, reliability_tier: "average",    charging_curve: "tapered" },
  "equinox ev":       { fwd: true,  min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: false, estimated_winter_range_mi: 210, battery_kwh: 85,  efficiency_mpge: 100, reliability_tier: "average",    charging_curve: "tapered" },
  "blazer ev":        { awd: true,  min_dc_kw: 190, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: true,  estimated_winter_range_mi: 215, battery_kwh: 85,  efficiency_mpge: 89,  reliability_tier: "below_avg",  charging_curve: "tapered" },
  "silverado ev":     { awd: true,  min_dc_kw: 350, has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 280, battery_kwh: 200, efficiency_mpge: 63,  reliability_tier: "average",    charging_curve: "flat" },
  // ── Ford ───────────────────────────────────────────────────────────────────
  "mach-e":           { awd: true,  min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 195, battery_kwh: 91,  efficiency_mpge: 100, reliability_tier: "below_avg",  charging_curve: "tapered" },
  "mustang mach-e":   { awd: true,  min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 195, battery_kwh: 91,  efficiency_mpge: 100, reliability_tier: "below_avg",  charging_curve: "tapered" },
  "f-150 lightning":  { awd: true,  min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: true,  estimated_winter_range_mi: 190, battery_kwh: 131, efficiency_mpge: 66,  reliability_tier: "below_avg",  charging_curve: "tapered" },
  "explorer ev":      { awd: true,  min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: true,  estimated_winter_range_mi: 220, battery_kwh: 77,  efficiency_mpge: 98,  reliability_tier: "average",    charging_curve: "tapered" },
  // ── Rivian ─────────────────────────────────────────────────────────────────
  "rivian r1t":       { awd: true,  min_dc_kw: 200, has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 230, battery_kwh: 135, efficiency_mpge: 70,  reliability_tier: "average",    charging_curve: "tapered" },
  "rivian r1s":       { awd: true,  min_dc_kw: 200, has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 215, battery_kwh: 135, efficiency_mpge: 72,  reliability_tier: "average",    charging_curve: "tapered" },
  // ── VW ─────────────────────────────────────────────────────────────────────
  "id.4":             { awd: true,  min_dc_kw: 135, has_heat_pump: true,  has_full_adas: false, has_premium_interior: false, tow_capable: true,  estimated_winter_range_mi: 185, battery_kwh: 82,  efficiency_mpge: 97,  reliability_tier: "below_avg",  charging_curve: "tapered" },
  "volkswagen id.4":  { awd: true,  min_dc_kw: 135, has_heat_pump: true,  has_full_adas: false, has_premium_interior: false, tow_capable: true,  estimated_winter_range_mi: 185, battery_kwh: 82,  efficiency_mpge: 97,  reliability_tier: "below_avg",  charging_curve: "tapered" },
  "id.buzz":          { awd: true,  min_dc_kw: 170, has_heat_pump: true,  has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 210, battery_kwh: 91,  efficiency_mpge: 92,  reliability_tier: "average",    charging_curve: "tapered" },
  // ── Nissan ─────────────────────────────────────────────────────────────────
  "leaf":             { fwd: true,  min_dc_kw: 50,  has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: false, estimated_winter_range_mi: 130, battery_kwh: 40,  efficiency_mpge: 99,  reliability_tier: "average",    charging_curve: "steep_taper" },
  "nissan leaf":      { fwd: true,  min_dc_kw: 50,  has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: false, estimated_winter_range_mi: 130, battery_kwh: 40,  efficiency_mpge: 99,  reliability_tier: "average",    charging_curve: "steep_taper" },
  "ariya":            { awd: true,  min_dc_kw: 130, has_heat_pump: true,  has_full_adas: false, has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 195, battery_kwh: 87,  efficiency_mpge: 98,  reliability_tier: "average",    charging_curve: "tapered" },
  "nissan ariya":     { awd: true,  min_dc_kw: 130, has_heat_pump: true,  has_full_adas: false, has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 195, battery_kwh: 87,  efficiency_mpge: 98,  reliability_tier: "average",    charging_curve: "tapered" },
  // ── BMW ────────────────────────────────────────────────────────────────────
  "bmw i4":           { awd: true,  min_dc_kw: 205, has_heat_pump: false, has_full_adas: true,  has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 220, battery_kwh: 84,  efficiency_mpge: 107, reliability_tier: "above_avg",  charging_curve: "tapered" },
  "bmw ix":           { awd: true,  min_dc_kw: 195, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 210, battery_kwh: 105, efficiency_mpge: 86,  reliability_tier: "above_avg",  charging_curve: "tapered" },
  "bmw i5":           { awd: true,  min_dc_kw: 205, has_heat_pump: false, has_full_adas: true,  has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 230, battery_kwh: 84,  efficiency_mpge: 105, reliability_tier: "above_avg",  charging_curve: "tapered" },
  // ── Audi/Mercedes/Premium ──────────────────────────────────────────────────
  "audi q4":          { awd: true,  min_dc_kw: 135, has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 195, battery_kwh: 82,  efficiency_mpge: 97,  reliability_tier: "average",    charging_curve: "tapered" },
  "audi q8 e-tron":   { awd: true,  min_dc_kw: 170, has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 210, battery_kwh: 114, efficiency_mpge: 78,  reliability_tier: "average",    charging_curve: "tapered" },
  "mercedes eqs":     { awd: true,  min_dc_kw: 200, has_heat_pump: false, has_full_adas: true,  has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 250, battery_kwh: 108, efficiency_mpge: 91,  reliability_tier: "average",    charging_curve: "tapered" },
  "mercedes eqb":     { awd: true,  min_dc_kw: 100, has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 175, battery_kwh: 66,  efficiency_mpge: 84,  reliability_tier: "average",    charging_curve: "steep_taper" },
  "mercedes eqe":     { awd: true,  min_dc_kw: 170, has_heat_pump: false, has_full_adas: true,  has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 230, battery_kwh: 90,  efficiency_mpge: 93,  reliability_tier: "average",    charging_curve: "tapered" },
  // ── Polestar/Volvo ─────────────────────────────────────────────────────────
  "polestar 2":       { awd: true,  min_dc_kw: 155, has_heat_pump: true,  has_full_adas: false, has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 200, battery_kwh: 78,  efficiency_mpge: 103, reliability_tier: "above_avg",  charging_curve: "tapered" },
  "polestar 3":       { awd: true,  min_dc_kw: 250, has_heat_pump: true,  has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 235, battery_kwh: 111, efficiency_mpge: 87,  reliability_tier: "above_avg",  charging_curve: "flat" },
  "volvo c40":        { awd: true,  min_dc_kw: 150, has_heat_pump: true,  has_full_adas: false, has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 195, battery_kwh: 79,  efficiency_mpge: 96,  reliability_tier: "above_avg",  charging_curve: "tapered" },
  "volvo ex40":       { awd: true,  min_dc_kw: 150, has_heat_pump: true,  has_full_adas: false, has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 195, battery_kwh: 79,  efficiency_mpge: 96,  reliability_tier: "above_avg",  charging_curve: "tapered" },
  "volvo ex90":       { awd: true,  min_dc_kw: 250, has_heat_pump: true,  has_full_adas: true,  has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 250, battery_kwh: 111, efficiency_mpge: 82,  reliability_tier: "above_avg",  charging_curve: "flat" },
  // ── Lucid/Fisker/Other ─────────────────────────────────────────────────────
  "lucid air":        { awd: true,  min_dc_kw: 300, has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 380, battery_kwh: 118, efficiency_mpge: 131, reliability_tier: "average",    charging_curve: "flat" },
  "fisker ocean":     { awd: true,  min_dc_kw: 200, has_heat_pump: true,  has_full_adas: false, has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 220, battery_kwh: 113, efficiency_mpge: 85,  reliability_tier: "below_avg",  charging_curve: "tapered" },
  "subaru solterra":  { awd: true,  min_dc_kw: 100, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: false, estimated_winter_range_mi: 180, battery_kwh: 72,  efficiency_mpge: 89,  reliability_tier: "above_avg",  charging_curve: "steep_taper" },
  "toyota bz4x":      { awd: true,  min_dc_kw: 100, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: false, estimated_winter_range_mi: 175, battery_kwh: 72,  efficiency_mpge: 86,  reliability_tier: "above_avg",  charging_curve: "steep_taper" },
  "honda prologue":   { awd: true,  min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: true,  estimated_winter_range_mi: 220, battery_kwh: 85,  efficiency_mpge: 96,  reliability_tier: "average",    charging_curve: "tapered" },
  "acura zdx":        { awd: true,  min_dc_kw: 190, has_heat_pump: false, has_full_adas: true,  has_premium_interior: true,  tow_capable: true,  estimated_winter_range_mi: 235, battery_kwh: 102, efficiency_mpge: 90,  reliability_tier: "average",    charging_curve: "tapered" },
  "jeep avenger":     { fwd: true,  min_dc_kw: 100, has_heat_pump: true,  has_full_adas: false, has_premium_interior: false, tow_capable: false, estimated_winter_range_mi: 160, battery_kwh: 54,  efficiency_mpge: 100, reliability_tier: "average",    charging_curve: "steep_taper" },
  "mini cooper se":   { fwd: true,  min_dc_kw: 50,  has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 105, battery_kwh: 32,  efficiency_mpge: 108, reliability_tier: "average",    charging_curve: "steep_taper" },
  "mini aceman":      { fwd: true,  min_dc_kw: 95,  has_heat_pump: false, has_full_adas: false, has_premium_interior: true,  tow_capable: false, estimated_winter_range_mi: 160, battery_kwh: 54,  efficiency_mpge: 104, reliability_tier: "average",    charging_curve: "steep_taper" },
};

export function getTraits(vehicleLabel: string): Partial<VehicleTraits> {
  const lower = vehicleLabel.toLowerCase();
  for (const [key, traits] of Object.entries(VEHICLE_TRAITS)) {
    if (lower.includes(key)) return traits;
  }
  return {};
}

export function reliabilityTierToScore(tier?: string): number {
  if (tier === "top")        return 90;
  if (tier === "above_avg")  return 75;
  if (tier === "average")    return 55;
  if (tier === "below_avg")  return 30;
  return 60;
}

// ============================================================
// PENALTY SYSTEM (replaces binary hard filters)
// ============================================================

function computeSpecsPenalty(
  traits: Partial<VehicleTraits>,
  prefs: VehicleSpecsPrefs,
  ctx: RoutineContext
): { penalty: number; reasons: string[] } {
  let penalty = 0;
  const reasons: string[] = [];

  // Drivetrain — severity depends on routine context
  if (prefs.drivetrain === "awd_required" && traits.awd === false) {
    const severity = ctx.needs_awd_urgently ? 40 : 20;
    penalty += severity;
    reasons.push(`No AWD${ctx.needs_awd_urgently ? " (winter + high mileage — critical)" : ""}`);
  }

  // Winter range — graduated shortfall penalty (max 30 pts)
  if (prefs.min_winter_range_mi > 0 && traits.estimated_winter_range_mi !== undefined) {
    if (traits.estimated_winter_range_mi < prefs.min_winter_range_mi) {
      const shortfall = prefs.min_winter_range_mi - traits.estimated_winter_range_mi;
      const addedPenalty = Math.round((shortfall / prefs.min_winter_range_mi) * 30);
      penalty += addedPenalty;
      reasons.push(
        `Winter range ~${traits.estimated_winter_range_mi} mi (need ${prefs.min_winter_range_mi} mi)`
      );
    }
  }

  // Fast charge — graduated by distance from target (max 25 pts for 150+ tier)
  if (prefs.fast_charge_kw === "150plus" && traits.min_dc_kw !== undefined) {
    if (traits.min_dc_kw < 150) {
      // Highway-primary users feel this more
      const weight = ctx.highway_primary ? 1.4 : 1.0;
      const addedPenalty = Math.round((1 - traits.min_dc_kw / 150) * 25 * weight);
      penalty += Math.min(35, addedPenalty);
      reasons.push(`DC fast charge ${traits.min_dc_kw} kW (prefer 150+ kW)`);
    }
  } else if (prefs.fast_charge_kw === "100_150" && traits.min_dc_kw !== undefined) {
    if (traits.min_dc_kw < 100) {
      penalty += ctx.highway_primary ? 20 : 15;
      reasons.push(`DC fast charge ${traits.min_dc_kw} kW (below 100 kW)`);
    }
  }

  // Towing — structural requirement, stays binary
  if (prefs.towing === "regularly" && traits.tow_capable === false) {
    penalty += 35;
    reasons.push("Not rated for regular towing");
  }

  return { penalty: Math.min(100, penalty), reasons };
}

// ============================================================
// SOFT PREFERENCE BONUS LOGIC
// ============================================================

function computeSoftBonus(
  candidate: ShortlistCandidate,
  prefs: VehicleSpecsPrefs,
  ctx: RoutineContext
): { matched: number; bonus: number } {
  const traits = getTraits(candidate.vehicle_label);
  let matched = 0;
  let bonus = 0;

  // Heat pump — worth 2× in winter context
  const heatPumpWeight = ctx.highway_primary || prefs.heat_pump === "must_have" ? 2 : 1;
  if (prefs.heat_pump === "must_have" || prefs.heat_pump === "nice_to_have") {
    if (traits.has_heat_pump) {
      matched++;
      bonus += 5 * heatPumpWeight;
    }
  } else {
    matched++;
    bonus += 5;
  }

  // ADAS
  if (prefs.adas.includes("none")) {
    matched++;
    bonus += 5;
  } else if (prefs.adas.includes("full_adas") && traits.has_full_adas) {
    matched++;
    bonus += 5;
  } else if (prefs.adas.includes("basic_cruise_lane")) {
    matched++;
    bonus += 5;
  }

  // Interior
  if (prefs.interior === "any") {
    matched++;
    bonus += 5;
  } else if (prefs.interior === "premium_touchscreen" && traits.has_premium_interior) {
    matched++;
    bonus += 5;
  } else if (prefs.interior === "simple_interface" && !traits.has_premium_interior) {
    matched++;
    bonus += 5;
  }

  // Wheel size
  if (prefs.wheel_size === "18_19_fine") {
    matched++;
    bonus += 5;
  } else if (prefs.wheel_size === "smaller_efficiency") {
    const lower = candidate.vehicle_label.toLowerCase();
    if (lower.includes("bolt") || lower.includes("leaf") || lower.includes("ioniq 6") || lower.includes("model 3")) {
      matched++;
      bonus += 5;
    }
  } else if (prefs.wheel_size === "style_matters") {
    if (traits.has_premium_interior) {
      matched++;
      bonus += 5;
    }
  }

  // Winter readiness
  if (prefs.winter_readiness === "mild_climate") {
    matched++;
    bonus += 5;
  } else if (prefs.winter_readiness === "all_season_ok") {
    matched++;
    bonus += 5;
  } else if (prefs.winter_readiness === "awd_dedicated_tires" && traits.awd) {
    matched++;
    bonus += 5;
  }

  // Charging speed bonus for highway-primary users (extra weight)
  if (ctx.highway_primary && traits.min_dc_kw !== undefined && traits.min_dc_kw >= 150) {
    bonus += 5;
  }

  return { matched, bonus: Math.min(35, bonus) };
}

// ============================================================
// MAIN EXPORT
// ============================================================

export function applySpecsFilter(
  candidates: ShortlistCandidate[],
  prefs: VehicleSpecsPrefs,
  mvr?: MinimumViableRoutine,
  chargerDensity?: string
): SpecsMatchResult[] {
  // Derive context from routine (neutral defaults when not provided)
  const ctx: RoutineContext = mvr
    ? deriveRoutineContext(mvr, chargerDensity)
    : { needs_awd_urgently: false, highway_primary: false, charging_scarce: false, budget_tight: false };

  return candidates.map((candidate) => {
    const traits = getTraits(candidate.vehicle_label);
    const { penalty, reasons } = computeSpecsPenalty(traits, prefs, ctx);
    const { matched, bonus } = computeSoftBonus(candidate, prefs, ctx);

    // Backwards compat: treat penalty < 35 as "passed" (equivalent to soft warnings)
    const passed_hard_filters = penalty < 35;

    const hardMatched = passed_hard_filters ? 4 : 0;
    const totalMatched = hardMatched + matched;
    const totalQuestions = 9;

    return {
      candidate,
      penalty_score: penalty,
      penalty_reasons: reasons,
      passed_hard_filters,
      hard_filter_reason: reasons.length > 0 ? reasons[0] : undefined,
      matched_prefs: matched,
      total_prefs: 5,
      specs_bonus: bonus,
      match_label: `Matches ${totalMatched} of ${totalQuestions} specs`,
    };
  });
}

// ============================================================
// STORAGE HELPERS
// ============================================================

export function saveSpecsPrefs(runId: string, prefs: VehicleSpecsPrefs): void {
  try {
    localStorage.setItem(`offo_specs_${runId}`, JSON.stringify(prefs));
  } catch {
    // silent
  }
}

export function loadSpecsPrefs(runId: string): VehicleSpecsPrefs | null {
  try {
    const raw = localStorage.getItem(`offo_specs_${runId}`);
    if (!raw) return null;
    return JSON.parse(raw) as VehicleSpecsPrefs;
  } catch {
    return null;
  }
}
