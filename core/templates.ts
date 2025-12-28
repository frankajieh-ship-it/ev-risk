// core/templates.ts
import { ConfidenceFrame, ConfidenceLabel, GuidanceLevel, Urgency, WithholdReason } from "./content";

export function guidancePrefix(level: GuidanceLevel): string {
  if (level === 1) return "We recommend";
  if (level === 2) return "Most buyers in your situation";
  return "Here's how to evaluate";
}

export function tierLabel(tier: 1|2|3|4): string {
  return tier === 1 ? "Safety & Reliability" :
         tier === 2 ? "Battery Health" :
         tier === 3 ? "Cost Exposure" :
         "Convenience & Fit";
}

export function withholdText(w: WithholdReason): string {
  if (w.kind === "true_unknown") {
    return `We cannot advise here because ${w.why} Without ${w.missing}, any recommendation would be speculative.`;
  }
  if (w.kind === "legal_gray") {
    return `We cannot advise here because ${w.why} Without ${w.missing}, any recommendation would be speculative.`;
  }
  return `This comes down to your tolerance for uncertainty. ${w.why}`;
}

/**
 * Confidence Guards
 *
 * Enforce consistency between confidence scores and messaging
 */

/**
 * Convert numeric confidence to label
 *
 * Ensures consistent thresholds across all blocks
 */
export function labelFromConfidence(score: number): ConfidenceLabel {
  if (score >= 0.70) return "high";
  if (score >= 0.40) return "medium";
  return "low";
}

/**
 * Downgrade guidance level if confidence is insufficient
 *
 * Rules:
 * 1. Non-Tier 1 blocks cannot use authoritative language (level 1) with < 0.70 confidence
 * 2. Very low confidence (< 0.40) forces evaluation framing (level 3)
 * 3. Tier 1 safety issues can remain firm even with medium confidence
 */
export function downgradeGuidanceIfNeeded(
  tier: 1 | 2 | 3 | 4,
  proposedLevel: GuidanceLevel,
  confidence: number
): GuidanceLevel {
  let currentLevel = proposedLevel;

  // Rule 1: Non-Tier 1 blocks cannot use authoritative language with < 0.70 confidence
  if (tier >= 2 && confidence < 0.70 && currentLevel === 1) {
    currentLevel = 2; // Downgrade to "Most buyers in your situation..."
  }

  // Rule 2: Very low confidence forces evaluation framing
  if (confidence < 0.40 && currentLevel <= 2) {
    currentLevel = 3; // Downgrade to "Here's how to evaluate..."
  }

  // Rule 3: Tier 1 safety issues can remain firm even with medium confidence
  return currentLevel;
}

export function confidenceText(cf: ConfidenceFrame): string {
  return `${cap(cf.label)} confidence means ${cf.practical}. ` +
    `This estimate is based on ${list(cf.basedOn)}, not ${list(cf.missing)}. ` +
    `This typically affects ${list(cf.affects)}, but not ${list(cf.notAffects)}.`;
}

export function personalizationValueProp(args: {
  dataPoint: string;
  analysis: string;
  outcome: string;
  range: string; // quantified range (required)
}) {
  return `Share ${args.dataPoint} → We'll ${args.analysis} → which adjusts ${args.outcome} by roughly ${args.range}.`;
}

export function urgencyCalibration(u: Urgency): string | null {
  if (u.level === "none") return null;
  if (u.level === "before_purchase") {
    return `This matters before purchase because ${u.whyNow}${u.timeline ? `. Typical resolution: ${u.timeline}.` : "."}`;
  }
  if (u.level === "safety_related") {
    return `Safety-related: likelihood ${u.probability}; consequence ${u.consequence}.`;
  }
  return `Time-sensitive: ${u.impact}. Timeline: ${u.timeline}.`;
}

/**
 * Enhanced Confidence Frame Factory
 *
 * Creates standardized confidence explanations with common patterns
 */
export function createConfidenceFrame(config: {
  label: ConfidenceLabel;
  hasPersonalization: boolean;
  specificData: string[];
  genericData: string[];
  affects: string[];
  notAffects: string[];
}): ConfidenceFrame {
  const { label, hasPersonalization, specificData, genericData, affects, notAffects } = config;

  // Determine practical meaning based on label + personalization
  const practical = getPracticalMeaning(label, hasPersonalization);

  // Determine what we're based on
  const basedOn = hasPersonalization
    ? [...specificData, ...genericData]
    : genericData;

  // Determine what's missing
  const missing = hasPersonalization
    ? []
    : specificData;

  return {
    label,
    practical,
    basedOn,
    missing,
    affects,
    notAffects,
  };
}

/**
 * Standard practical meaning patterns
 */
function getPracticalMeaning(label: ConfidenceLabel, hasPersonalization: boolean): string {
  if (label === "high") {
    return hasPersonalization
      ? "this estimate is reliable for decision-making and tailored to your specific situation"
      : "this estimate is reliable based on verifiable data, though not personalized to your usage";
  }

  if (label === "medium") {
    return hasPersonalization
      ? "our estimate is more tailored to your usage, though some uncertainty remains"
      : "our estimate is directionally useful but still based on population averages, not your specific context";
  }

  // low
  return hasPersonalization
    ? "this estimate has meaningful uncertainty even with your inputs, and should be validated"
    : "this estimate uses broad averages and should be validated before making decisions";
}

/**
 * Common confidence frame presets
 */
export const confidencePresets = {
  /**
   * Battery health estimation
   */
  batteryHealth: (hasAnnualMileage: boolean): ConfidenceFrame => createConfidenceFrame({
    label: hasAnnualMileage ? "high" : "medium",
    hasPersonalization: hasAnnualMileage,
    specificData: ["your annual mileage", "your typical driving patterns"],
    genericData: ["vehicle battery data", "model-level degradation curves", "population averages"],
    affects: ["battery replacement timing", "long-term cost exposure", "resale value projection"],
    notAffects: ["immediate safety", "current drivability", "warranty coverage"],
  }),

  /**
   * Recall verification
   */
  recalls: (hasDealerVerification: boolean): ConfidenceFrame => createConfidenceFrame({
    label: hasDealerVerification ? "high" : "high", // Still high even without verification
    hasPersonalization: hasDealerVerification,
    specificData: ["dealer verification of completion status"],
    genericData: ["reported recall listings for this vehicle", "NHTSA recall database"],
    affects: ["purchase readiness", "safety and reliability risk", "registration timing"],
    notAffects: ["battery degradation estimates", "range fit", "charging compatibility"],
  }),

  /**
   * Range fit assessment
   */
  rangeFit: (hasDailyCommute: boolean): ConfidenceFrame => createConfidenceFrame({
    label: hasDailyCommute ? "high" : "medium",
    hasPersonalization: hasDailyCommute,
    specificData: ["your daily commute distance", "your typical weekly mileage"],
    genericData: ["vehicle range specifications", "typical degradation for age/mileage"],
    affects: ["daily usability", "charging frequency", "range anxiety risk"],
    notAffects: ["battery replacement timing", "safety", "recall status"],
  }),

  /**
   * Charging infrastructure
   */
  chargingInfra: (hasHomeCharging: boolean, hasZipCode: boolean): ConfidenceFrame => createConfidenceFrame({
    label: (hasHomeCharging && hasZipCode) ? "high" : hasHomeCharging ? "medium" : "low",
    hasPersonalization: hasHomeCharging || hasZipCode,
    specificData: ["your home charging setup", "your location for infrastructure mapping"],
    genericData: ["national charging network coverage", "typical charging costs"],
    affects: ["daily convenience", "per-mile costs", "trip planning requirements"],
    notAffects: ["battery health", "safety", "immediate reliability"],
  }),

  /**
   * Cost exposure
   */
  costExposure: (hasRiskTolerance: boolean): ConfidenceFrame => createConfidenceFrame({
    label: hasRiskTolerance ? "medium" : "low",
    hasPersonalization: hasRiskTolerance,
    specificData: ["your budget constraints", "your risk tolerance"],
    genericData: ["typical maintenance costs", "battery replacement probability", "warranty coverage"],
    affects: ["financial planning", "emergency fund requirements", "total cost of ownership"],
    notAffects: ["immediate safety", "daily drivability"],
  }),
};

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function list(arr: string[]) {
  if (!arr?.length) return "unknown inputs";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
}
