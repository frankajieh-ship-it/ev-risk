/**
 * computeRoutineFit - V2 Primary Scoring Engine
 *
 * Pure function: MVR + optional vehicle basics → RoutineFitScore
 * Client-safe (no fs imports). Works WITHOUT battery/VIN data.
 *
 * Scoring dimensions (weighted):
 * - Charging Stress (40%): home=100, work=65, public=30
 * - Range Buffer (30%): dailyMiles / effectiveRange ratio
 * - Recovery Resilience (15%): longest_day_pattern, compounds with charging_access
 * - Climate Friction (15%): winter/hot penalties, compounds with public charging
 */

import type {
  MinimumViableRoutine,
  RoutineFitScore,
  StressFlag,
  WhatBreaksFirst,
  RoutineFitConfidence,
} from "@/types/v2";

interface VehicleBasics {
  model?: string;
  year?: number;
  real_world_range_mi?: number;
}

export function computeRoutineFit(
  mvr: MinimumViableRoutine,
  vehicle?: VehicleBasics
): RoutineFitScore {
  const effectiveDailyMiles = mvr.commute_miles_roundtrip
    ? mvr.commute_miles_roundtrip
    : (mvr.weekly_miles ?? 100) / 5;

  const effectiveRange = vehicle?.real_world_range_mi ?? 200;

  // ---- DIMENSION 1: Charging Stress (40%) ----
  let chargingScore: number;
  if (mvr.charging_access === "home") {
    chargingScore = 100;
  } else if (mvr.charging_access === "work") {
    chargingScore = 65;
  } else {
    chargingScore = 30;
  }

  // ---- DIMENSION 2: Range Buffer (30%) ----
  const dailyUsagePct = (effectiveDailyMiles / effectiveRange) * 100;
  let rangeScore: number;
  if (dailyUsagePct < 30) rangeScore = 100;
  else if (dailyUsagePct < 50) rangeScore = 80;
  else if (dailyUsagePct < 70) rangeScore = 55;
  else rangeScore = 25;

  // ---- DIMENSION 3: Recovery Resilience (15%) ----
  let recoveryScore: number;
  if (mvr.longest_day_pattern === "once_a_week") {
    recoveryScore = 50;
  } else if (mvr.longest_day_pattern === "monthly_trip") {
    recoveryScore = 75;
  } else {
    recoveryScore = 95;
  }

  // Cross-interaction: public charging + frequent long days = worse
  if (mvr.charging_access === "public" && mvr.longest_day_pattern === "once_a_week") {
    recoveryScore = Math.max(0, recoveryScore - 20);
  }
  if (mvr.charging_access === "work" && mvr.longest_day_pattern === "once_a_week") {
    recoveryScore = Math.max(0, recoveryScore - 10);
  }

  // ---- DIMENSION 4: Climate Friction (15%) ----
  let climateScore: number;
  if (mvr.climate === "winter") {
    climateScore = 60;
    if (mvr.charging_access === "public") climateScore = 40;
  } else if (mvr.climate === "hot") {
    climateScore = 75;
  } else {
    climateScore = 100;
  }

  // ---- WEIGHTED TOTAL ----
  const rawScore = Math.round(
    chargingScore * 0.4 +
    rangeScore * 0.3 +
    recoveryScore * 0.15 +
    climateScore * 0.15
  );
  const score = Math.max(0, Math.min(100, rawScore));

  // ---- LABEL ----
  const label: RoutineFitScore["label"] =
    score >= 80 ? "Great Fit"
    : score >= 65 ? "Good Fit"
    : score >= 45 ? "Conditional Fit"
    : "High Friction";

  // ---- MENTAL LOAD ----
  const mental_load: RoutineFitScore["mental_load"] =
    score >= 75 ? "low"
    : score >= 50 ? "medium"
    : "high";

  // ---- STRESS FLAGS (max 3) ----
  const stress_flags = buildStressFlags(mvr, effectiveDailyMiles, effectiveRange);

  // ---- WHAT BREAKS FIRST ----
  const what_breaks_first = buildWhatBreaksFirst(mvr, effectiveDailyMiles, effectiveRange);

  // ---- CONFIDENCE ----
  const confidence: RoutineFitConfidence = {
    level: vehicle?.real_world_range_mi ? "medium" : "low",
    note: vehicle
      ? "Based on your routine and vehicle range estimate."
      : "Based on routine only. Adding vehicle details will improve accuracy.",
    has_vehicle_data: !!vehicle?.model,
    has_battery_data: false,
  };

  return {
    score_0_100: score,
    label,
    mental_load,
    stress_flags,
    what_breaks_first,
    confidence,
  };
}

// ============================================
// STRESS FLAGS
// ============================================

function buildStressFlags(
  mvr: MinimumViableRoutine,
  dailyMiles: number,
  range: number
): StressFlag[] {
  const flags: StressFlag[] = [];

  if (mvr.charging_access === "public") {
    flags.push({
      id: "public_charging_dependency",
      label: "Public charging dependency",
      severity: "high",
      routine_citation: "because you rely on public charging as your primary access",
    });
  } else if (mvr.charging_access === "work") {
    flags.push({
      id: "work_charging_dependency",
      label: "Workplace charging dependency",
      severity: "medium",
      routine_citation: "because your charging depends on workplace availability",
    });
  }

  if (mvr.climate === "winter") {
    const severity: StressFlag["severity"] =
      mvr.charging_access === "public" ? "high" : "medium";
    flags.push({
      id: "winter_range_loss",
      label: "Winter range reduction",
      severity,
      routine_citation:
        mvr.charging_access !== "home"
          ? "because winter reduces effective range by 20-40% and you don't have home charging to compensate"
          : "because winter reduces effective range by 20-40% in your climate",
    });
  }

  if (dailyMiles / range > 0.6) {
    flags.push({
      id: "tight_daily_buffer",
      label: "Tight daily range buffer",
      severity: "high",
      routine_citation: `because your ~${Math.round(dailyMiles)} daily miles uses ${Math.round((dailyMiles / range) * 100)}% of available range`,
    });
  }

  if (
    mvr.longest_day_pattern === "once_a_week" &&
    mvr.charging_access !== "home"
  ) {
    flags.push({
      id: "frequent_long_days_no_home",
      label: "Weekly long days without home charging",
      severity: "high",
      routine_citation:
        "because you have long driving days weekly without home charging to recover",
    });
  }

  if (mvr.climate === "hot" && dailyMiles / range > 0.5) {
    flags.push({
      id: "heat_range_compound",
      label: "Heat + high daily usage",
      severity: "medium",
      routine_citation: `because hot climate reduces range and your daily usage is already ${Math.round((dailyMiles / range) * 100)}% of capacity`,
    });
  }

  // Return max 3, sorted by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return flags
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 3);
}

// ============================================
// WHAT BREAKS FIRST
// ============================================

type Candidate = { item: string; citation: string; priority: number };

function buildWhatBreaksFirst(
  mvr: MinimumViableRoutine,
  dailyMiles: number,
  range: number
): WhatBreaksFirst {
  const candidates: Candidate[] = [];

  // Public charging predictability
  if (mvr.charging_access === "public") {
    candidates.push({
      item: "Charging predictability",
      citation:
        "because you rely on public charging and availability varies by time and location",
      priority: 100,
    });
  }

  // Winter + non-home charging
  if (mvr.climate === "winter" && mvr.charging_access !== "home") {
    candidates.push({
      item: "Winter charging friction",
      citation: `because winter reduces your effective buffer and ${mvr.charging_access === "public" ? "public charger reliability drops in cold weather" : "workplace charging may not fully compensate"}`,
      priority: 95,
    });
  } else if (mvr.climate === "winter") {
    candidates.push({
      item: "Winter range buffer",
      citation: "because winter reduces effective range by 20-40% in your climate",
      priority: 70,
    });
  }

  // Tight daily range
  if (dailyMiles / range > 0.5) {
    candidates.push({
      item: "Daily range margin",
      citation: `because your daily driving uses ${Math.round((dailyMiles / range) * 100)}% of range, leaving little buffer for detours`,
      priority: 85,
    });
  }

  // Weekly long days
  if (mvr.longest_day_pattern === "once_a_week") {
    candidates.push({
      item: "Long-day recovery window",
      citation: `because you have weekly long driving days${mvr.charging_access !== "home" ? " without home charging to recover quickly" : " that drain more battery than usual"}`,
      priority: mvr.charging_access !== "home" ? 90 : 60,
    });
  }

  // Monthly long trips
  if (mvr.longest_day_pattern === "monthly_trip") {
    candidates.push({
      item: "Monthly trip planning",
      citation: `because your monthly longer trips require charging planning${mvr.charging_access === "public" ? " on top of your regular public charging routine" : ""}`,
      priority: 55,
    });
  }

  // Work charging dependency
  if (mvr.charging_access === "work") {
    candidates.push({
      item: "Workplace charger availability",
      citation:
        "because your primary charging depends on your workplace, which could change",
      priority: 65,
    });
  }

  // Hot climate + high usage
  if (mvr.climate === "hot" && dailyMiles / range > 0.5) {
    candidates.push({
      item: "Heat-related range loss",
      citation: `because hot climate reduces effective range and your daily usage is already ${Math.round((dailyMiles / range) * 100)}% of capacity`,
      priority: 60,
    });
  }

  // Fallbacks
  if (candidates.length === 0) {
    candidates.push({
      item: "Charging routine consistency",
      citation:
        "because maintaining a consistent charging routine is the foundation of low-friction EV ownership",
      priority: 50,
    });
  }
  if (candidates.length === 1) {
    candidates.push({
      item: "Unexpected schedule disruptions",
      citation: `because any change to your ${mvr.charging_access === "home" ? "home charging routine" : "charging schedule"} could require adjustments`,
      priority: 40,
    });
  }

  // Sort by priority, take top 2
  candidates.sort((a, b) => b.priority - a.priority);

  return {
    primary: candidates[0].item,
    primary_citation: candidates[0].citation,
    secondary: candidates[1].item,
    secondary_citation: candidates[1].citation,
  };
}
