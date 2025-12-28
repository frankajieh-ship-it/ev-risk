import { clamp01 } from "@/core/content";
import { labelFromConfidence } from "@/core/templates";
import type { ConfidenceLabel } from "@/core/content";

/**
 * Confidence Primitives Library
 *
 * Reusable functions for building confidence scores and frames.
 * These primitives enable consistent confidence calculation across all blocks.
 */

// Base confidence from data quality
export function baseFromSource(source?: "high" | "medium" | "low" | null): number {
  if (source === "high") return 0.75;
  if (source === "medium") return 0.55;
  return 0.35;
}

export function baseFromBoolean(hasData: boolean): number {
  return hasData ? 0.6 : 0.3;
}

export function baseFromCount(count: number, threshold: number): number {
  return clamp01(count / threshold);
}

// Adjustments
export function addIfPresent(conf: number, present: boolean, delta: number): number {
  return clamp01(conf + (present ? delta : 0));
}

export function penalizeIfMissing(conf: number, missing: boolean, penalty: number): number {
  return clamp01(conf - (missing ? penalty : 0));
}

export function penalizePerMissing(conf: number, missingCount: number, penaltyPer: number): number {
  return clamp01(conf - missingCount * penaltyPer);
}

// Composite confidence builder
export function buildConfidence(
  base: number,
  adjustments: Array<(c: number) => number>
): number {
  return adjustments.reduce((acc, adjust) => adjust(acc), base);
}

// Confidence frame generator (standardized)
export function createConfidenceFrame(
  score: number,
  baseSources: string[],
  missingSources: string[],
  affects: string[],
  notAffects: string[] = []
) {
  const label = labelFromConfidence(score);

  const practicalMeanings: Record<ConfidenceLabel, string> = {
    high: "our estimate is well-supported by available data",
    medium: "our estimate is directionally useful but has limitations",
    low: "our estimate is preliminary and should be treated with caution"
  };

  return {
    label,
    practical: practicalMeanings[label],
    basedOn: baseSources,
    missing: missingSources,
    affects,
    notAffects: notAffects.length > 0 ? notAffects : ["immediate safety"] // default
  };
}
