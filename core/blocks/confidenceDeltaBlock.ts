import type { Block, RenderCtx } from "@/core/content";
import { createConfidenceFrame } from "@/core/confidence/primitives";

/**
 * Confidence Delta Explainer Block (Phase 1.5)
 *
 * Purpose: Show users what's missing and what closes the confidence gap
 * Framing: Decision confidence, not vehicle quality
 *
 * Example output:
 * "Decision Confidence: 65% → 95%
 *  What closes the gap:
 *  • Battery health report (+12%)
 *  • Charging reliability confirmation (+10%)
 *  • Usage pattern clarification (+8%)"
 */

export function createConfidenceDeltaBlock(): Block {
  const calculateCurrentConfidence = (ctx: RenderCtx): number => {
    // Aggregate confidence from all available signals
    let baseConfidence = 0.30; // Starting point for used EV assessment

    // Battery data contribution
    if (ctx.signals.has_battery_health_report) baseConfidence += 0.25;
    else if (ctx.signals.has_battery_data) baseConfidence += 0.12;

    // Charging context contribution
    if (ctx.signals.has_charging_access) baseConfidence += 0.15;
    if (ctx.signals.has_charging_reliability) baseConfidence += 0.10;

    // Usage pattern contribution
    if (ctx.signals.has_annual_mileage) baseConfidence += 0.08;
    if (ctx.signals.has_weekly_charging_moments) baseConfidence += 0.05;

    return Math.min(baseConfidence, 1.0);
  };

  const calculateMaxConfidence = (): number => {
    // Maximum achievable confidence with all data
    return 0.95; // Not 100% - there's always some uncertainty in used vehicle assessment
  };

  const identifyGaps = (ctx: RenderCtx): Array<{ missing: string; impact: string }> => {
    const gaps: Array<{ missing: string; impact: string }> = [];

    // Battery health gap (highest impact)
    if (!ctx.signals.has_battery_health_report && !ctx.signals.has_battery_data) {
      gaps.push({
        missing: "Battery health report",
        impact: "+25%",
      });
    } else if (ctx.signals.has_battery_data && !ctx.signals.has_battery_health_report) {
      gaps.push({
        missing: "Verified battery health report",
        impact: "+13%",
      });
    }

    // Charging context gaps
    if (!ctx.signals.has_charging_access) {
      gaps.push({
        missing: "Your charging access type",
        impact: "+15%",
      });
    }

    if (!ctx.signals.has_charging_reliability) {
      gaps.push({
        missing: "Charging reliability pattern",
        impact: "+10%",
      });
    }

    // Usage pattern gaps
    if (!ctx.signals.has_annual_mileage) {
      gaps.push({
        missing: "Your annual mileage / usage patterns",
        impact: "+8%",
      });
    }

    if (!ctx.signals.has_weekly_charging_moments) {
      gaps.push({
        missing: "How often you need to charge",
        impact: "+5%",
      });
    }

    return gaps;
  };

  return {
    id: "confidence.delta.explainer.v1",
    kind: "text",
    title: "What Would Improve This Assessment",
    tier: 4, // Decision support
    priority: 50, // Show after main blocks but before outcome paths
    requiredSignals: [], // Always show
    missingPolicy: "degrade",
    guidanceLevel: 3, // "Here's how to evaluate" level

    confidence: calculateCurrentConfidence,

    confidenceFrame: (ctx) => {
      const current = calculateCurrentConfidence(ctx);
      const gaps = identifyGaps(ctx);

      return createConfidenceFrame(
        current,
        ["available vehicle listing data", "general used EV patterns"],
        gaps.map((g) => g.missing),
        ["decision confidence", "risk assessment accuracy"],
        ["immediate vehicle safety", "current condition"]
      );
    },

    urgency: () => ({ level: "none" }),

    render: (ctx) => {
      const current = calculateCurrentConfidence(ctx);
      const max = calculateMaxConfidence();
      const gaps = identifyGaps(ctx);

      // If already at high confidence, acknowledge that
      if (current >= 0.85) {
        return (
          "✅ This assessment has strong data support. " +
          "The remaining uncertainty is typical for used EV evaluations and mainly affects long-term projections, not immediate fit."
        );
      }

      // Show confidence delta
      const currentPct = Math.round(current * 100);
      const maxPct = Math.round(max * 100);

      let message = `🔐 Decision Confidence: ${currentPct}%`;

      if (gaps.length > 0) {
        message += ` → ${maxPct}% (potential)\n\n`;
        message += "What closes the gap:\n";

        gaps.forEach((gap) => {
          message += `• ${gap.missing} (${gap.impact})\n`;
        });

        message += "\n";
        message += (
          "This estimate reflects typical used EV uncertainty patterns. " +
          "Higher confidence narrows the range of possible outcomes — it doesn't change the vehicle's condition."
        );
      } else {
        message += "\n\nYou've provided comprehensive context for this assessment.";
      }

      return message;
    },

    degradedRender: (ctx, missing) => {
      // Fallback when minimal data available
      return (
        "This assessment currently relies on limited data. Providing your charging access, " +
        "battery health information, and usage patterns would significantly improve decision confidence."
      );
    },
  };
}
