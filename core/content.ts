// core/content.ts
import type { SignalKey, SignalMap } from "./signals";
import type { VehicleData, UserInputs } from "@/types";

export type Tier = 1 | 2 | 3 | 4;

export type GuidanceLevel = 1 | 2 | 3;
// 1: "We recommend"
// 2: "Most buyers in your situation..."
// 3: "Here's how to evaluate..."

export type Urgency =
  | { level: "before_purchase"; whyNow: string; timeline?: string }
  | { level: "safety_related"; probability: string; consequence: string }
  | { level: "time_sensitive"; timeline: string; impact: string }
  | { level: "none" };

export type WithholdReason =
  | { kind: "true_unknown"; missing: string; why: string }
  | { kind: "risk_tolerance"; why: string }
  | { kind: "legal_gray"; missing: string; why: string };

export type ConfidenceLabel = "high" | "medium" | "low";

export type ConfidenceFrame = {
  label: ConfidenceLabel;
  practical: string;
  basedOn: string[];
  missing: string[];
  affects: string[];
  notAffects: string[];
};

export type RenderCtx = {
  vehicle: VehicleData;
  inputs?: UserInputs;
  signals: SignalMap;
};

export type MetricPayload = {
  value: string;
  label: string;
};

export type PersonalizationAsk = {
  key: string; // stable identifier, e.g. "annualMileage"
  message: string; // should follow value prop formula
};

/**
 * Missing Policy
 *
 * Determines how blocks behave when required signals are missing:
 * - "withhold": Show withholding message (default, most common)
 * - "degrade": Render with degraded/less specific content
 * - "hide": Don't render the block at all
 */
export type MissingPolicy = "withhold" | "degrade" | "hide";

export type BlockBase = {
  id: string;             // stable identity (never index-based)
  tier: Tier;
  priority: number;       // stable ordering within tier
  requiredSignals?: SignalKey[]; // Now using SignalKey union for type safety
  missingPolicy?: MissingPolicy; // default "withhold"
  guidanceLevel: GuidanceLevel;

  // Strategic honesty
  withhold?: (ctx: RenderCtx) => WithholdReason | undefined;

  // Urgency must be calibrated; default none
  urgency?: (ctx: RenderCtx) => Urgency;

  // Confidence calculation helpers (compose these in blocks)
  baseConfidence?: (ctx: RenderCtx) => number;
  confidenceAdjustments?: Array<(conf: number, ctx: RenderCtx) => number>;

  // Confidence must be dynamic (final calculated value)
  confidence: (ctx: RenderCtx) => number;

  // Confidence explanation required for user-visible blocks
  confidenceFrame: (ctx: RenderCtx) => ConfidenceFrame;

  // Optional inline ask (Phase 1 prompts)
  ask?: (ctx: RenderCtx) => PersonalizationAsk | undefined;
};

export type TextBlock = BlockBase & {
  kind: "text";
  title: string;
  render: (ctx: RenderCtx) => string;
  degradedRender?: (ctx: RenderCtx, missing: SignalKey[]) => string;
};

export type MetricBlock = BlockBase & {
  kind: "metric";
  title: string;
  metric: (ctx: RenderCtx) => MetricPayload;
  render?: (ctx: RenderCtx) => string; // optional supporting text
  degradedRender?: (ctx: RenderCtx, missing: SignalKey[]) => string;
};

export type Block = TextBlock | MetricBlock;

export function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
