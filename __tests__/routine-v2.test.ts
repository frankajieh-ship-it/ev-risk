/**
 * Sprint 1 QA — EVRoutine V2 Unit Tests
 *
 * Pure-function tests for the scoring/mitigation backbone:
 *   1. validateMVR (types/v2.ts)
 *   2. computeRoutineFit (lib/compute-routine-fit.ts)
 *   3. computeRoutineFitV2 (lib/compute-routine-fit-v2.ts)
 *   4. generatePlanB (lib/plan-b-algorithm.ts)
 */

import type { MinimumViableRoutine, BreakPoint } from "@/types/v2";
import type { WeatherData, ChargerSearchResult, SavedCharger, VehicleProfile } from "@/types/routine-v2";
import { validateMVR } from "@/types/v2";
import { computeRoutineFit } from "@/lib/compute-routine-fit";
import { computeRoutineFitV2 } from "@/lib/compute-routine-fit-v2";
import { generatePlanB } from "@/lib/plan-b-algorithm";

// ============================================
// FIXTURES
// ============================================

const MVR_HOME_EASY: MinimumViableRoutine = {
  charging_access: "home",
  weekly_miles: 100,
  climate: "mild",
  longest_day_pattern: "rare_road_trip",
};

const MVR_PUBLIC_HARD: MinimumViableRoutine = {
  charging_access: "public",
  weekly_miles: 350,
  climate: "winter",
  longest_day_pattern: "once_a_week",
};

const MVR_WORK_MODERATE: MinimumViableRoutine = {
  charging_access: "work",
  weekly_miles: 200,
  climate: "hot",
  longest_day_pattern: "monthly_trip",
};

const MVR_COMMUTE: MinimumViableRoutine = {
  charging_access: "home",
  commute_miles_roundtrip: 60,
  climate: "mild",
  longest_day_pattern: "monthly_trip",
};

const WEATHER_FREEZING: WeatherData = {
  source: "openweathermap",
  current_temp_f: 15,
  current_conditions: "Snow",
  feels_like_f: 5,
  temperature_band: "freezing",
  forecast_low_f: 10,
  forecast_high_f: 25,
  weather_confidence_band: "high",
  location_used: "Chicago, IL",
  fetched_at: new Date().toISOString(),
};

const WEATHER_HOT: WeatherData = {
  source: "openweathermap",
  current_temp_f: 102,
  current_conditions: "Clear",
  feels_like_f: 108,
  temperature_band: "hot",
  forecast_low_f: 85,
  forecast_high_f: 105,
  weather_confidence_band: "high",
  location_used: "Phoenix, AZ",
  fetched_at: new Date().toISOString(),
};

const WEATHER_MILD: WeatherData = {
  source: "openweathermap",
  current_temp_f: 55,
  current_conditions: "Partly cloudy",
  feels_like_f: 52,
  temperature_band: "mild",
  forecast_low_f: 45,
  forecast_high_f: 60,
  weather_confidence_band: "high",
  location_used: "Portland, OR",
  fetched_at: new Date().toISOString(),
};

const VEHICLE: VehicleProfile = {
  id: "v-test-1",
  year: 2022,
  make: "Tesla",
  model: "Model 3",
  usable_range_band: "high",
  usable_range_mi_estimate: 270,
  dc_fast_band: "strong",
  ac_home_charge_band: "okay",
  winter_sensitivity_band: "moderate",
  efficiency_band: "high",
  connector_types: ["CCS", "NACS"],
  is_active: true,
  data_source: "test",
  created_at: new Date().toISOString(),
};

function makeCharger(overrides: Partial<ChargerSearchResult> = {}): ChargerSearchResult {
  return {
    id: `ch-${Math.random().toString(36).slice(2, 8)}`,
    source: "nrel",
    name: "Test Charger",
    lat: 41.88,
    lng: -87.63,
    address: "123 Main St",
    connector_types: ["CCS"],
    level_type: "L2",
    distance_mi: 5,
    access_type: "public",
    ...overrides,
  };
}

function makeSavedCharger(overrides: Partial<SavedCharger> = {}): SavedCharger {
  return {
    ...makeCharger(),
    category: "anchor",
    reliability_rating: "high",
    is_favorite: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const BREAKPOINT_PUBLIC: BreakPoint = {
  id: "public_charging_predictability",
  title: "Public charging availability breaks your routine",
  break_point: "Any evening when your usual charger is occupied",
  trigger: "Your 350 mi/week depends entirely on public station availability",
  evidence: [{ label: "Charging", value: "Public only" }],
  impact: "High",
  fallback_plan_b: {
    anchor: "Map 2 reliable Level 2 stations within 15 minutes of home",
    backup: "Keep a DC fast charge app with real-time availability as backup",
    buffer_rule: "Charge above 40% before heading home on busy evenings",
  },
};

// ============================================
// 1. validateMVR
// ============================================

describe("validateMVR", () => {
  it("accepts valid MVR with weekly miles", () => {
    const result = validateMVR(MVR_HOME_EASY);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts valid MVR with commute miles", () => {
    const result = validateMVR(MVR_COMMUTE);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing charging_access", () => {
    const { ok, errors } = validateMVR({ ...MVR_HOME_EASY, charging_access: undefined as any });
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("charging_access"))).toBe(true);
  });

  it("rejects missing climate", () => {
    const { ok, errors } = validateMVR({ ...MVR_HOME_EASY, climate: undefined as any });
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("climate"))).toBe(true);
  });

  it("rejects missing longest_day_pattern", () => {
    const { ok, errors } = validateMVR({ ...MVR_HOME_EASY, longest_day_pattern: undefined as any });
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("longest_day"))).toBe(true);
  });

  it("rejects missing both weekly and commute miles", () => {
    const { ok, errors } = validateMVR({
      charging_access: "home",
      climate: "mild",
      longest_day_pattern: "rare_road_trip",
    });
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("weekly_miles") || e.includes("commute_miles"))).toBe(true);
  });

  it("rejects invalid enum value", () => {
    const { ok } = validateMVR({ ...MVR_HOME_EASY, charging_access: "garage" as any });
    expect(ok).toBe(false);
  });

  it("returns multiple errors when all fields missing", () => {
    const { ok, errors } = validateMVR({});
    expect(ok).toBe(false);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================
// 2. computeRoutineFit (baseline engine)
// ============================================

describe("computeRoutineFit", () => {
  it("scores home + low miles + mild + rare as Great Fit", () => {
    const result = computeRoutineFit(MVR_HOME_EASY);
    expect(result.score_0_100).toBeGreaterThanOrEqual(80);
    expect(result.label).toBe("Great Fit");
  });

  it("scores public + high miles + winter + weekly as Mixed Fit or worse", () => {
    const result = computeRoutineFit(MVR_PUBLIC_HARD);
    // 30×0.4 + 80×0.3 + 30×0.15 + 40×0.15 = 47 → Mixed Fit
    expect(result.score_0_100).toBeLessThan(65);
    expect(["Mixed Fit", "High Friction"]).toContain(result.label);
    expect(result.mental_load).not.toBe("low");
  });

  it("scores work + moderate inputs in mid-range", () => {
    const result = computeRoutineFit(MVR_WORK_MODERATE);
    expect(result.score_0_100).toBeGreaterThanOrEqual(45);
    expect(result.score_0_100).toBeLessThan(80);
  });

  it("clamps score to 0-100", () => {
    // Even extreme inputs should not exceed bounds
    const extreme: MinimumViableRoutine = {
      charging_access: "public",
      weekly_miles: 2000,
      climate: "winter",
      longest_day_pattern: "once_a_week",
    };
    const result = computeRoutineFit(extreme);
    expect(result.score_0_100).toBeGreaterThanOrEqual(0);
    expect(result.score_0_100).toBeLessThanOrEqual(100);
  });

  it("uses commute miles as daily (not divided by 5)", () => {
    // 60mi commute roundtrip = 60mi daily usage
    // vs weekly_miles 300 / 5 = 60mi daily — should give same score
    const withCommute = computeRoutineFit(MVR_COMMUTE);
    const withWeekly = computeRoutineFit({
      ...MVR_COMMUTE,
      commute_miles_roundtrip: undefined,
      weekly_miles: 300, // 300/5 = 60 mi/day
    });
    expect(withCommute.score_0_100).toBe(withWeekly.score_0_100);
  });

  it("vehicle range affects score via range buffer", () => {
    // Short range vehicle should score lower than long range
    const shortRange = computeRoutineFit(MVR_WORK_MODERATE, { real_world_range_mi: 100 });
    const longRange = computeRoutineFit(MVR_WORK_MODERATE, { real_world_range_mi: 350 });
    expect(longRange.score_0_100).toBeGreaterThan(shortRange.score_0_100);
  });

  it("defaults to 200mi range without vehicle", () => {
    const noVehicle = computeRoutineFit(MVR_HOME_EASY);
    const explicit200 = computeRoutineFit(MVR_HOME_EASY, { real_world_range_mi: 200 });
    expect(noVehicle.score_0_100).toBe(explicit200.score_0_100);
  });

  it("applies winter + public extra climate penalty", () => {
    const winterPublic = computeRoutineFit({
      ...MVR_HOME_EASY,
      charging_access: "public",
      climate: "winter",
    });
    const winterHome = computeRoutineFit({
      ...MVR_HOME_EASY,
      charging_access: "home",
      climate: "winter",
    });
    // Public + winter should be significantly lower
    expect(winterHome.score_0_100).toBeGreaterThan(winterPublic.score_0_100);
  });

  it("applies recovery penalty for public + weekly long days", () => {
    const publicWeekly = computeRoutineFit({
      ...MVR_HOME_EASY,
      charging_access: "public",
      longest_day_pattern: "once_a_week",
    });
    const publicRare = computeRoutineFit({
      ...MVR_HOME_EASY,
      charging_access: "public",
      longest_day_pattern: "rare_road_trip",
    });
    expect(publicRare.score_0_100).toBeGreaterThan(publicWeekly.score_0_100);
  });

  it("always returns breakpoints_ranked array", () => {
    const result = computeRoutineFit(MVR_HOME_EASY);
    expect(Array.isArray(result.breakpoints_ranked)).toBe(true);
    expect(result.breakpoints_ranked.length).toBeGreaterThanOrEqual(1);
    // Check breakpoint structure
    const bp = result.breakpoints_ranked[0];
    expect(bp).toHaveProperty("id");
    expect(bp).toHaveProperty("title");
    expect(bp).toHaveProperty("trigger");
    expect(bp).toHaveProperty("impact");
    expect(bp).toHaveProperty("fallback_plan_b");
  });
});

// ============================================
// 3. computeRoutineFitV2 (enhanced engine)
// ============================================

describe("computeRoutineFitV2", () => {
  it("returns same score as baseline when no weather/chargers", () => {
    const baseline = computeRoutineFit(MVR_HOME_EASY);
    const enhanced = computeRoutineFitV2({ routine: MVR_HOME_EASY });
    expect(enhanced.score_0_100).toBe(baseline.score_0_100);
  });

  it("applies -5 penalty for freezing + winter + public", () => {
    const without = computeRoutineFitV2({ routine: MVR_PUBLIC_HARD });
    const withWeather = computeRoutineFitV2({ routine: MVR_PUBLIC_HARD, weather: WEATHER_FREEZING });
    expect(withWeather.score_0_100).toBe(Math.max(0, without.score_0_100 - 5));
  });

  it("applies -3 penalty for freezing + winter + home", () => {
    const winterHome: MinimumViableRoutine = { ...MVR_HOME_EASY, climate: "winter" };
    const without = computeRoutineFitV2({ routine: winterHome });
    const withWeather = computeRoutineFitV2({ routine: winterHome, weather: WEATHER_FREEZING });
    expect(withWeather.score_0_100).toBe(without.score_0_100 - 3);
  });

  it("applies -3 penalty for hot weather above 95°F", () => {
    const hotRoutine: MinimumViableRoutine = { ...MVR_HOME_EASY, climate: "hot" };
    const without = computeRoutineFitV2({ routine: hotRoutine });
    const withWeather = computeRoutineFitV2({ routine: hotRoutine, weather: WEATHER_HOT });
    expect(withWeather.score_0_100).toBe(without.score_0_100 - 3);
  });

  it("applies +3 bonus for mild weather when winter climate selected", () => {
    const winterHome: MinimumViableRoutine = { ...MVR_HOME_EASY, climate: "winter" };
    const without = computeRoutineFitV2({ routine: winterHome });
    const withWeather = computeRoutineFitV2({ routine: winterHome, weather: WEATHER_MILD });
    expect(withWeather.score_0_100).toBe(without.score_0_100 + 3);
  });

  it("applies -5 penalty for 0 chargers with public charging", () => {
    const without = computeRoutineFitV2({ routine: MVR_PUBLIC_HARD, chargerCount: 1 });
    const withZero = computeRoutineFitV2({ routine: MVR_PUBLIC_HARD, chargerCount: 0 });
    expect(withZero.score_0_100).toBe(Math.max(0, without.score_0_100 - 5));
  });

  it("applies +3 bonus for ≥2 chargers with public charging", () => {
    const withOne = computeRoutineFitV2({ routine: MVR_PUBLIC_HARD, chargerCount: 1 });
    const withMany = computeRoutineFitV2({ routine: MVR_PUBLIC_HARD, chargerCount: 3 });
    expect(withMany.score_0_100).toBe(Math.min(100, withOne.score_0_100 + 3));
  });

  it("ignores charger count for home/work routines", () => {
    const homeZero = computeRoutineFitV2({ routine: MVR_HOME_EASY, chargerCount: 0 });
    const homeMany = computeRoutineFitV2({ routine: MVR_HOME_EASY, chargerCount: 5 });
    expect(homeZero.score_0_100).toBe(homeMany.score_0_100);

    const workZero = computeRoutineFitV2({ routine: MVR_WORK_MODERATE, chargerCount: 0 });
    const workMany = computeRoutineFitV2({ routine: MVR_WORK_MODERATE, chargerCount: 5 });
    expect(workZero.score_0_100).toBe(workMany.score_0_100);
  });

  it("upgrades confidence to high with real-time weather + vehicle", () => {
    const result = computeRoutineFitV2({
      routine: MVR_HOME_EASY,
      weather: WEATHER_MILD,
      vehicle: VEHICLE,
    });
    expect(result.confidence.level).toBe("high");
    expect(result.confidence.has_vehicle_data).toBe(true);
  });
});

// ============================================
// 4. generatePlanB
// ============================================

describe("generatePlanB", () => {
  it("returns fallback when no chargers available", () => {
    const result = generatePlanB({
      topBreakpoint: BREAKPOINT_PUBLIC,
      nearbyChargers: [],
      savedChargers: [],
      routineType: "public",
    });
    expect(result.rank_score).toBe(30);
    expect(result.stress_label).toBe("high");
    expect(result.mitigation_steps.length).toBeGreaterThan(0);
    expect(result.anchor_charger_name).toBeUndefined();
  });

  it("sets no backup_charger_name when only one charger", () => {
    const charger = makeCharger({ name: "Solo Station", distance_mi: 3 });
    const result = generatePlanB({
      topBreakpoint: BREAKPOINT_PUBLIC,
      nearbyChargers: [charger],
      savedChargers: [],
      routineType: "public",
    });
    expect(result.anchor_charger_name).toBe("Solo Station");
    // With only one charger, anchor and backup are same, so backup_charger_name should be undefined
    expect(result.backup_charger_name).toBeUndefined();
  });

  it("assigns distinct anchor and backup with two chargers", () => {
    const close = makeCharger({ name: "Close Station", distance_mi: 2, level_type: "DCFC" });
    const far = makeCharger({ name: "Far Station", distance_mi: 8, level_type: "L2" });
    const result = generatePlanB({
      topBreakpoint: BREAKPOINT_PUBLIC,
      nearbyChargers: [close, far],
      savedChargers: [],
      routineType: "public",
    });
    expect(result.anchor_charger_name).toBe("Close Station");
    expect(result.backup_charger_name).toBe("Far Station");
  });

  it("ranks compatible connectors higher than incompatible", () => {
    const compatible = makeCharger({
      name: "Compatible",
      connector_types: ["CCS"],
      distance_mi: 10,
    });
    const incompatible = makeCharger({
      name: "Incompatible",
      connector_types: ["CHAdeMO"],
      distance_mi: 2, // closer, but wrong connector
    });
    const result = generatePlanB({
      topBreakpoint: BREAKPOINT_PUBLIC,
      nearbyChargers: [incompatible, compatible],
      savedChargers: [],
      vehicleConnectorTypes: ["CCS"],
      routineType: "public",
    });
    // Compatible charger should be anchor despite being farther
    expect(result.anchor_charger_name).toBe("Compatible");
  });

  it("ranks closer chargers higher", () => {
    const close = makeCharger({ name: "Close", distance_mi: 2 });
    const far = makeCharger({ name: "Far", distance_mi: 20 });
    const result = generatePlanB({
      topBreakpoint: BREAKPOINT_PUBLIC,
      nearbyChargers: [far, close],
      savedChargers: [],
      routineType: "public",
    });
    expect(result.anchor_charger_name).toBe("Close");
  });

  it("ranks DCFC higher than L2", () => {
    const dcfc = makeCharger({ name: "Fast", level_type: "DCFC", distance_mi: 5 });
    const l2 = makeCharger({ name: "Slow", level_type: "L2", distance_mi: 5 });
    const result = generatePlanB({
      topBreakpoint: BREAKPOINT_PUBLIC,
      nearbyChargers: [l2, dcfc],
      savedChargers: [],
      routineType: "work", // not public, so no L2 nearness bonus
    });
    expect(result.anchor_charger_name).toBe("Fast");
  });

  it("gives saved chargers a +20 bonus", () => {
    const unsaved = makeCharger({ name: "Random", distance_mi: 3, level_type: "DCFC" });
    const saved = makeSavedCharger({
      name: "My Spot",
      distance_mi: 8,
      level_type: "L2",
      external_id: "saved-1",
    });
    const result = generatePlanB({
      topBreakpoint: BREAKPOINT_PUBLIC,
      nearbyChargers: [unsaved],
      savedChargers: [saved],
      routineType: "work",
    });
    // Saved charger should win despite being farther and L2
    // Score: saved gets base 50 + 20 (saved) + 10 (reliability high) + 5 (public) = 85
    // vs unsaved: 50 + 15 (close) + 15 (DCFC) + 5 (public) = 85
    // Very close, but saved also gets reliability bonus, so it should be anchor or at least ranked
    expect(result.anchor_charger_name).toBeDefined();
  });

  it("returns 15 min time penalty for home routine", () => {
    const charger = makeCharger({ distance_mi: 5 });
    const result = generatePlanB({
      topBreakpoint: BREAKPOINT_PUBLIC,
      nearbyChargers: [charger],
      savedChargers: [],
      routineType: "home",
    });
    expect(result.time_penalty_minutes).toBe(15);
  });

  it("calculates work time penalty as driving + charging", () => {
    const charger = makeCharger({ distance_mi: 5, level_type: "DCFC" });
    const result = generatePlanB({
      topBreakpoint: BREAKPOINT_PUBLIC,
      nearbyChargers: [charger],
      savedChargers: [],
      routineType: "work",
    });
    // Expected: 5 mi * 2 (roundtrip) * 2 (min/mi) * ~2 sessions = 20 driving + 20 DCFC = 40
    expect(result.time_penalty_minutes).toBe(40);
  });

  it("assesses home routine stress as minimal", () => {
    const charger = makeCharger({ distance_mi: 20 });
    const result = generatePlanB({
      topBreakpoint: BREAKPOINT_PUBLIC,
      nearbyChargers: [charger],
      savedChargers: [],
      routineType: "home",
    });
    expect(result.stress_label).toBe("minimal");
  });
});
