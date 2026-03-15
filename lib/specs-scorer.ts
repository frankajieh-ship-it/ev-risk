/**
 * Specs Scorer — Pure client-side filter + preference bonus
 *
 * Takes ShortlistCandidates + VehicleSpecsPrefs and returns scored results.
 * Hard filters flag non-matching candidates. Soft prefs add up to 25 bonus points.
 */

import type { VehicleSpecsPrefs } from "@/types/v2";
import type { ShortlistCandidate } from "./shortlist-coach";

// ============================================================
// TYPES
// ============================================================

export interface SpecsMatchResult {
  candidate: ShortlistCandidate;
  passed_hard_filters: boolean;
  hard_filter_reason?: string; // why it failed (if it did)
  matched_prefs: number; // 0–5 soft prefs matched
  total_prefs: number; // always 5
  specs_bonus: number; // 0–25 points (5 per matched soft pref)
  match_label: string; // e.g. "Matches 8 of 9 specs"
}

// ============================================================
// STATIC VEHICLE METADATA
// Known hardware traits keyed by model name substring (lowercase)
// ============================================================

interface VehicleTraits {
  awd: boolean;
  rwd: boolean;
  fwd: boolean;
  min_dc_kw: number; // DC fast charge max (kW)
  has_heat_pump: boolean;
  has_full_adas: boolean;
  has_premium_interior: boolean;
  tow_capable: boolean; // can tow meaningfully (>2000 lb)
  estimated_winter_range_mi: number; // ~80% of EPA range
}

const VEHICLE_TRAITS: Record<string, Partial<VehicleTraits>> = {
  "model y": { awd: true, min_dc_kw: 250, has_heat_pump: true, has_full_adas: true, has_premium_interior: true, estimated_winter_range_mi: 220 },
  "model 3": { awd: true, min_dc_kw: 250, has_heat_pump: true, has_full_adas: true, has_premium_interior: true, estimated_winter_range_mi: 240 },
  "ioniq 6": { awd: true, min_dc_kw: 230, has_heat_pump: true, has_full_adas: true, has_premium_interior: true, estimated_winter_range_mi: 230 },
  "ioniq 5": { awd: true, min_dc_kw: 230, has_heat_pump: true, has_full_adas: true, has_premium_interior: false, estimated_winter_range_mi: 200 },
  "bolt euv": { fwd: true, min_dc_kw: 55, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, estimated_winter_range_mi: 180 },
  "bolt ev": { fwd: true, min_dc_kw: 55, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, estimated_winter_range_mi: 190 },
  "mach-e": { awd: true, min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: true, tow_capable: true, estimated_winter_range_mi: 195 },
  "mustang mach-e": { awd: true, min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: true, tow_capable: true, estimated_winter_range_mi: 195 },
  "f-150 lightning": { awd: true, min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, tow_capable: true, estimated_winter_range_mi: 190 },
  "rivian r1t": { awd: true, min_dc_kw: 200, has_heat_pump: false, has_full_adas: false, has_premium_interior: true, tow_capable: true, estimated_winter_range_mi: 220 },
  "rivian r1s": { awd: true, min_dc_kw: 200, has_heat_pump: false, has_full_adas: false, has_premium_interior: true, tow_capable: true, estimated_winter_range_mi: 200 },
  "id.4": { awd: true, min_dc_kw: 135, has_heat_pump: true, has_full_adas: false, has_premium_interior: false, estimated_winter_range_mi: 185 },
  "volkswagen id.4": { awd: true, min_dc_kw: 135, has_heat_pump: true, has_full_adas: false, has_premium_interior: false, estimated_winter_range_mi: 185 },
  "chevy equinox": { fwd: true, min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, estimated_winter_range_mi: 210 },
  "equinox ev": { fwd: true, min_dc_kw: 150, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, estimated_winter_range_mi: 210 },
  "leaf": { fwd: true, min_dc_kw: 50, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, estimated_winter_range_mi: 130 },
  "nissan leaf": { fwd: true, min_dc_kw: 50, has_heat_pump: false, has_full_adas: false, has_premium_interior: false, estimated_winter_range_mi: 130 },
  "kia ev6": { awd: true, min_dc_kw: 230, has_heat_pump: true, has_full_adas: false, has_premium_interior: false, estimated_winter_range_mi: 220 },
  "genesis gv60": { awd: true, min_dc_kw: 230, has_heat_pump: true, has_full_adas: true, has_premium_interior: true, estimated_winter_range_mi: 200 },
  "bmw i4": { awd: true, min_dc_kw: 205, has_heat_pump: false, has_full_adas: true, has_premium_interior: true, estimated_winter_range_mi: 220 },
  "bmw ix": { awd: true, min_dc_kw: 195, has_heat_pump: true, has_full_adas: true, has_premium_interior: true, estimated_winter_range_mi: 210 },
  "audi q4": { awd: true, min_dc_kw: 135, has_heat_pump: false, has_full_adas: false, has_premium_interior: true, estimated_winter_range_mi: 195 },
  "mercedes eqs": { awd: true, min_dc_kw: 200, has_heat_pump: false, has_full_adas: true, has_premium_interior: true, estimated_winter_range_mi: 250 },
  "mercedes eqb": { awd: true, min_dc_kw: 100, has_heat_pump: false, has_full_adas: false, has_premium_interior: true, estimated_winter_range_mi: 175 },
  "polestar 2": { awd: true, min_dc_kw: 155, has_heat_pump: true, has_full_adas: false, has_premium_interior: true, estimated_winter_range_mi: 200 },
  "volvo c40": { awd: true, min_dc_kw: 150, has_heat_pump: true, has_full_adas: false, has_premium_interior: true, estimated_winter_range_mi: 195 },
  "volvo ex40": { awd: true, min_dc_kw: 150, has_heat_pump: true, has_full_adas: false, has_premium_interior: true, estimated_winter_range_mi: 195 },
};

function getTraits(vehicleLabel: string): Partial<VehicleTraits> {
  const lower = vehicleLabel.toLowerCase();
  for (const [key, traits] of Object.entries(VEHICLE_TRAITS)) {
    if (lower.includes(key)) return traits;
  }
  return {};
}

// ============================================================
// HARD FILTER LOGIC
// ============================================================

function checkHardFilters(
  candidate: ShortlistCandidate,
  prefs: VehicleSpecsPrefs
): { passed: boolean; reason?: string } {
  const traits = getTraits(candidate.vehicle_label);

  // Drivetrain — only filter if we have data
  if (prefs.drivetrain === "awd_required") {
    if (traits.awd === false) {
      return { passed: false, reason: "Doesn't have AWD" };
    }
  }

  // Winter range floor — only filter if we have an estimate
  if (prefs.min_winter_range_mi > 0 && traits.estimated_winter_range_mi !== undefined) {
    if (traits.estimated_winter_range_mi < prefs.min_winter_range_mi) {
      return {
        passed: false,
        reason: `Estimated winter range (~${traits.estimated_winter_range_mi} mi) falls short of your ${prefs.min_winter_range_mi} mi floor`,
      };
    }
  }

  // Fast-charge speed — only filter if we have data
  if (prefs.fast_charge_kw === "150plus" && traits.min_dc_kw !== undefined) {
    if (traits.min_dc_kw < 150) {
      return {
        passed: false,
        reason: `DC fast-charge speed (${traits.min_dc_kw} kW) is below your 150 kW minimum`,
      };
    }
  }

  // Towing — only filter if user needs it regularly and we know the vehicle can't tow
  if (prefs.towing === "regularly" && traits.tow_capable === false) {
    return { passed: false, reason: "Not rated for regular towing" };
  }

  return { passed: true };
}

// ============================================================
// SOFT PREFERENCE BONUS LOGIC
// ============================================================

function computeSoftBonus(
  candidate: ShortlistCandidate,
  prefs: VehicleSpecsPrefs
): { matched: number; bonus: number } {
  const traits = getTraits(candidate.vehicle_label);
  let matched = 0;

  // Heat pump
  if (prefs.heat_pump === "must_have" || prefs.heat_pump === "nice_to_have") {
    if (traits.has_heat_pump) matched++;
  } else {
    // "not_important" → always counts as a match (preference satisfied)
    matched++;
  }

  // ADAS
  if (prefs.adas.includes("none")) {
    matched++; // no ADAS preference → always satisfied
  } else if (prefs.adas.includes("full_adas") && traits.has_full_adas) {
    matched++;
  } else if (prefs.adas.includes("basic_cruise_lane")) {
    // Most modern EVs have basic cruise+lane — give benefit of the doubt
    matched++;
  }

  // Interior
  if (prefs.interior === "any") {
    matched++;
  } else if (prefs.interior === "premium_touchscreen" && traits.has_premium_interior) {
    matched++;
  } else if (prefs.interior === "simple_interface" && !traits.has_premium_interior) {
    matched++;
  }

  // Wheel size — proxy via efficiency preference vs. vehicle type
  if (prefs.wheel_size === "18_19_fine") {
    matched++; // most EVs fit this
  } else if (prefs.wheel_size === "smaller_efficiency") {
    // Efficiency-focused models (Bolt, Leaf, Ioniq 6)
    const lower = candidate.vehicle_label.toLowerCase();
    if (lower.includes("bolt") || lower.includes("leaf") || lower.includes("ioniq 6") || lower.includes("model 3")) {
      matched++;
    }
  } else if (prefs.wheel_size === "style_matters") {
    // Premium vehicles
    if (traits.has_premium_interior) matched++;
  }

  // Winter readiness
  if (prefs.winter_readiness === "mild_climate") {
    matched++; // no winter requirement → always satisfied
  } else if (prefs.winter_readiness === "all_season_ok") {
    matched++; // most modern EVs are fine with all-seasons
  } else if (prefs.winter_readiness === "awd_dedicated_tires" && traits.awd) {
    matched++;
  }

  return { matched, bonus: matched * 5 };
}

// ============================================================
// MAIN EXPORT
// ============================================================

export function applySpecsFilter(
  candidates: ShortlistCandidate[],
  prefs: VehicleSpecsPrefs
): SpecsMatchResult[] {
  return candidates.map((candidate) => {
    const hardCheck = checkHardFilters(candidate, prefs);
    const { matched, bonus } = computeSoftBonus(candidate, prefs);

    // Total match count: 4 hard filter questions + 5 soft pref questions
    // Hard filters either pass or fail as a group; count passed hard as 4 or 0
    const hardMatched = hardCheck.passed ? 4 : 0;
    const totalMatched = hardMatched + matched;
    const totalQuestions = 9;

    return {
      candidate,
      passed_hard_filters: hardCheck.passed,
      hard_filter_reason: hardCheck.reason,
      matched_prefs: matched,
      total_prefs: 5,
      specs_bonus: hardCheck.passed ? bonus : 0,
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
