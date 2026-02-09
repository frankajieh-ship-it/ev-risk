/**
 * Deterministic Breakpoint Engine
 *
 * Rule library for "What breaks first" — each rule:
 *   1. applies() — does this rule fire for the given routine?
 *   2. severity() — 0-100 score for ranking
 *   3. build() — returns a full BreakPoint with evidence from inputs
 *
 * Pure function, no side effects, client-safe.
 */

import type { MinimumViableRoutine, BreakPoint } from "@/types/v2";

interface VehicleBasics {
  model?: string;
  year?: number;
  real_world_range_mi?: number;
}

export interface BreakpointContext {
  mvr: MinimumViableRoutine;
  effectiveDailyMiles: number;
  effectiveRange: number;
  vehicle?: VehicleBasics;
}

interface BreakpointRule {
  id: string;
  applies: (ctx: BreakpointContext) => boolean;
  severity: (ctx: BreakpointContext) => number;
  build: (ctx: BreakpointContext) => BreakPoint;
}

// ============================================
// REGION FALLBACK (Plan B)
// ============================================

function regionFallback(
  ctx: BreakpointContext,
  ruleId: string
): BreakPoint["fallback_plan_b"] {
  const { mvr } = ctx;
  const isWinter = mvr.climate === "winter";
  const isPublic = mvr.charging_access === "public";
  const isWork = mvr.charging_access === "work";

  const bufferRule = isWinter
    ? "Keep a larger charge buffer before your longest day during cold weeks"
    : "Keep a minimum charge buffer before your longest day";

  switch (ruleId) {
    case "public_charging_predictability":
      return {
        anchor: "Map 2 reliable Level 2 stations within 15 minutes of home",
        backup: "Keep a DC fast charge app with real-time availability as backup",
        buffer_rule: "Charge above 40% before heading home on busy evenings",
      };

    case "winter_charging_friction":
      return {
        anchor: isPublic
          ? "Map an indoor or sheltered charger for cold weather sessions"
          : "Arrive at work with enough buffer to skip one missed charge day",
        backup: isPublic
          ? "Identify a DC fast charger for days when Level 2 queues are long"
          : "Keep a public Level 2 backup within 10 minutes of work",
        buffer_rule: "In cold weeks, charge to 90% instead of 80% before your longest day",
      };

    case "winter_range_buffer":
      return {
        anchor: "Top up at home the night before your longest day during cold weeks",
        backup: "Know one public fast charger along your longest day route",
        buffer_rule: "In winter, assume 25% less range than displayed",
      };

    case "tight_daily_range":
      return {
        anchor: "Charge every night or every work day — never skip two sessions",
        backup: "Identify a mid-day top-up option for days you start below 50%",
        buffer_rule: `Keep above ${Math.round(ctx.effectiveDailyMiles * 1.3)} miles of range before leaving`,
      };

    case "weekly_long_days_no_home":
      return {
        anchor: isPublic
          ? "Pre-charge the day before your longest day at a reliable station"
          : "Arrive at work fully charged the day before your longest day",
        backup: "Map one fast charger along your longest day route",
        buffer_rule: bufferRule,
      };

    case "monthly_trip_planning":
      return {
        anchor: "Plan charging stops for your monthly trip the night before",
        backup: "Have a backup route with an alternative charging stop",
        buffer_rule: "Start trips above 80% and plan stops at 20%",
      };

    case "work_charger_dependency":
      return {
        anchor: "Treat work charging as your primary routine — charge every work day",
        backup: "Identify a public Level 2 within 10 minutes of home for weekends and days off",
        buffer_rule: "Keep above 30% on Fridays to cover the weekend without work charging",
      };

    case "heat_range_compound":
      return {
        anchor: "Charge during cooler hours when possible (morning or evening)",
        backup: "Know one shaded or indoor charging spot for extreme heat days",
        buffer_rule: "In heat waves, assume 15% less range than displayed",
      };

    default:
      return {
        anchor: isPublic
          ? "Anchor on one reliable nearby Level 2 that fits your weekly cadence"
          : "Maintain a consistent charging schedule you can sustain week to week",
        backup: isWork
          ? "Keep a public Level 2 backup for weekends and missed work charges"
          : "Have one backup charging option you can tolerate if your primary is busy",
        buffer_rule: bufferRule,
      };
  }
}

// ============================================
// EVIDENCE HELPERS
// ============================================

function milesLabel(ctx: BreakpointContext): { label: string; value: string } {
  if (ctx.mvr.commute_miles_roundtrip) {
    return { label: "Commute", value: `${ctx.mvr.commute_miles_roundtrip} mi roundtrip` };
  }
  return { label: "Weekly miles", value: `${ctx.mvr.weekly_miles ?? 100} mi/week` };
}

function usagePctLabel(ctx: BreakpointContext): { label: string; value: string } {
  const pct = Math.round((ctx.effectiveDailyMiles / ctx.effectiveRange) * 100);
  return { label: "Daily range usage", value: `${pct}% of available range` };
}

// ============================================
// RULES (10)
// ============================================

const RULES: BreakpointRule[] = [
  // 1. Public charging predictability
  {
    id: "public_charging_predictability",
    applies: ({ mvr }) => mvr.charging_access === "public",
    severity: ({ mvr }) =>
      mvr.longest_day_pattern === "once_a_week" ? 100 : 95,
    build: (ctx) => ({
      id: "public_charging_predictability",
      title: "Public charging availability breaks your routine",
      break_point: `Any evening when your usual charger is occupied — ${Math.round(ctx.effectiveDailyMiles)} mi/day on public charging leaves no buffer to skip a session`,
      trigger: `Your ${ctx.mvr.weekly_miles ? ctx.mvr.weekly_miles + ' mi/week' : Math.round(ctx.effectiveDailyMiles) + ' mi/day'} depends entirely on public station availability`,
      evidence: [
        { label: "Charging", value: "Public only" },
        milesLabel(ctx),
        { label: "Longest day", value: formatLongestDay(ctx.mvr.longest_day_pattern) },
      ],
      impact: "High",
      fallback_plan_b: regionFallback(ctx, "public_charging_predictability"),
    }),
  },

  // 2. Winter + non-home charging friction
  {
    id: "winter_charging_friction",
    applies: ({ mvr }) => mvr.climate === "winter" && mvr.charging_access !== "home",
    severity: ({ mvr }) =>
      mvr.charging_access === "public" ? 95 : 85,
    build: (ctx) => ({
      id: "winter_charging_friction",
      title: "Winter charging friction spikes without home charging",
      break_point: `Cold weeknights when you need a top-up — ${ctx.mvr.charging_access} charging in winter is slower and less reliable`,
      trigger: `Winter + ${ctx.mvr.charging_access} charging — cold cuts ~25% from your ${ctx.effectiveRange} mi range, leaving ~${Math.round(ctx.effectiveRange * 0.75)} mi effective`,
      evidence: [
        { label: "Climate", value: "Winter" },
        { label: "Charging", value: ctx.mvr.charging_access === "public" ? "Public only" : "Workplace" },
        milesLabel(ctx),
      ],
      impact: "High",
      fallback_plan_b: regionFallback(ctx, "winter_charging_friction"),
    }),
  },

  // 3. Winter range buffer (home charging)
  {
    id: "winter_range_buffer",
    applies: ({ mvr }) => mvr.climate === "winter" && mvr.charging_access === "home",
    severity: () => 65,
    build: (ctx) => ({
      id: "winter_range_buffer",
      title: "Winter range drops catch you short on longer days",
      break_point: `Your longest driving day in a cold snap — at ~${Math.round(ctx.effectiveRange * 0.75)} mi effective winter range vs. your ${Math.round(ctx.effectiveDailyMiles)} mi daily need`,
      trigger: `Winter cuts your ${ctx.effectiveRange} mi range by 20-40%, pushing daily usage to ~${Math.round((ctx.effectiveDailyMiles / (ctx.effectiveRange * 0.75)) * 100)}% of effective range`,
      evidence: [
        { label: "Climate", value: "Winter" },
        { label: "Charging", value: "Home" },
        { label: "Longest day", value: formatLongestDay(ctx.mvr.longest_day_pattern) },
      ],
      impact: "Medium",
      fallback_plan_b: regionFallback(ctx, "winter_range_buffer"),
    }),
  },

  // 4. Tight daily range
  {
    id: "tight_daily_range",
    applies: ({ effectiveDailyMiles, effectiveRange }) =>
      effectiveDailyMiles / effectiveRange > 0.5,
    severity: ({ effectiveDailyMiles, effectiveRange }) => {
      const ratio = effectiveDailyMiles / effectiveRange;
      if (ratio > 0.7) return 85;
      if (ratio > 0.6) return 80;
      return 75;
    },
    build: (ctx) => ({
      id: "tight_daily_range",
      title: "Daily driving leaves little buffer for detours",
      break_point: "Any day with an unplanned stop or detour",
      trigger: `Your daily driving uses ${Math.round((ctx.effectiveDailyMiles / ctx.effectiveRange) * 100)}% of available range`,
      evidence: [
        milesLabel(ctx),
        usagePctLabel(ctx),
        { label: "Est. range", value: `${ctx.effectiveRange} mi` },
      ],
      impact: ctx.effectiveDailyMiles / ctx.effectiveRange > 0.6 ? "High" : "Medium",
      fallback_plan_b: regionFallback(ctx, "tight_daily_range"),
    }),
  },

  // 5. Weekly long days without home charging
  {
    id: "weekly_long_days_no_home",
    applies: ({ mvr }) =>
      mvr.longest_day_pattern === "once_a_week" && mvr.charging_access !== "home",
    severity: ({ mvr }) =>
      mvr.charging_access === "public" ? 90 : 80,
    build: (ctx) => ({
      id: "weekly_long_days_no_home",
      title: "Weekly long days drain you without home recovery",
      break_point: `The day before your weekly long day — with ${ctx.mvr.charging_access} charging only, one missed session leaves you short on ${Math.round(ctx.effectiveDailyMiles)} mi`,
      trigger: `Weekly long days + ${ctx.mvr.charging_access} charging — your ${ctx.mvr.weekly_miles ? ctx.mvr.weekly_miles + ' mi/week' : Math.round(ctx.effectiveDailyMiles * 5) + ' mi/week'} needs consistent sessions`,
      evidence: [
        { label: "Longest day", value: "Weekly" },
        { label: "Charging", value: ctx.mvr.charging_access === "public" ? "Public only" : "Workplace" },
        milesLabel(ctx),
      ],
      impact: "High",
      fallback_plan_b: regionFallback(ctx, "weekly_long_days_no_home"),
    }),
  },

  // 6. Monthly trip planning
  {
    id: "monthly_trip_planning",
    applies: ({ mvr }) => mvr.longest_day_pattern === "monthly_trip",
    severity: ({ mvr }) =>
      mvr.charging_access === "public" ? 55 : 45,
    build: (ctx) => ({
      id: "monthly_trip_planning",
      title: "Monthly longer trips require charging planning",
      break_point: `Your monthly trip day without planned stops — at ${ctx.effectiveRange} mi range, trips over ${Math.round(ctx.effectiveRange * 0.7)} mi need at least one charging stop`,
      trigger: `Monthly trips from a ${ctx.effectiveRange} mi range vehicle + ${ctx.mvr.charging_access} charging — each trip needs a charging plan`,
      evidence: [
        { label: "Longest day", value: "Monthly trip" },
        { label: "Charging", value: formatCharging(ctx.mvr.charging_access) },
        milesLabel(ctx),
      ],
      impact: "Medium",
      fallback_plan_b: regionFallback(ctx, "monthly_trip_planning"),
    }),
  },

  // 7. Workplace charger dependency
  {
    id: "work_charger_dependency",
    applies: ({ mvr }) => mvr.charging_access === "work",
    severity: ({ mvr }) =>
      mvr.longest_day_pattern === "once_a_week" ? 65 : 55,
    build: (ctx) => ({
      id: "work_charger_dependency",
      title: "Workplace charging could change without notice",
      break_point: `Any week you lose work charging — your ${Math.round(ctx.effectiveDailyMiles)} mi/day habit has no home backup`,
      trigger: `Your ${ctx.mvr.weekly_miles ? ctx.mvr.weekly_miles + ' mi/week' : Math.round(ctx.effectiveDailyMiles * 5) + ' mi/week'} depends on workplace charging you don't control`,
      evidence: [
        { label: "Charging", value: "Workplace" },
        { label: "Longest day", value: formatLongestDay(ctx.mvr.longest_day_pattern) },
        milesLabel(ctx),
      ],
      impact: "Medium",
      fallback_plan_b: regionFallback(ctx, "work_charger_dependency"),
    }),
  },

  // 8. Heat + high usage compound
  {
    id: "heat_range_compound",
    applies: ({ mvr, effectiveDailyMiles, effectiveRange }) =>
      mvr.climate === "hot" && effectiveDailyMiles / effectiveRange > 0.5,
    severity: ({ effectiveDailyMiles, effectiveRange }) => {
      const ratio = effectiveDailyMiles / effectiveRange;
      return ratio > 0.6 ? 60 : 50;
    },
    build: (ctx) => ({
      id: "heat_range_compound",
      title: "Heat reduces range on your highest-usage days",
      break_point: "Hot days when AC is running and your commute is at its longest",
      trigger: `Hot climate + ${Math.round((ctx.effectiveDailyMiles / ctx.effectiveRange) * 100)}% daily range usage — AC compounds the drain`,
      evidence: [
        { label: "Climate", value: "Hot" },
        usagePctLabel(ctx),
        milesLabel(ctx),
      ],
      impact: "Medium",
      fallback_plan_b: regionFallback(ctx, "heat_range_compound"),
    }),
  },

  // 9. Schedule disruption fragility (non-home)
  {
    id: "schedule_disruption_fragility",
    applies: ({ mvr }) => mvr.charging_access !== "home",
    severity: ({ mvr }) =>
      mvr.charging_access === "public" ? 40 : 30,
    build: (ctx) => ({
      id: "schedule_disruption_fragility",
      title: "Schedule changes disrupt your charging rhythm",
      break_point: `Any week with schedule changes — without home charging, your ${Math.round(ctx.effectiveDailyMiles)} mi/day routine has little flexibility`,
      trigger: `${formatCharging(ctx.mvr.charging_access)} access for ${ctx.mvr.weekly_miles ? ctx.mvr.weekly_miles + ' mi/week' : Math.round(ctx.effectiveDailyMiles * 5) + ' mi/week'} leaves less room for disruptions`,
      evidence: [
        { label: "Charging", value: formatCharging(ctx.mvr.charging_access) },
        milesLabel(ctx),
      ],
      impact: "Low",
      fallback_plan_b: regionFallback(ctx, "schedule_disruption_fragility"),
    }),
  },

  // 10. Charging routine consistency (universal fallback)
  {
    id: "charging_routine_consistency",
    applies: () => true,
    severity: () => 20,
    build: (ctx) => ({
      id: "charging_routine_consistency",
      title: "Maintaining a consistent charging routine",
      break_point: `Any week your ${ctx.mvr.charging_access} charging rhythm breaks — at ${Math.round((ctx.effectiveDailyMiles / ctx.effectiveRange) * 100)}% daily range usage, skipping sessions adds up`,
      trigger: `${formatCharging(ctx.mvr.charging_access)} charging for ${ctx.mvr.weekly_miles ? ctx.mvr.weekly_miles + ' mi/week' : Math.round(ctx.effectiveDailyMiles * 5) + ' mi/week'} — consistency is the foundation of low-friction EV ownership`,
      evidence: [
        { label: "Charging", value: formatCharging(ctx.mvr.charging_access) },
        milesLabel(ctx),
      ],
      impact: "Low",
      fallback_plan_b: regionFallback(ctx, "charging_routine_consistency"),
    }),
  },
];

// ============================================
// FORMAT HELPERS
// ============================================

function formatLongestDay(pattern: MinimumViableRoutine["longest_day_pattern"]): string {
  switch (pattern) {
    case "once_a_week": return "Weekly";
    case "monthly_trip": return "Monthly trip";
    case "rare_road_trip": return "Rare road trip";
  }
}

function formatCharging(access: MinimumViableRoutine["charging_access"]): string {
  switch (access) {
    case "home": return "Home";
    case "work": return "Workplace";
    case "public": return "Public only";
  }
}

// ============================================
// PUBLIC API
// ============================================

export function buildRankedBreakpoints(ctx: BreakpointContext): BreakPoint[] {
  const candidates = RULES
    .filter((rule) => rule.applies(ctx))
    .map((rule) => ({ bp: rule.build(ctx), score: rule.severity(ctx) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.bp);

  // Always at least 1 breakpoint
  if (candidates.length === 0) {
    const fallback = RULES.find((r) => r.id === "charging_routine_consistency")!;
    candidates.push(fallback.build(ctx));
  }

  return candidates;
}
