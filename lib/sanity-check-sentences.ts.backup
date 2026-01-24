/**
 * EV Routine Sanity-Check - Sentence Catalog
 *
 * Product owns copy, Engineering owns logic.
 * All sentence text is locked and must not be modified without Product approval.
 */

export interface SanityCheckAnswers {
  chargingAccess: "home" | "apartment_shared" | "work_shared" | "public_mixed";
  schedule: "predictable" | "variable" | "unpredictable";
  backup: "easy" | "occasional" | "none";
  dependency: "full_control" | "shared" | "public";
}

export interface FrictionSentence {
  id: string;
  text: string;
  triggers: Partial<SanityCheckAnswers>[];
}

/**
 * Friction Sentences (10 total)
 * Each sentence has specific trigger conditions based on user answers.
 */
export const FRICTION_SENTENCES: FrictionSentence[] = [
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
    text: "When charging depends on the public network, reliability and availability can vary day to day, which makes routines harder to lock in.",
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
    text: "Public charging combined with unpredictable hours is where EV routines break most often, not because of range, but because of timing.",
    triggers: [
      { dependency: "public", schedule: "unpredictable" }
    ]
  }
];

/**
 * Closing Line (Always Shown)
 * Displayed after friction sentences in the output screen.
 */
export const CLOSING_LINE = "These frictions most often surface during routine setup or after a disruption—such as a move, schedule change, charger outage, or seasonal shift—rather than on day one.";

/**
 * Optional "Why Not 100%" Text
 * Shown if confidence is displayed (future enhancement).
 */
export const WHY_NOT_100 = "Public charging reliability, shared access, and life disruptions can't be predicted with certainty, even when everything looks workable on paper.";
