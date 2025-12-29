import type { Block, RenderCtx } from "@/core/content";
import {
  createConfidenceFrame
} from "@/core/confidence/primitives";
import { personalizationValueProp } from "@/core/templates";

/**
 * Charging Fit Block (Mental Overhead v1)
 *
 * Tier 4 - Decision support block for re-validation and charging routine friction.
 * Focuses on "Does my EV still fit my life?" question.
 *
 * Behavior:
 * - Missing policy: "degrade" (shows even without full inputs, but with lower confidence)
 * - DC Fast Primary + Unpredictable reliability triggers explicit failure-mode language
 * - No numeric scores - provides diagnosis and evaluation steps
 * - Emphasizes backup plan proximity framing
 */

export function createChargingFitBlock(): Block {
  const calculateConfidence = (ctx: RenderCtx) => {
    const hasAccess = ctx.signals.has_charging_access;
    const hasReliability = ctx.signals.has_charging_reliability;
    const hasMoments = ctx.signals.has_weekly_charging_moments;

    // Start with low baseline
    let confidence = 0.30;

    // Each input significantly improves confidence
    if (hasAccess) confidence += 0.25;
    if (hasReliability) confidence += 0.25;
    if (hasMoments) confidence += 0.20;

    return Math.min(confidence, 1.0);
  };

  return {
    id: "charging.fit.text.v1",
    kind: "text",
    title: "Charging Fit (Routine Friction)",
    tier: 4,
    priority: 15,
    requiredSignals: [], // Intentionally empty - we degrade, not withhold
    missingPolicy: "degrade",
    guidanceLevel: 3, // "Here's how to evaluate..." (default for Tier 4)

    confidence: calculateConfidence,

    confidenceFrame: (ctx) => {
      const conf = calculateConfidence(ctx);
      const hasAccess = ctx.signals.has_charging_access;
      const hasReliability = ctx.signals.has_charging_reliability;
      const hasMoments = ctx.signals.has_weekly_charging_moments;

      const baseSources = [];
      const missingSources = [];

      if (hasAccess) baseSources.push("your charging access type");
      else missingSources.push("your charging access details");

      if (hasReliability) baseSources.push("your charging reliability pattern");
      else missingSources.push("reliability of your charging access");

      if (hasMoments) baseSources.push("your weekly charging frequency");
      else missingSources.push("how often you need to charge");

      // If nothing provided, fall back to generic
      if (baseSources.length === 0) {
        baseSources.push("general charging patterns for EV owners");
      }

      return createConfidenceFrame(
        conf,
        baseSources,
        missingSources,
        ["daily convenience", "mental overhead", "routine friction"],
        ["battery health", "safety", "immediate reliability"]
      );
    },

    urgency: () => ({ level: "none" }),

    ask: (ctx) => {
      // If missing all inputs, prompt for charging access first
      if (!ctx.signals.has_charging_access) {
        return {
          key: "charging_access",
          message: personalizationValueProp({
            dataPoint: "your charging access type (home L2, apartment shared, public, etc.)",
            analysis: "identify routine friction points and failure modes",
            outcome: "the charging fit assessment",
            range: "from excellent fit to high friction",
          }),
        };
      }

      // If have access but not reliability
      if (!ctx.signals.has_charging_reliability) {
        return {
          key: "charging_reliability",
          message: personalizationValueProp({
            dataPoint: "how reliably your charging is available",
            analysis: "surface backup plan requirements",
            outcome: "the friction and planning overhead estimate",
            range: "significantly",
          }),
        };
      }

      // If have both but not frequency
      if (!ctx.signals.has_weekly_charging_moments) {
        return {
          key: "weekly_charging_moments",
          message: personalizationValueProp({
            dataPoint: "how many times per week you need to charge",
            analysis: "calculate actual convenience burden",
            outcome: "the routine overhead assessment",
            range: "meaningfully",
          }),
        };
      }

      return undefined;
    },

    render: (ctx) => {
      const chargingAccess = ctx.signals.charging_access;
      const chargingReliability = ctx.signals.charging_reliability;
      const weeklyMoments = ctx.signals.weekly_charging_moments;

      // FAILURE MODE: DC Fast Primary + Unpredictable
      if (chargingAccess === "dc_fast_primary" && chargingReliability === "unpredictable") {
        // Check if battery health is also uncertain (anxiety multiplier)
        const batteryUncertain = !ctx.signals.has_battery_health_report && !ctx.signals.has_battery_data;

        let message = (
          "This pattern is where most apartment EV frustration occurs. " +
          "DC fast charging as your primary method with unpredictable availability creates high mental overhead. " +
          "Most buyers in this situation need a backup plan within 10-15 minutes (another DCFC location or L2 option)."
        );

        // Add battery uncertainty multiplier if applicable
        if (batteryUncertain) {
          message += (
            " Because battery health is uncertain, this charging unpredictability carries more planning overhead. " +
            "With clearer battery data, this same charging setup would feel lower stress."
          );
        }

        message += (
          "\n\n" +
          "Here's how to evaluate: Track one week of actual charging experiences. " +
          "If you find yourself adjusting your schedule or driving out of your way more than twice, " +
          "this setup will likely become a friction point."
        );

        return message;
      }

      // HOME L2 - Generally excellent
      if (chargingAccess === "home_l2") {
        if (chargingReliability === "usually_available") {
          return (
            "Home Level 2 charging with reliable availability is the lowest-friction setup for daily EV ownership. " +
            "This eliminates most routine overhead."
          );
        }
        return (
          "Home Level 2 charging provides good convenience, though reliability variations may require occasional backup planning."
        );
      }

      // APARTMENT SHARED L2
      if (chargingAccess === "apartment_shared_l2") {
        if (chargingReliability === "unpredictable") {
          return (
            "Shared apartment charging with unpredictable availability can create planning friction. " +
            "Most buyers in this situation benefit from identifying a backup L2 or DCFC location within 10-15 minutes."
          );
        }
        if (weeklyMoments === "5_plus") {
          return (
            "Frequent charging needs (5+ times per week) with shared access may create scheduling overhead. " +
            "Here's how to evaluate: Can you reliably access the charger during your preferred times? " +
            "If not, factor in 15-30 minutes of planning overhead per week."
          );
        }
        return (
          "Shared apartment charging can work well if availability aligns with your schedule. " +
          "Having a backup plan nearby reduces friction."
        );
      }

      // PUBLIC L2 PRIMARY
      if (chargingAccess === "public_l2") {
        return (
          "Public L2 as your primary charging method adds routine friction compared to home charging. " +
          "Here's how to evaluate: How many public L2 stations are within 10 minutes of your regular routes? " +
          "Most buyers need at least 2-3 options to avoid availability conflicts."
        );
      }

      // MIXED APPROACH
      if (chargingAccess === "mixed") {
        return (
          "A mixed charging approach (combining home, public L2, and occasional DCFC) provides flexibility. " +
          "The convenience level depends on how often you rely on public charging. " +
          "If public charging is weekly or more, identify 2-3 reliable locations to minimize planning overhead."
        );
      }

      // FALLBACK (should rarely happen)
      return (
        "Charging fit depends on access type, reliability, and how often you need to charge. " +
          "The key factors are: predictable access, backup options within 10-15 minutes, " +
          "and alignment with your daily routine."
      );
    },

    degradedRender: (ctx, missing) => {
      // When we don't have enough data, provide guidance framework
      return (
        "Here's what to provide and why: " +
        "Charging access type, reliability, and weekly frequency let us identify friction points. " +
        "\n\n" +
        "Without this information, we can't advise on whether your charging setup will become a daily burden. " +
        "Most apartment EV frustration stems from unpredictable charging access combined with frequent needs."
      );
    },
  };
}
