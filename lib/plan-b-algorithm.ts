/**
 * Plan B Algorithm
 *
 * Given the top breakpoint + nearby/saved chargers, generate:
 * - Best backup charger recommendation
 * - Time penalty estimate (bands, not fake precision)
 * - Mitigation steps
 * - Stress assessment
 *
 * Rules-first, transparent, explainable.
 */

import type { BreakPoint } from "@/types/v2";
import type {
  ChargerSearchResult,
  SavedCharger,
  PlanBCard,
} from "@/types/routine-v2";

interface PlanBInputs {
  topBreakpoint: BreakPoint;
  nearbyChargers: ChargerSearchResult[];
  savedChargers: SavedCharger[];
  vehicleConnectorTypes?: string[];
  routineType: "home" | "work" | "public";
}

type PlanBOutput = Omit<PlanBCard, "id" | "run_id" | "created_at">;

// ============================================
// MAIN ENTRY
// ============================================

export function generatePlanB(inputs: PlanBInputs): PlanBOutput {
  const {
    topBreakpoint,
    nearbyChargers,
    savedChargers,
    vehicleConnectorTypes = ["CCS"],
    routineType,
  } = inputs;

  // Rank all chargers
  const ranked = rankChargers(
    nearbyChargers,
    savedChargers,
    vehicleConnectorTypes,
    routineType
  );

  if (ranked.length === 0) {
    return generateFallbackPlanB(topBreakpoint, routineType);
  }

  const anchor = ranked[0];
  const backup = ranked.length > 1 ? ranked[1] : ranked[0];

  const mitigationSteps = buildMitigationSteps(
    topBreakpoint.id,
    anchor.charger,
    backup.charger,
    routineType
  );

  const timePenalty = estimateTimePenalty(anchor.charger, routineType);
  const stressLabel = assessStressLevel(anchor.charger, backup.charger, routineType);

  const planSummary = buildPlanSummary(
    topBreakpoint,
    anchor.charger,
    backup.charger,
    routineType
  );

  return {
    charger_id: undefined, // Set by caller if charger is in saved_chargers
    plan_summary: planSummary,
    anchor_charger_name: anchor.charger.name,
    backup_charger_name: backup.charger.name !== anchor.charger.name ? backup.charger.name : undefined,
    time_penalty_minutes: timePenalty,
    stress_label: stressLabel,
    mitigation_steps: mitigationSteps,
    buffer_rule: topBreakpoint.fallback_plan_b.buffer_rule,
    rank_score: anchor.score,
  };
}

// ============================================
// CHARGER RANKING
// ============================================

interface RankedCharger {
  charger: ChargerSearchResult;
  score: number;
}

function rankChargers(
  nearby: ChargerSearchResult[],
  saved: SavedCharger[],
  connectorTypes: string[],
  routineType: "home" | "work" | "public"
): RankedCharger[] {
  // Deduplicate by external_id
  const seen = new Set<string>();
  const all: ChargerSearchResult[] = [];

  for (const charger of [...saved, ...nearby]) {
    const key = charger.external_id || charger.id;
    if (!seen.has(key)) {
      seen.add(key);
      all.push(charger);
    }
  }

  const savedIds = new Set(saved.map((s) => s.external_id || s.id));

  return all
    .map((charger) => ({
      charger,
      score: scoreCharger(charger, connectorTypes, routineType, savedIds),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function scoreCharger(
  charger: ChargerSearchResult,
  connectorTypes: string[],
  routineType: "home" | "work" | "public",
  savedIds: Set<string>
): number {
  let score = 50;

  // Connector compatibility (+20 / -30)
  const compatible = charger.connector_types.some((ct) =>
    connectorTypes.includes(ct)
  );
  score += compatible ? 20 : -30;

  // Distance (closer = better)
  if (charger.distance_mi !== undefined) {
    if (charger.distance_mi < 5) score += 15;
    else if (charger.distance_mi < 10) score += 10;
    else if (charger.distance_mi < 15) score += 5;
    else score -= 10;
  }

  // Charging speed
  if (charger.level_type === "DCFC") score += 15;
  else if (charger.max_power_kw && charger.max_power_kw > 7) score += 5;

  // User has saved/favorited this charger
  const key = charger.external_id || charger.id;
  if (savedIds.has(key)) score += 20;

  // Reliability (if saved charger)
  if ("reliability_rating" in charger) {
    const saved = charger as SavedCharger;
    if (saved.reliability_rating === "high") score += 10;
    else if (saved.reliability_rating === "low") score -= 10;
  }

  // 24/7 access preferred for backup
  if (charger.hours_24) score += 5;

  // Public access
  if (charger.access_type === "public") score += 5;

  // Routine-specific bonus
  if (routineType === "public" && charger.distance_mi && charger.distance_mi < 5 && charger.level_type === "L2") {
    score += 10; // Nearby L2 anchors are gold for public-charging routines
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================
// MITIGATION STEPS
// ============================================

function buildMitigationSteps(
  breakpointId: string,
  anchor: ChargerSearchResult,
  backup: ChargerSearchResult,
  routineType: "home" | "work" | "public"
): string[] {
  const steps: string[] = [];
  const anchorDist = anchor.distance_mi?.toFixed(1) || "nearby";

  // Primary step: map the anchor
  steps.push(
    `Map ${anchor.name} (${anchorDist} mi) as your primary backup charger`
  );

  // Breakpoint-specific steps
  switch (breakpointId) {
    case "public_charging_predictability":
      steps.push(
        `Check availability via ${anchor.network || "charger app"} before driving`
      );
      if (backup.name !== anchor.name) {
        steps.push(
          `Have ${backup.name} as your secondary backup for busy evenings`
        );
      }
      break;

    case "winter_charging_friction":
      steps.push(
        "Charge during daylight hours when possible in cold weather"
      );
      steps.push(
        "Keep charge above 50% before cold overnight temperatures"
      );
      break;

    case "winter_range_buffer":
      steps.push("Top up the night before your longest day during cold weeks");
      if (backup.level_type === "DCFC") {
        steps.push(
          `Know ${backup.name} (DC fast) along your longest day route`
        );
      }
      break;

    case "tight_daily_range":
      steps.push("Never start the day below 50% charge");
      if (backup.name !== anchor.name) {
        steps.push(
          `Use ${backup.name} for mid-day top-ups if you start low`
        );
      }
      break;

    case "weekly_long_days_no_home":
      steps.push(
        routineType === "public"
          ? "Pre-charge the day before your longest day at a reliable station"
          : "Arrive at work fully charged the day before your longest day"
      );
      break;

    case "work_charger_dependency":
      steps.push(
        `Use ${anchor.name} for weekend/evening top-ups when work charging is unavailable`
      );
      steps.push("Keep above 30% on Fridays to cover the weekend");
      break;

    case "monthly_trip_planning":
      steps.push("Plan charging stops for your monthly trip the night before");
      steps.push("Start trips above 80% and plan stops at 20%");
      break;

    default:
      // Generic step for any breakpoint
      if (routineType !== "home") {
        steps.push("Test your backup charger on a low-stakes day first");
      }
      break;
  }

  // Add DCFC backup note if anchor is L2
  if (
    anchor.level_type === "L2" &&
    backup.level_type === "DCFC" &&
    backup.name !== anchor.name
  ) {
    steps.push(
      `Use ${backup.name} (DC fast) for emergency top-ups when time is tight`
    );
  }

  return steps;
}

// ============================================
// TIME PENALTY ESTIMATE
// ============================================

function estimateTimePenalty(
  anchor: ChargerSearchResult,
  routineType: "home" | "work" | "public"
): number {
  // Band-based, not fake precision
  // Returns weekly estimate in minutes

  if (routineType === "home") {
    // Home chargers rarely need backup — minimal penalty
    return 15;
  }

  const distanceMi = anchor.distance_mi || 5;

  if (routineType === "work") {
    // Need backup 1-2x per week (weekends, days off)
    const drivingMin = distanceMi * 2 * 2; // Round trip, 2 min/mi, ~2 sessions
    const chargingMin = anchor.level_type === "DCFC" ? 20 : 45;
    return Math.round(drivingMin + chargingMin);
  }

  // Public: need backup 2-3x per week
  const sessionsPerWeek = 3;
  const drivingMin = distanceMi * 2 * 2 * sessionsPerWeek;
  const chargingMin =
    (anchor.level_type === "DCFC" ? 20 : 35) * sessionsPerWeek;
  return Math.round(drivingMin + chargingMin);
}

// ============================================
// STRESS ASSESSMENT
// ============================================

function assessStressLevel(
  anchor: ChargerSearchResult,
  backup: ChargerSearchResult,
  routineType: "home" | "work" | "public"
): "minimal" | "moderate" | "high" {
  if (routineType === "home") return "minimal";

  const anchorDist = anchor.distance_mi || 5;
  const hasGoodBackup =
    backup.level_type === "DCFC" ||
    (backup.distance_mi !== undefined && backup.distance_mi < 10);

  if (routineType === "work") {
    return anchorDist < 5 ? "minimal" : "moderate";
  }

  // Public charging
  if (anchorDist < 3 && hasGoodBackup) return "minimal";
  if (anchorDist < 8 && hasGoodBackup) return "moderate";
  return "high";
}

// ============================================
// PLAN SUMMARY
// ============================================

function buildPlanSummary(
  breakpoint: BreakPoint,
  anchor: ChargerSearchResult,
  backup: ChargerSearchResult,
  routineType: "home" | "work" | "public"
): string {
  const anchorDist = anchor.distance_mi?.toFixed(1) || "nearby";

  if (routineType === "public") {
    if (backup.name !== anchor.name) {
      return `When ${anchor.name} is busy, use ${backup.name} (${backup.distance_mi?.toFixed(1) || "nearby"} mi) as your backup. Keep charge above 40% before evenings.`;
    }
    return `Use ${anchor.name} (${anchorDist} mi) as your anchor station. Keep charge above 40% before evenings.`;
  }

  if (routineType === "work") {
    return `If work charging is unavailable, use ${anchor.name} (${anchorDist} mi) for weekend and evening top-ups.`;
  }

  return `For days you can't charge at home, ${anchor.name} (${anchorDist} mi) is your nearest reliable backup.`;
}

// ============================================
// FALLBACK (no chargers found)
// ============================================

function generateFallbackPlanB(
  breakpoint: BreakPoint,
  routineType: "home" | "work" | "public"
): PlanBOutput {
  return {
    plan_summary:
      "Map nearby chargers to build your Plan B. Start by finding 1-2 reliable stations within 10 miles of home.",
    mitigation_steps: [
      "Search for public chargers using PlugShare or ChargePoint apps",
      "Test your nearest Level 2 charger on a low-stakes day",
      "Identify one DC fast charger for emergencies",
    ],
    buffer_rule: breakpoint.fallback_plan_b.buffer_rule,
    time_penalty_minutes: routineType === "public" ? 120 : 60,
    stress_label: "high",
    rank_score: 30,
  };
}
