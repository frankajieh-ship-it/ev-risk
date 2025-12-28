import type { Block, RenderCtx } from "@/core/content";
import { createConfidenceFrame } from "@/core/confidence/primitives";

/**
 * Assumption Drift Summary Block
 *
 * Tier 0 (informational) - Appears when context_trigger indicates re-validation.
 * Explains what changed and why it matters for the original EV purchase decision.
 *
 * Behavior:
 * - Only renders when context_trigger !== "just_rechecking"
 * - Missing policy: "hide" (if no context trigger, don't show at all)
 * - Uses withholding language if insufficient data to state drift confidently
 * - Outputs 2-4 bullet statements about assumption drift
 */

export function createAssumptionDriftBlock(): Block {
  const calculateConfidence = (ctx: RenderCtx) => {
    const hasTrigger = ctx.signals.has_context_trigger;
    const hasChargingData = ctx.signals.has_charging_access || ctx.signals.has_charging_reliability;
    const hasDrivingData = ctx.signals.has_daily_commute || ctx.signals.has_annual_mileage;

    if (!hasTrigger) return 0;

    // High confidence if we have supporting data
    let confidence = 0.50; // Base for having trigger

    if (hasChargingData) confidence += 0.25;
    if (hasDrivingData) confidence += 0.25;

    return Math.min(confidence, 1.0);
  };

  return {
    id: "assumption.drift.text.v1",
    kind: "text",
    title: "What Changed — and Why It Matters",
    tier: 4, // Informational tier
    priority: 5, // Show early in report
    requiredSignals: ["has_context_trigger"], // Must have context trigger
    missingPolicy: "hide", // Don't show if no context trigger

    confidence: calculateConfidence,

    confidenceFrame: (ctx) => {
      const conf = calculateConfidence(ctx);
      const trigger = ctx.signals.context_trigger;
      const hasChargingData = ctx.signals.has_charging_access;
      const hasDrivingData = ctx.signals.has_daily_commute;

      const baseSources = [`your reported context change (${trigger})`];
      const missingSources = [];

      if (hasChargingData) {
        baseSources.push("your current charging setup");
      } else {
        missingSources.push("your current charging details");
      }

      if (hasDrivingData) {
        baseSources.push("your current driving patterns");
      } else {
        missingSources.push("your current commute/mileage data");
      }

      return createConfidenceFrame(
        conf,
        baseSources,
        missingSources,
        ["assumption validity", "decision re-evaluation needs"],
        ["vehicle quality", "battery health", "safety"]
      );
    },

    guidanceLevel: 3, // "Here's how to evaluate..."

    urgency: () => ({ level: "none" }),

    withhold: (ctx) => {
      // If we have trigger but not enough supporting data
      const trigger = ctx.signals.context_trigger;
      const hasChargingData = ctx.signals.has_charging_access;
      const hasDrivingData = ctx.signals.has_daily_commute;

      if (trigger && trigger !== "just_rechecking") {
        if (!hasChargingData && !hasDrivingData) {
          return {
            kind: "true_unknown",
            missing: "your current charging setup and driving patterns",
            why: "context changes affect different aspects of EV ownership differently",
          };
        }
      }

      return undefined;
    },

    render: (ctx) => {
      const trigger = ctx.signals.context_trigger;
      const chargingAccess = ctx.signals.charging_access;
      const chargingReliability = ctx.signals.charging_reliability;
      const dailyCommute = ctx.signals.daily_commute_miles;
      const hasHomeCharging = ctx.signals.home_charging;

      const bullets: string[] = [];

      // Generate drift statements based on trigger + data
      switch (trigger) {
        case "moved_home":
          bullets.push("Your original decision assumed specific charging access at your previous location.");

          if (chargingAccess === "dc_fast_primary" || chargingAccess === "public_l2") {
            bullets.push("You now rely on public charging as your primary method, which typically adds 3-5 hours per week of planning overhead.");
          } else if (chargingAccess === "home_l2" && !hasHomeCharging) {
            bullets.push("Your charging access changed from home charging to other methods, which affects daily convenience.");
          }

          if (chargingReliability === "unpredictable") {
            bullets.push("Charging availability is now unpredictable, requiring backup plans that weren't part of your original assessment.");
          }
          break;

        case "changed_commute":
          bullets.push("Your original range buffer was calculated for a different commute distance.");

          if (dailyCommute && dailyCommute > 60) {
            bullets.push("Your daily driving now requires more frequent charging, which affects both convenience and battery cycling patterns.");
          }

          bullets.push("Changes in commute routes may also change access to opportunistic charging locations.");
          break;

        case "changed_schedule":
          bullets.push("Your original decision assumed predictable charging windows aligned with your previous schedule.");

          if (chargingAccess === "apartment_shared_l2") {
            bullets.push("Shared charging with a new schedule creates potential conflicts that weren't part of the original assessment.");
          }

          bullets.push("Schedule changes affect when you can charge, which may introduce new planning friction.");
          break;

        case "charging_changed":
          bullets.push("Your original charging setup has changed, affecting the convenience baseline you planned for.");

          if (chargingReliability === "unpredictable" || chargingReliability === "sometimes_available") {
            bullets.push("Reduced charging reliability means the margin for error in your original plan has decreased.");
          }

          if (chargingAccess === "dc_fast_primary") {
            bullets.push("Reliance on DC fast charging wasn't part of your original ownership model and adds both cost and time overhead.");
          }
          break;

        default:
          // Generic fallback
          bullets.push("Your context has changed in ways that affect the assumptions underlying your EV purchase decision.");
          bullets.push("The key question is whether the changed context still aligns with this vehicle's capabilities.");
      }

      // Add closing statement
      if (bullets.length < 4) {
        bullets.push("Re-validation focuses on whether the changed context still makes this EV a good fit for your life.");
      }

      return bullets.map((b, i) => `${i + 1}. ${b}`).join("\n\n");
    },
  };
}
