/**
 * Voice Patterns & Messaging Framework
 *
 * Purpose: Transform from "reporting data" to "supporting decisions"
 * Key Shift: "Here's what we know" → "Here's what it means and what to do"
 *
 * Original voice: Clinical, detached, scientific
 * New voice: Calm expert explaining, advisor guiding
 */

/**
 * PATTERN 1: Confidence Explanation Framework
 *
 * Structure: [Label] + [Practical meaning] + [Based on] + [What's missing] + [How it affects decision]
 */
export interface ConfidenceExplanation {
  label: string; // "Medium", "High", "Low"
  practicalMeaning: string; // What this means for you
  basedOn: string; // What we used to calculate
  whatsMissing: string; // What would improve confidence
  decisionImpact: string; // How this affects your decision
}

export function formatConfidenceExplanation(exp: ConfidenceExplanation): string {
  return `Confidence: ${exp.label}

${exp.practicalMeaning}

${exp.basedOn}

${exp.whatsMissing}

${exp.decisionImpact}`;
}

/**
 * PATTERN 2: Personalization Value Formula
 *
 * Structure: "Share [data] → We'll [analysis] → which adjusts [outcome] by [range]"
 */
export interface PersonalizationValue {
  dataPoint: string; // "your annual mileage"
  analysis: string; // "distinguish between highway and city wear"
  outcome: string; // "replacement timing"
  quantifiedRange: string; // "±2 years"
}

export function formatPersonalizationValue(pv: PersonalizationValue): string {
  return `Share ${pv.dataPoint} → We'll ${pv.analysis} → which adjusts ${pv.outcome} by ${pv.quantifiedRange}`;
}

/**
 * PATTERN 3: Urgency Calibration Scale
 *
 * Not "urgent" or "critical" - but calibrated to decision impact
 */
export type UrgencyLevel =
  | "before-purchase" // Affects transaction
  | "safety-related" // Should be addressed before daily use
  | "time-sensitive" // May affect consequence within timeline
  | "low-priority"; // Can be deferred

export interface CalibratedUrgency {
  level: UrgencyLevel;
  action: string; // What to do
  timeline: string; // When/how long
  consequence: string; // Why it matters
}

export function formatUrgency(urgency: CalibratedUrgency): string {
  const labels = {
    "before-purchase": "Requires attention before purchase",
    "safety-related": "Should be addressed before daily use",
    "time-sensitive": "Time-sensitive action needed",
    "low-priority": "For future consideration",
  };

  return `${labels[urgency.level]}

${urgency.action}

Timeline: ${urgency.timeline}

Why this matters: ${urgency.consequence}`;
}

/**
 * PATTERN 4: Metric Communication Framework
 *
 * Structure: [Metric] + [Practical meaning] + [Confidence with explanation] + [Action with quantified value]
 */
export interface MetricCommunication {
  metric: string; // "Battery degradation"
  estimate: string; // "12–13%"
  practicalMeaning: string; // "230 miles of typical range"
  confidence: ConfidenceExplanation;
  action?: PersonalizationValue;
}

export function formatMetric(metric: MetricCommunication): string {
  let output = `${metric.metric}
${metric.estimate}

What this means for you:
${metric.practicalMeaning}

${formatConfidenceExplanation(metric.confidence)}`;

  if (metric.action) {
    output += `\n\nTo improve this estimate:
${formatPersonalizationValue(metric.action)}`;
  }

  return output;
}

/**
 * Voice Transformation Helpers
 */

/**
 * Convert precise percentage to range (humanizes uncertainty)
 *
 * Before: "12.4% degradation"
 * After: "about 12–13% capacity loss"
 */
export function percentageToRange(value: number, rangePlusMinus: number = 1): string {
  const lower = Math.floor(value - rangePlusMinus);
  const upper = Math.ceil(value + rangePlusMinus);
  return `about ${lower}–${upper}%`;
}

/**
 * Convert technical term to practical impact
 *
 * Before: "Battery degradation"
 * After: "battery capacity loss"
 */
export const termToPractical: Record<string, string> = {
  "battery degradation": "battery capacity loss",
  "SOH": "remaining battery health",
  "DC fast charging": "high-speed charging",
  "range anxiety": "concern about running out of charge",
  "thermal management": "battery temperature control",
  "regenerative braking": "energy recovery when slowing down",
};

/**
 * Convert percentage to practical range impact
 *
 * @param degradationPercent - Battery degradation (0-100)
 * @param originalRange - Original vehicle range in miles
 * @returns Practical range description
 */
export function degradationToRange(
  degradationPercent: number,
  originalRange: number = 263 // Default: Model 3 Standard Range
): string {
  const remainingRange = Math.round(originalRange * (1 - degradationPercent / 100));

  if (remainingRange >= 250) {
    return `approximately ${remainingRange} miles of typical range — still sufficient for most weekly needs`;
  } else if (remainingRange >= 200) {
    return `approximately ${remainingRange} miles of typical range — adequate for daily use, but planning may be needed for longer trips`;
  } else if (remainingRange >= 150) {
    return `approximately ${remainingRange} miles of typical range — suitable for local driving with charging every 2–3 days`;
  } else {
    return `approximately ${remainingRange} miles of typical range — limited to short trips with daily charging`;
  }
}

/**
 * Calibrate confidence labels
 *
 * Before: "Medium"
 * After: "Medium - Our estimate is based on..."
 */
export function calibrateConfidenceLabel(
  level: "high" | "medium" | "low",
  basedOn: string,
  missing: string
): string {
  const labels = {
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  return `Confidence: ${labels[level]}
Our estimate is based on ${basedOn}. ${missing}`;
}

/**
 * Add "why this matters" context
 *
 * Converts clinical finding to decision support
 */
export function addWhyThisMatters(finding: string, impact: string): string {
  return `${finding}

Why this matters:
${impact}`;
}

/**
 * Convert alarm to calibrated guidance
 *
 * Before: "URGENT: Critical issue detected"
 * After: "Requires attention before purchase: [context]"
 */
export function calibrateAlarm(
  issue: string,
  context: string,
  urgency: UrgencyLevel
): string {
  const prefix = {
    "before-purchase": "Requires attention before purchase",
    "safety-related": "Safety-related issue",
    "time-sensitive": "Time-sensitive",
    "low-priority": "For future consideration",
  };

  return `${prefix[urgency]}: ${issue}

${context}`;
}

/**
 * Reusable messaging templates
 */
export const templates = {
  batteryHealth: (degradation: number, originalRange: number) => ({
    metric: "Battery Health & Longevity",
    estimate: `Based on this model's age and average use, we estimate ${percentageToRange(
      degradation
    )} battery capacity loss compared to new.`,
    practicalMeaning: degradationToRange(degradation, originalRange),
    confidence: {
      label: "Medium",
      practicalMeaning:
        "This range is typical for vehicles of this age with standard use.",
      basedOn:
        "Our estimate is based on similar vehicles, not this specific car's history.",
      whatsMissing:
        "Adding your actual annual mileage would adjust the projection by up to ±2 years for replacement timing.",
      decisionImpact:
        "This affects whether you should budget for battery replacement in the next 3–5 years.",
    },
    action: {
      dataPoint: "your annual mileage",
      analysis:
        "distinguish between highway (gentler) and city (more taxing) wear patterns",
      outcome: "replacement timing",
      quantifiedRange: "±2 years",
    },
  }),

  recall: (
    recallCount: number,
    criticalDescription: string,
    typicalTimeline: string
  ) => ({
    issue: `${recallCount} recalls require attention before purchase`,
    context: `The primary recall addresses ${criticalDescription}. This is a safety-related fix that dealers are prioritizing.`,
    action: `Confirm with the seller that repairs have been completed. If not, factor in that this typically requires one dealer visit and may take ${typicalTimeline} to schedule.`,
    consequence:
      "Unresolved recalls can delay registration and affect financing approval.",
    urgency: "before-purchase" as UrgencyLevel,
  }),

  personalizationPrompt: (dataPoint: string, benefit: string) => ({
    dataPoint,
    analysis: benefit,
    outcome: "your personalized risk assessment",
    quantifiedRange: "10–15% more accurate",
  }),
};
