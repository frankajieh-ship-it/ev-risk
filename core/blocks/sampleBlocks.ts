// core/blocks/sampleBlocks.ts
import { Block, clamp01, RenderCtx } from "@/core/content";
import { personalizationValueProp, confidencePresets, labelFromConfidence, downgradeGuidanceIfNeeded } from "@/core/templates";
import { buildSignals as buildSignalsAdapter, getSignal, hasAllSignals, type SignalKey } from "@/core/signals";
import type { VehicleData, UserInputs } from "@/types";

// Re-export buildSignals for backward compatibility
export { buildSignals } from "@/core/signals";

export function getBlocks(ctx: RenderCtx): Block[] {
  const { vehicle, inputs, signals } = ctx;

  const blocks: Block[] = [];

  // Tier 2: Battery metric block
  if (signals.has_battery_data) {
    blocks.push({
      id: "battery.health.metric.v1",
      kind: "metric",
      title: "Battery Health",
      tier: 2,
      priority: 10,
      guidanceLevel: 2,
      requiredSignals: ["has_battery_data", "battery_degradation_pct"] as SignalKey[],

      confidence: (c) => {
        // Dynamic: increases when annual mileage provided.
        const base = (vehicle?.batteryData?.confidence === "high") ? 0.75 :
                     (vehicle?.batteryData?.confidence === "medium") ? 0.55 : 0.35;
        const bonus = getSignal(c.signals, "annual_mileage") ? 0.1 : 0;
        return clamp01(base + bonus);
      },

      confidenceFrame: (c) => {
        const hasMileage = Boolean(getSignal(c.signals, "annual_mileage"));
        return confidencePresets.batteryHealth(hasMileage);
      },

      withhold: (c) => {
        // Withhold if no battery health data at all
        if (!c.vehicle?.batteryData) {
          return {
            kind: "true_unknown",
            missing: "battery health data",
            why: "battery lifespan varies widely between vehicles with similar mileage",
          };
        }
        return undefined;
      },

      urgency: () => ({ level: "none" }),

      ask: (c) => {
        if (getSignal(c.signals, "annual_mileage")) return undefined;
        return {
          key: "annualMileage",
          message: personalizationValueProp({
            dataPoint: "your annual mileage",
            analysis: "separate gentle vs. taxing usage patterns",
            outcome: "the battery replacement timeline",
            range: "±2 years",
          }),
        };
      },

      metric: (c) => ({
        label: "Estimated degradation",
        value: `${c.vehicle?.batteryData?.degradation ?? "—"}%`,
      }),

      render: (c) => {
        // Plain, specific, non-marketing supporting sentence
        return getSignal(c.signals, "annual_mileage")
          ? "This projection reflects your usage context, which makes the timeline estimate more reliable."
          : "Without your mileage context, we estimate using population averages, which mainly affects long-term replacement timing.";
      },
    });
  }

  // Tier 1: Recalls block
  if (signals.has_recalls) {
    blocks.push({
      id: "recalls.safety.text.v1",
      kind: "text",
      title: "Recalls & Safety",
      tier: 1,
      priority: 5,
      guidanceLevel: 1,

      requiredSignals: ["has_recalls"] as SignalKey[],

      confidence: () => 0.9, // recall presence is usually high certainty
      confidenceFrame: (c) => {
        const hasVerification = Boolean(getSignal(c.signals, "dealer_verification"));
        return confidencePresets.recalls(hasVerification);
      },

      urgency: (c) => ({
        level: "before_purchase",
        whyNow: "open recalls can affect registration, safety, and immediate reliability",
        timeline: "3–7 days",
      }),

      render: (c) => {
        const recalls = c.vehicle?.recalls ?? [];
        const critical = recalls.filter((r: any) => r.priority === "high");
        const criticalText = critical.length
          ? ` ${critical.length} appear safety-critical.`
          : "";

        // No "urgent". Calibrated.
        return `We recommend confirming recall completion before purchase. ${recalls.length} open recalls detected.${criticalText}`;
      },
    });
  }

  return blocks.sort((a, b) => (a.tier - b.tier) || (a.priority - b.priority));
}
