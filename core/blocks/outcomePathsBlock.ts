import type { Block, RenderCtx } from "@/core/content";
import { createConfidenceFrame } from "@/core/confidence/primitives";

/**
 * Outcome Paths Block (Non-Transactional Decision Framework)
 *
 * Tier 4 - Final block listing multiple valid outcomes.
 * Prevents marketplace vibe by always including "stay" options.
 * Highlights 1-2 options based on context without hiding others.
 *
 * Behavior:
 * - Always shows multiple paths (not ranked, not salesy)
 * - No trade-in language, no vehicle recommendations
 * - Emphasizes user agency and decision clarity
 * - Missing policy: "degrade" (shows generic options if no data)
 */

export function createOutcomePathsBlock(): Block {
  const calculateConfidence = (ctx: RenderCtx) => {
    const hasContext = ctx.signals.has_context_trigger;
    const hasChargingData = ctx.signals.has_charging_access && ctx.signals.has_charging_reliability;
    const hasDrivingData = ctx.signals.has_daily_commute || ctx.signals.has_annual_mileage;

    let confidence = 0.40; // Base confidence for showing options

    if (hasContext) confidence += 0.20;
    if (hasChargingData) confidence += 0.20;
    if (hasDrivingData) confidence += 0.20;

    return Math.min(confidence, 1.0);
  };

  return {
    id: "outcome.paths.text.v1",
    kind: "text",
    title: "Your Options",
    tier: 4,
    priority: 50, // Show last
    requiredSignals: [], // Always show
    missingPolicy: "degrade",
    guidanceLevel: 3, // "Here's how to evaluate..."

    confidence: calculateConfidence,

    confidenceFrame: (ctx) => {
      const conf = calculateConfidence(ctx);
      const hasContext = ctx.signals.has_context_trigger;
      const hasChargingData = ctx.signals.has_charging_access;

      const baseSources = ["your reported situation"];
      const missingSources = [];

      if (hasContext) {
        baseSources.push("your context change trigger");
      }

      if (hasChargingData) {
        baseSources.push("your charging setup details");
      } else {
        missingSources.push("complete charging situation data");
      }

      return createConfidenceFrame(
        conf,
        baseSources,
        missingSources,
        ["decision clarity", "option relevance"],
        ["vehicle quality", "safety", "battery health"]
      );
    },

    urgency: () => ({ level: "none" }),

    render: (ctx) => {
      const trigger = ctx.signals.context_trigger;
      const chargingAccess = ctx.signals.charging_access;
      const chargingReliability = ctx.signals.charging_reliability;
      const hasCriticalRecalls = ctx.signals.open_recalls_critical_count > 0;
      const batteryDegradation = ctx.signals.battery_degradation_pct;

      const options: Array<{ title: string; description: string; highlighted?: boolean }> = [];

      // OPTION 1: Stay and adjust routine
      const stayOption = {
        title: "Stay and adjust routine",
        description: "",
        highlighted: false,
      };

      if (chargingAccess === "home_l2" || (chargingReliability === "usually_available")) {
        stayOption.description = "Your charging setup supports continued ownership with minimal friction. Focus on optimizing your charging schedule.";
        stayOption.highlighted = true;
      } else if (chargingAccess === "apartment_shared_l2" && chargingReliability === "sometimes_available") {
        stayOption.description = "Continued ownership is feasible if you can establish a predictable charging rhythm. Identify backup locations within 10-15 minutes.";
      } else {
        stayOption.description = "This works if you can establish a reliable charging routine and accept the current level of planning overhead.";
      }
      options.push(stayOption);

      // OPTION 2: Change charging strategy
      const chargingOption = {
        title: "Change charging strategy",
        description: "",
        highlighted: false,
      };

      if (chargingAccess === "dc_fast_primary" && chargingReliability === "unpredictable") {
        chargingOption.description = "Explore adding a more predictable L2 option (workplace, nearby public station with reservation system). This reduces mental overhead significantly.";
        chargingOption.highlighted = true;
      } else if (chargingAccess === "apartment_shared_l2") {
        chargingOption.description = "Options include: negotiating dedicated time slots, adding a workplace charging arrangement, or identifying reliable public L2 backups.";
      } else {
        chargingOption.description = "Adjust where and how you charge to better align with your current routine and reduce friction points.";
      }
      options.push(chargingOption);

      // OPTION 3: Reconsider vehicle class
      const vehicleOption = {
        title: "Reconsider vehicle class",
        description: "",
        highlighted: false,
      };

      if (batteryDegradation && batteryDegradation > 20) {
        vehicleOption.description = "Battery degradation above 20% combined with changed usage may warrant evaluating vehicles with larger battery packs or better range.";
        vehicleOption.highlighted = true;
      } else if (trigger === "changed_commute" && ctx.signals.daily_commute_miles > 80) {
        vehicleOption.description = "Significantly longer commutes may benefit from a vehicle with more range margin to reduce charging frequency.";
      } else {
        vehicleOption.description = "If your changed circumstances don't align with this vehicle's capabilities, a different EV class might better fit your needs.";
      }
      options.push(vehicleOption);

      // OPTION 4: Pause EV ownership temporarily
      const pauseOption = {
        title: "Pause EV ownership temporarily",
        description: "",
        highlighted: false,
      };

      if (hasCriticalRecalls && (chargingReliability === "unpredictable" || chargingAccess === "dc_fast_primary")) {
        pauseOption.description = "Critical safety recalls combined with high charging friction may warrant pausing until both are resolved.";
        pauseOption.highlighted = true;
      } else if (chargingAccess === "public_l2" && chargingReliability === "unpredictable") {
        pauseOption.description = "If current charging access is temporary (e.g., during a move), pausing ownership until stable access is established may reduce frustration.";
      } else {
        pauseOption.description = "This is valid if your current situation makes EV ownership significantly more burdensome than anticipated, and changes are temporary.";
      }
      options.push(pauseOption);

      // Format output
      const lines: string[] = [];

      for (const option of options) {
        const prefix = option.highlighted ? "**→ " : "• ";
        const suffix = option.highlighted ? "**" : "";
        lines.push(`${prefix}${option.title}${suffix}`);
        lines.push(`  ${option.description}`);
        lines.push(""); // Blank line between options
      }

      // Add footer note
      lines.push("All of these are valid paths. The best choice depends on your priorities, constraints, and how temporary or permanent your changed circumstances are.");

      return lines.join("\n");
    },

    degradedRender: (ctx) => {
      // Generic version when we lack data
      return (
        "**Your decision paths:**\n\n" +
        "• Stay and adjust routine\n" +
        "  Continued ownership with modifications to charging or usage patterns.\n\n" +
        "• Change charging strategy\n" +
        "  Add backup options, negotiate better access, or adjust when/where you charge.\n\n" +
        "• Reconsider vehicle class\n" +
        "  Evaluate whether a different EV better matches your current needs.\n\n" +
        "• Pause EV ownership temporarily\n" +
        "  Valid if changes are temporary and current friction is high.\n\n" +
        "Without more details about your situation, we cannot highlight which path makes most sense. " +
        "All options remain on the table."
      );
    },
  };
}
