/**
 * EV Routine Sanity-Check - Sentence Catalog
 *
 * Product owns copy, Engineering owns logic.
 * All sentence text is locked and must not be modified without Product approval.
 */

import type {
  ClimateSeasonality,
  WinterLongDays,
  ParkedOutside,
  ChargingAnchorType,
  BackupOption,
  PublicAnchorReliability,
} from "@/types";

export interface SanityCheckAnswers {
  chargingAccess: "home" | "apartment_shared" | "work_shared" | "public_mixed";
  schedule: "predictable" | "variable" | "unpredictable";
  backup: "easy" | "occasional" | "none";
  dependency: "full_control" | "shared" | "public";

  // Tolerance fields (added for execution-time and downtime friction analysis)
  executionUncertaintyTolerance: "low" | "medium" | "high";
  downtimeRecoveryTolerance: "low" | "medium" | "high";

  // P0/P1: Seasonal inputs
  climateSeasonality?: ClimateSeasonality;
  winterLongDays?: WinterLongDays;
  parkedOutside?: ParkedOutside;

  // P0/P1: Predictability inputs
  chargingAnchorType?: ChargingAnchorType;
  backupOption?: BackupOption;
  publicAnchorReliability?: PublicAnchorReliability;

  // PHEV integration (2026 hybrid pivot)
  drivetrainOpenness?: "BEV_ONLY" | "PHEV_OK" | "PHEV_PREFERRED";
  housingType?: "house_garage" | "house_driveway" | "apartment_assigned" | "apartment_street";
  towingNeeds?: "yes" | "occasionally" | "no";
  chargingPlanB?: "another_home_charger" | "nearby_public" | "work_charger" | "no_plan";
  pluginFrequency?: "every_night" | "few_times_week" | "once_week" | "rarely";
}

export interface FrictionSentence {
  id: string;
  text: string | { US: string; UK?: string };  // UK optional, falls back to US
  triggers: Partial<SanityCheckAnswers>[];
}

/**
 * Helper to get the correct regional text from a FrictionSentence
 */
export function getSentenceText(sentence: FrictionSentence, region: "US" | "UK" = "US"): string {
  if (typeof sentence.text === "string") {
    return sentence.text;
  }
  return sentence.text[region] ?? sentence.text.US;
}

/**
 * Friction Sentences (17 total: 10 original + 7 new tolerance-based)
 * Each sentence has specific trigger conditions based on user answers.
 */
export const FRICTION_SENTENCES: FrictionSentence[] = [
  // Original 10 sentences
  {
    id: "shared_competition",
    text: "Primary reliance on shared charging often introduces delays, queueing, or competition that isn't visible until you're living with it.",
    triggers: [
      { chargingAccess: "apartment_shared" },
      { chargingAccess: "work_shared" },
      { dependency: "shared" }
    ]
  },
  {
    id: "public_variability",
    text: {
      US: "When charging depends on the public network, reliability and availability can vary day to day, which makes routines harder to lock in.",
      UK: "When charging depends on the public network, reliability at motorway services and rural areas can vary, which makes routines harder to lock in."
    },
    triggers: [
      { chargingAccess: "public_mixed" },
      { dependency: "public" }
    ]
  },
  {
    id: "schedule_rigidity",
    text: "Unpredictable schedules tend to amplify charging friction, because planning becomes a requirement rather than a convenience.",
    triggers: [
      { schedule: "unpredictable" }
    ]
  },
  {
    id: "variable_schedule_overhead",
    text: "Even moderate schedule changes can make charging feel restrictive when timing starts to matter more than distance.",
    triggers: [
      { schedule: "variable", dependency: "shared" },
      { schedule: "variable", dependency: "public" }
    ]
  },
  {
    id: "no_backup_amplification",
    text: "Limited backup options tend to amplify stress when something goes wrong—weather, charger downtime, or a last-minute plan change.",
    triggers: [
      { backup: "none" }
    ]
  },
  {
    id: "occasional_backup_fragility",
    text: "Occasional access to a backup vehicle helps, but still leaves gaps during peak demand or unexpected disruptions.",
    triggers: [
      { backup: "occasional", dependency: "shared" },
      { backup: "occasional", dependency: "public" }
    ]
  },
  {
    id: "full_control_stability",
    text: "Having direct control over charging usually reduces day-to-day friction, even when schedules change.",
    triggers: [
      { dependency: "full_control", chargingAccess: "home" }
    ]
  },
  {
    id: "apartment_no_backup_compound",
    text: "Shared charging combined with no easy fallback is where frustration tends to surface fastest.",
    triggers: [
      { chargingAccess: "apartment_shared", backup: "none" }
    ]
  },
  {
    id: "work_charging_dependency",
    text: "Workplace charging can work well—until access changes, policies shift, or demand increases.",
    triggers: [
      { chargingAccess: "work_shared" }
    ]
  },
  {
    id: "public_unpredictable_peak",
    text: {
      US: "Public charging combined with unpredictable hours is where EV routines break most often, not because of range, but because of timing.",
      UK: "Relying on motorway services or public chargers with unpredictable hours is where EV routines break most often, not because of range, but because of timing."
    },
    triggers: [
      { dependency: "public", schedule: "unpredictable" }
    ]
  },

  // New 7 tolerance-based sentences
  {
    id: "execution_uncertainty_low",
    text: "If things don't start cleanly (apps, sessions, billing), even small delays can add stress — especially when you're tired, late, or it's cold.",
    triggers: [
      { executionUncertaintyTolerance: "low" }
    ]
  },
  {
    id: "execution_uncertainty_high",
    text: "If you're comfortable with occasional hiccups, execution-time friction (apps, sessions, retries) tends to feel less heavy.",
    triggers: [
      { executionUncertaintyTolerance: "high" }
    ]
  },
  {
    id: "execution_shared_public",
    text: "Relying on shared or public charging can amplify stress.",
    triggers: [
      { executionUncertaintyTolerance: "low", dependency: "shared" },
      { executionUncertaintyTolerance: "low", dependency: "public" },
      { executionUncertaintyTolerance: "low", chargingAccess: "apartment_shared" },
      { executionUncertaintyTolerance: "low", chargingAccess: "work_shared" },
      { executionUncertaintyTolerance: "low", chargingAccess: "public_mixed" }
    ]
  },
  {
    id: "downtime_recovery_low",
    text: "If unexpected downtime would be disruptive, the hardest part is often uncertainty (how long, how to fix, how to get back to normal), not the failure itself.",
    triggers: [
      { downtimeRecoveryTolerance: "low" }
    ]
  },
  {
    id: "downtime_no_backup",
    text: "Limited backup options can turn minor issues into major disruptions. When downtime tolerance is low, this tends to feel heavier in the first months.",
    triggers: [
      { downtimeRecoveryTolerance: "low", backup: "none" }
    ]
  },
  {
    id: "downtime_unpredictable",
    text: "Unpredictable schedules + low tolerance for downtime can make disruptions feel costly because they remove your ability to 'plan around it.'",
    triggers: [
      { downtimeRecoveryTolerance: "low", schedule: "unpredictable" }
    ]
  },
  {
    id: "why_not_100",
    text: "Why not 100%: this depends on how often you hit 'execution-time' moments (apps/session starts) and how disruptive downtime would be when life gets busy.",
    triggers: []
  },

  // P0/P1: Seasonal friction sentences
  {
    id: "winter_buffer_compression",
    text: {
      US: "This setup is stable most of the year, but winter months are where planning tends to resurface.",
      UK: "This setup is stable most of the year, but winter months — especially on motorway trips — are where planning tends to resurface."
    },
    triggers: [
      { climateSeasonality: "COLD_WINTER", dependency: "public" },
      { climateSeasonality: "COLD_WINTER", dependency: "shared" }
    ]
  },
  {
    id: "cold_recovery_risk",
    text: "Cold weather reduces range buffer, making recovery from missed charges harder. Low planning tolerance amplifies this.",
    triggers: [
      { climateSeasonality: "COLD_WINTER", backup: "none" }
    ]
  },
  {
    id: "winter_long_days_weekly",
    text: "Weekly long driving days in winter can compress your buffer more often than expected, even with home charging.",
    triggers: [
      { winterLongDays: "WEEKLY", climateSeasonality: "COLD_WINTER" }
    ]
  },

  // P0/P1: Predictability friction sentences
  {
    id: "low_predictability_public_routine",
    text: "Your setup is limited mainly by predictability (reliable anchors + backups), not charger count.",
    triggers: [
      { chargingAnchorType: "PUBLIC_ANCHOR" },
      { chargingAnchorType: "NONE" }
    ]
  },
  {
    id: "no_backup_anchor",
    text: "Without a reliable backup option, minor disruptions at your primary anchor can cascade into larger planning headaches.",
    triggers: [
      { backupOption: "NONE", chargingAnchorType: "WORK" },
      { backupOption: "NONE", chargingAnchorType: "DESTINATION" },
      { backupOption: "NONE", chargingAnchorType: "PUBLIC_ANCHOR" }
    ]
  },

  // P0/P1: Planning tolerance as first-class driver
  {
    id: "planning_tolerance_friction",
    text: "This setup works, but it asks you to plan a bit more often than many people enjoy.",
    triggers: [
      { executionUncertaintyTolerance: "low", dependency: "public" },
      { executionUncertaintyTolerance: "low", dependency: "shared" },
      { downtimeRecoveryTolerance: "low", dependency: "public" }
    ]
  }
];

/**
 * Closing Line (Always Shown)
 * Displayed after friction sentences in the output screen.
 */
export const CLOSING_LINE = "These frictions most often surface during routine setup or after a disruption—such as a move, schedule change, charger outage, or seasonal shift—rather than on day one.";

export const CLOSING_LINE_BY_REGION = {
  US: "These frictions usually show up in the first 3–6 months — especially after a move, schedule change, or seasonal shift.",
  UK: "These frictions usually show up in the first 1–3 months — especially through winter, motorway service stops, or unplanned detours."
};

export function getClosingLine(region: "US" | "UK" = "US"): string {
  return CLOSING_LINE_BY_REGION[region];
}

/**
 * Optional "Why Not 100%" Text
 * Shown if confidence is displayed (future enhancement).
 */
export const WHY_NOT_100 = "Public charging reliability, shared access, and life disruptions can't be predicted with certainty, even when everything looks workable on paper.";
