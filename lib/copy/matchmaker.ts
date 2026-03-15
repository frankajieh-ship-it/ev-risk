/**
 * Matchmaker Copy - Configurable Strings for EV Matchmaker Experience
 *
 * Centralizes all buyer-facing copy so marketing can iterate without touching components.
 * Each section has clear ownership and purpose.
 */

export const MATCHMAKER_COPY = {
  /**
   * Landing Page - First impression, value proposition
   */
  landing: {
    h1: "Find your perfect EV—fast.",
    subtext: "Personalized to your routine, charging access, and budget.",
  },

  /**
   * "Why These Cars Fit You" Block - Input recap to reinforce personalization
   */
  whyTheseCars: {
    title: "Based on your routine",
    subtitle: "Here's what we factored in:",
  },

  /**
   * "How We Decided" Explainability - Build trust through transparency
   */
  howWeDecided: {
    title: "How we scored this",
    subtitle: "The things that shaped your result:",
    assumptionsLabel: "What we assumed about your situation:",
    unknownsLabel: "What we couldn't factor in:",
  },

  /**
   * Per-Vehicle Fit Reasoning - Explain why each vehicle matches (or doesn't)
   */
  perVehicle: {
    fitVerdict: {
      smoothFit: "Smooth sailing",
      conditionalFit: "Works with planning",
      highFriction: "Needs workarounds",
    },
    whatBreaksFirst: "What breaks first:",
    planB: "Backup plan:",
    verifyOnListing: "Verify on the listing:",
  },

  /**
   * Stage Titles - 2-stage form flow guidance
   */
  stageTitles: {
    stage1: "Quick Check (3 questions)",
    stage2: "Refine Your Match (optional)",
  },

  /**
   * Chip Labels - User input display formatting
   */
  chipLabels: {
    chargingAccess: {
      home: "Home charging",
      work: "Work charging",
      public: "Public charging only",
    },
    climate: {
      mild: "Mild climate",
      hot: "Hot summers",
      cold: "Cold winters",
    },
    longestDay: {
      short: "Short days (under 50 mi)",
      medium: "Medium days (50-100 mi)",
      long: "Long days (over 100 mi)",
    },
  },
} as const;

/**
 * Type-safe access to copy strings
 */
export type MatchmakerCopyKey = keyof typeof MATCHMAKER_COPY;
