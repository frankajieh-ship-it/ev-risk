import type { Block, RenderCtx } from "@/core/content";
import {
  baseFromSource,
  addIfPresent,
  penalizeIfMissing,
  createConfidenceFrame
} from "@/core/confidence/primitives";
import { personalizationValueProp } from "@/core/templates";

/**
 * Battery Health Block Example
 *
 * Demonstrates all three missing policies and confidence primitives usage.
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
          why: "battery lifespan varies widely between vehicles with similar mileage",
        };
      }
      return undefined;
    },

    urgency: () => ({ level: "none" }),

    ask: (ctx) => {
      if (ctx.signals.has_annual_mileage) return undefined;
      return {
        key: "annual_mileage",
        message: personalizationValueProp({
          dataPoint: "your annual mileage",
          analysis: "separate gentle vs. taxing usage patterns",
          outcome: "the battery replacement timeline",
          range: "±2 years",
        }),
      };
    },

    metric: (ctx) => ({
      label: "Estimated degradation",
      value: `${ctx.signals.battery_degradation_pct ?? "—"}%`,
    }),

    render: (ctx) => {
      if (ctx.signals.has_battery_health_report) {
        return "This projection is based on direct battery health testing.";
      }
      if (ctx.signals.has_annual_mileage) {
        return "This projection reflects your usage context, making the timeline estimate more reliable.";
      }
      return "Without your usage data, we estimate using population averages, which mainly affects long-term replacement timing.";
    },

    degradedRender: (ctx, missing) => {
      // Used when missingPolicy = "degrade" and some (not all) signals missing
      return `Limited analysis due to missing ${missing.join(", ")}. Consider obtaining ${missing.join(" and ")} for more accurate assessment.`;
    },
  };
}
