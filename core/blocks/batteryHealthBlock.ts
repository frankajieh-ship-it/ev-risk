import type { Block, RenderCtx } from "@/core/content";
import {
  baseFromSource,
  addIfPresent,
  penalizeIfMissing,
  createConfidenceFrame
} from "@/core/confidence/primitives";
import { personalizationValueProp } from "@/core/templates";

/**
 * Battery Health Block (Phase 1.5 - Anxiety Multiplier Framing)
 *
 * Architecture:
 * - Battery health = base condition (standalone block)
 * - Charging fit = routine stress (separate block)
 * - Anxiety = interaction effect (explained, not computed)
 *
 * Language directive:
 * - De-emphasize mileage
 * - Emphasize battery condition vs expectations
 * - Use ICE analogs for uncertainty: "like buying a used car without service records"
 * - Frame as uncertainty amplifier, not just degradation metric
 * - Focus on "what's missing / why it matters" framing
 */

export function createBatteryHealthBlock(): Block {
  // Extract confidence calculation so it can be reused
  const calculateConfidence = (ctx: RenderCtx) => {
    let c = baseFromSource(ctx.signals.battery_confidence_source);
    c = addIfPresent(c, ctx.signals.has_annual_mileage, 0.1);
    c = penalizeIfMissing(c, !ctx.signals.has_battery_health_report, 0.25);
    return c;
  };

  return {
    id: "battery.health.metric.v1",
    kind: "metric",
    title: "Battery Health",
    tier: 2,
    priority: 10,
    requiredSignals: ["has_battery_data"],
    missingPolicy: "withhold", // Critical data missing → withhold

    confidence: calculateConfidence,

    confidenceFrame: (ctx) => {
      const conf = calculateConfidence(ctx); // Reuse the extracted function
      const hasReport = ctx.signals.has_battery_health_report;
      const hasMileage = ctx.signals.has_annual_mileage;

      const baseSources = ["vehicle battery data"];
      if (hasMileage) baseSources.push("your annual mileage");
      if (hasReport) baseSources.push("battery health report");

      const missingSources = [];
      if (!hasReport) missingSources.push("battery health report");
      if (!hasMileage) missingSources.push("your actual usage data");

      return createConfidenceFrame(
        conf,
        baseSources,
        missingSources,
        ["battery replacement timing", "long-term cost exposure"],
        ["immediate safety"]
      );
    },

    withhold: (ctx) => {
      if (!ctx.signals.has_battery_data) {
        return {
          kind: "true_unknown",
          missing: "battery health data",
          why: "battery uncertainty increases planning overhead — especially when charging is unpredictable. This is like buying a used car without service records",
        };
      }
      return undefined;
    },

    urgency: () => ({ level: "none" }),

    ask: (ctx) => {
      // De-emphasize mileage per CMO directive - only ask if we have battery data
      if (ctx.signals.has_annual_mileage || !ctx.signals.has_battery_data) return undefined;
      return {
        key: "annual_mileage",
        message: personalizationValueProp({
          dataPoint: "your usage patterns",
          analysis: "distinguish gentle vs. taxing battery cycling",
          outcome: "battery condition expectations",
          range: "meaningfully",
        }),
      };
    },

    metric: (ctx) => ({
      label: "Estimated degradation",
      value: `${ctx.signals.battery_degradation_pct ?? "—"}%`,
    }),

    render: (ctx) => {
      // Phase 1.5: Frame battery as uncertainty amplifier
      if (ctx.signals.has_battery_health_report) {
        return "This assessment is based on direct battery condition testing, not estimates from mileage or age. This removes one major unknown from your ownership assessment.";
      }
      if (ctx.signals.has_annual_mileage) {
        return "Battery condition depends more on usage patterns than total mileage. Your usage context helps set realistic expectations — especially when combined with charging fit data.";
      }
      return "Without battery condition data, this is like buying a used car without service records. Battery uncertainty amplifies charging concerns: if charging is already unpredictable, unknown battery condition creates compounding planning overhead.";
    },

    degradedRender: (ctx, missing) => {
      // Used when missingPolicy = "degrade" and some (not all) signals missing
      return `Limited analysis due to missing ${missing.join(", ")}. Consider obtaining ${missing.join(" and ")} for more accurate assessment.`;
    },
  };
}
