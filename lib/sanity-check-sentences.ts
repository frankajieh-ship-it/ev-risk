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

  // Tolerance fields (added for execution-time and downtime friction analysis)
  executionUncertaintyTolerance: "low" | "medium" | "high";
  downtimeRecoveryTolerance: "low" | "medium" | "high";
}

export interface FrictionSentence {
  id: string;
  text: string;
  triggers: Partial<SanityCheckAnswers>[];
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
    text: "Relying on shared/public charging can create 'standing at the charger' uncertainty (apps, tariffs, session starts). Low tolerance for that uncertainty tends to amplify stress.",
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
