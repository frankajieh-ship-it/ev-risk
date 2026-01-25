/**
 * Presentation Transformer
 *
 * Transforms raw BuyConfidence data into separated web/PDF presentations.
 * Enforces limits programmatically to prevent content creep.
 */

import type {
  PresentationData,
  WebPresentation,
  PdfPresentation,
  FitSignal,
  MentalLoadLabel,
  ConfidenceLevel,
} from "@/types/presentation";
import type {
  SeasonalSensitivity,
  SeasonalTriggerTag,
  PredictabilityLevel,
  PlanningTolerance,
  ChargingAnchorType,
  BackupOption,
} from "@/types";

// Input types (matching report page)
interface BuyConfidence {
  overall_score: number;
  fit_signal: FitSignal;
  one_sentence_verdict: string;
  becomes_annoying_if: string;
  what_breaks_first: string[];
  confidence: ConfidenceLevel;
  confidence_note: string;
  confidence_why: string[];
  top_drivers: Array<{ label: string; impact: "HIGH" | "MEDIUM" | "LOW" }>;
  plan_b: string[];
  battery_risk: {
    degradation_percent: number;
    estimated_replacement_cost: number;
    chemistry: string;
    details: string;
  };
  platform_risk: {
    critical_recalls: number;
    total_recalls: number;
    reliability_score: number;
  };
  history_routine_signals?: Array<{
    type: "friction" | "buffer" | "low-stress";
    headline: string;
    explanation: string;
    impact: "HIGH" | "MEDIUM" | "LOW";
  }>;
  confidence_drivers?: Array<{
    category: "data-completeness" | "history-clarity" | "routine-predictability";
    strength: "high" | "medium" | "low";
    reason: string;
  }>;
}

interface RoutineFitAssessment {
  mental_load: "low" | "medium" | "high";
  confidence_current: number;
  confidence_with_battery_data: number;
  missing_data: string[];
  // P0/P1: New seasonal & predictability fields
  seasonal_sensitivity?: SeasonalSensitivity;
  seasonal_trigger_tags?: SeasonalTriggerTag[];
  predictability_level?: PredictabilityLevel;
  planning_tolerance?: PlanningTolerance;
  charging_anchor_type?: ChargingAnchorType;
  backup_option?: BackupOption;
}

// Mental load label mapping
const MENTAL_LOAD_LABELS: Record<"low" | "medium" | "high", MentalLoadLabel> = {
  low: "Low mental overhead",
  medium: "Ongoing planning required",
  high: "Frequent attention required",
};

const MENTAL_LOAD_DESCRIPTIONS: Record<"low" | "medium" | "high", string> = {
  low: "Charging becomes automatic, like plugging in your phone at night.",
  medium:
    "You'll need to think about charging regularly, but it's manageable with a routine.",
  high: "Charging will be a regular mental task — 'Where can I charge?' becomes recurring.",
};

const MENTAL_LOAD_WHY: Record<"low" | "medium" | "high", string> = {
  low: "Low friction ownership means the EV fades into the background of your life.",
  medium:
    "Medium friction means you'll adapt, but charging stays on your radar.",
  high: "High friction risks becoming annoying over time, especially on busy weeks.",
};

/**
 * P0: Enforce verdict constraints - max 1 sentence, no complex conditionals
 */
function enforceVerdictConstraints(verdict: string): string {
  // Split by sentence-ending punctuation
  const sentences = verdict.split(/[.!?]+/).filter(Boolean);
  if (sentences.length > 1) {
    console.warn("Verdict exceeded 1 sentence, truncating");
    return sentences[0].trim() + ".";
  }
  return verdict;
}

/**
 * Transform BuyConfidence into presentation tiers
 */
export function transformToPresentation(
  confidence: BuyConfidence,
  sessionId: string | null,
  routineFit?: RoutineFitAssessment
): PresentationData {
  const mentalLoad = routineFit?.mental_load || inferMentalLoad(confidence);

  return {
    web: buildWebPresentation(confidence, sessionId, mentalLoad, routineFit),
    pdf: buildPdfPresentation(confidence, mentalLoad, routineFit),
  };
}

function buildWebPresentation(
  confidence: BuyConfidence,
  sessionId: string | null,
  mentalLoad: "low" | "medium" | "high",
  routineFit?: RoutineFitAssessment
): WebPresentation {
  // Block 1: Fit Verdict
  const fitSignal = confidence.fit_signal;
  const oneSentenceVerdict = enforceVerdictConstraints(confidence.one_sentence_verdict);
  const mentalLoadLabel = MENTAL_LOAD_LABELS[mentalLoad];

  // Block 2: What Breaks First - LIMIT TO 2 (P0: Decision Card constraint)
  const whatBreaksFirst = confidence.what_breaks_first.slice(0, 2);

  // Block 3: Top Drivers - LIMIT TO 2, NO BADGES (labels only)
  const topDrivers = confidence.top_drivers.slice(0, 2).map((d) => d.label);

  // Block 4: Plan B - CONDITIONAL (only if not Good Fit), LIMIT TO 4
  const showPlanB = fitSignal !== "Good Fit";
  const planB = showPlanB ? confidence.plan_b.slice(0, 4) : [];

  // Block 5: Confidence - SINGLE SENTENCE
  const confidenceLevel = confidence.confidence;
  const confidenceSummary = generateConfidenceSentence(confidence);

  // Assertions for limit enforcement (P0: Decision Card constraints)
  if (confidence.what_breaks_first.length > 2) {
    console.warn("whatBreaksFirst exceeded limit of 2, truncating");
  }
  if (topDrivers.length > 2) {
    console.warn("topDrivers exceeded limit of 2, truncating");
  }
  if (planB.length > 4) {
    console.warn("planB exceeded limit of 4, truncating");
  }

  // P0/P1: Seasonal, Predictability, and Planning Tolerance bullets
  const seasonalSensitivity = routineFit?.seasonal_sensitivity;
  const predictabilityLevel = routineFit?.predictability_level;
  const planningTolerance = routineFit?.planning_tolerance;

  // Seasonal bullet (only if MEDIUM/HIGH)
  let seasonalBullet: string | undefined;
  if (seasonalSensitivity && seasonalSensitivity !== "LOW") {
    seasonalBullet = "This setup is stable most of the year, but winter months are where planning tends to resurface.";
  }

  // Predictability one-liner (only if LOW)
  let predictabilityOneLiner: string | undefined;
  if (predictabilityLevel === "LOW") {
    predictabilityOneLiner = "Your setup is limited mainly by predictability (reliable anchors + backups), not charger count.";
  }

  // Planning tolerance bullet (only if LOW + conditional/high friction)
  let planningToleranceBullet: string | undefined;
  if (planningTolerance === "LOW" && fitSignal !== "Good Fit") {
    planningToleranceBullet = "This setup works, but it asks you to plan a bit more often than many people enjoy.";
  }

  // P0: Stability bullet for low-friction setups (Good Fit with high predictability)
  let stabilityBullet: string | undefined;
  if (
    fitSignal === "Good Fit" &&
    predictabilityLevel === "HIGH" &&
    routineFit?.charging_anchor_type === "HOME"
  ) {
    stabilityBullet = "Because you have reliable home charging and a flexible schedule, most EV friction fades into the background.";
  }

  return {
    fitSignal,
    oneSentenceVerdict,
    mentalLoadLabel,
    whatBreaksFirst,
    topDrivers,
    showPlanB,
    planB,
    confidenceLevel,
    confidenceSummary,
    sessionId,
    // P0/P1: New fields
    seasonalSensitivity,
    seasonalBullet,
    predictabilityLevel,
    predictabilityOneLiner,
    planningTolerance,
    planningToleranceBullet,
    // P0: Stability bullet for low-friction setups
    stabilityBullet,
  };
}

function buildPdfPresentation(
  confidence: BuyConfidence,
  mentalLoad: "low" | "medium" | "high",
  routineFit?: RoutineFitAssessment
): PdfPresentation {
  // Section 1: Executive Summary
  const fitSignal = confidence.fit_signal;
  const oneSentenceVerdict = confidence.one_sentence_verdict;
  const mentalLoadLabel = MENTAL_LOAD_LABELS[mentalLoad];

  // Section 2: Mental Load & Routine Impact
  const mentalLoadDetails = {
    level: mentalLoad,
    label: MENTAL_LOAD_LABELS[mentalLoad],
    description: MENTAL_LOAD_DESCRIPTIONS[mentalLoad],
    whyItMatters: MENTAL_LOAD_WHY[mentalLoad],
    practicalImplications: generatePracticalImplications(mentalLoad, confidence),
  };

  // Section 3: What Breaks First (expanded with explanations)
  const whatBreaksFirstExpanded = confidence.what_breaks_first.map((item) => ({
    item,
    explanation: generateBreakExplanation(item, confidence),
    timeline: undefined, // Could be enhanced later
  }));

  // Section 4: History x Routine Interaction
  const historyRoutineSignals = confidence.history_routine_signals || [];

  // Section 5: Confidence Breakdown
  const confidenceBreakdown = buildConfidenceBreakdown(confidence);

  // Section 6: Missing Data
  const missingData = buildMissingData(routineFit);
  const currentConfidence = routineFit?.confidence_current || confidence.overall_score;
  const confidenceWithBatteryData =
    routineFit?.confidence_with_battery_data ||
    Math.min(currentConfidence + 22, 95);

  // Section 7: Cost/Battery/Degradation
  const numericScore = confidence.overall_score;
  const batteryDetails = {
    chemistry: confidence.battery_risk.chemistry,
    degradationPercent: confidence.battery_risk.degradation_percent,
    estimatedReplacementCost: confidence.battery_risk.estimated_replacement_cost,
    healthContext: confidence.battery_risk.details,
  };
  const platformDetails = {
    totalRecalls: confidence.platform_risk.total_recalls,
    criticalRecalls: confidence.platform_risk.critical_recalls,
    reliabilityScore: confidence.platform_risk.reliability_score,
  };

  // Section 8: Appendix
  const topDriversWithImpact = confidence.top_drivers;
  const fullPlanB = confidence.plan_b;
  const assumptions = [
    "Battery degradation estimates based on typical usage patterns",
    "Charging infrastructure data current as of report generation",
    "Cost projections assume current market conditions",
  ];
  const disclaimers = [
    "This report is for informational purposes only",
    "Not a recommendation to buy or avoid any vehicle",
    "Individual results may vary based on actual usage",
  ];
  const dataSources = [
    "NHTSA recall database",
    "EPA range estimates",
    "Industry degradation studies",
  ];

  // P0/P1: Seasonal Friction Section (only if not LOW)
  const seasonalFriction = buildSeasonalFriction(routineFit);

  // P0/P1: Predictability Analysis Section
  const predictabilityAnalysis = buildPredictabilityAnalysis(routineFit);

  return {
    fitSignal,
    oneSentenceVerdict,
    mentalLoadLevel: mentalLoad,
    mentalLoadLabel,
    mentalLoadDetails,
    whatBreaksFirstExpanded,
    historyRoutineSignals,
    confidenceBreakdown,
    missingData,
    currentConfidence,
    confidenceWithBatteryData,
    numericScore,
    batteryDetails,
    platformDetails,
    topDriversWithImpact,
    fullPlanB,
    assumptions,
    disclaimers,
    dataSources,
    // P0/P1: New sections
    seasonalFriction,
    predictabilityAnalysis,
  };
}

function generateConfidenceSentence(confidence: BuyConfidence): string {
  const primary = confidence.confidence_why[0] || "";
  const level = confidence.confidence.toLowerCase();

  if (confidence.confidence === "High") {
    return `High confidence based on complete vehicle data and predictable routine.`;
  } else if (confidence.confidence === "Medium") {
    if (primary) {
      return `Medium confidence — ${primary.toLowerCase().replace(/\.$/, "")}.`;
    }
    return `Medium confidence — some data points would improve accuracy.`;
  } else {
    if (primary) {
      return `Low confidence due to ${primary.toLowerCase().replace(/\.$/, "")}.`;
    }
    return `Low confidence — key data points are missing.`;
  }
}

function inferMentalLoad(
  confidence: BuyConfidence
): "low" | "medium" | "high" {
  // Infer from history_routine_signals if available
  if (confidence.history_routine_signals) {
    const frictionSignals = confidence.history_routine_signals.filter(
      (s) => s.type === "friction"
    );
    const highImpact = frictionSignals.filter((s) => s.impact === "HIGH");

    if (highImpact.length >= 2) return "high";
    if (frictionSignals.length >= 1) return "medium";
  }

  // Fallback: infer from fit signal
  if (
    confidence.fit_signal === "Good Fit" ||
    confidence.fit_signal === "Good Fit — with conditions"
  ) {
    return "low";
  }
  if (confidence.fit_signal === "Conditional Fit") {
    return "medium";
  }
  return "high";
}

function generatePracticalImplications(
  mentalLoad: "low" | "medium" | "high",
  confidence: BuyConfidence
): string[] {
  const implications: string[] = [];

  if (mentalLoad === "low") {
    implications.push("Plug in at home, forget about it");
    implications.push("Range anxiety unlikely to be a factor");
  } else if (mentalLoad === "medium") {
    implications.push("Build charging into your weekly routine");
    implications.push("Know your backup charging options");
    if (confidence.plan_b.length > 0) {
      implications.push(confidence.plan_b[0]);
    }
  } else {
    implications.push("Charging requires active planning");
    implications.push("Consider identifying 2-3 reliable charging spots");
    implications.push("Factor in extra time for charging on busy days");
  }

  return implications;
}

function generateBreakExplanation(
  item: string,
  confidence: BuyConfidence
): string {
  // Generate contextual explanation based on the break point
  const lowerItem = item.toLowerCase();

  if (lowerItem.includes("charging") || lowerItem.includes("charger")) {
    return "Charging predictability is the hidden factor in EV ownership satisfaction. When charging becomes unreliable, the mental overhead compounds.";
  }
  if (lowerItem.includes("battery") || lowerItem.includes("degradation")) {
    return "Battery health directly affects your usable range over time. Faster-than-expected degradation can shift your routine from comfortable to constrained.";
  }
  if (lowerItem.includes("range") || lowerItem.includes("winter")) {
    return "Real-world range varies significantly with conditions. Winter, speed, and climate control can reduce range by 20-40%.";
  }
  if (lowerItem.includes("queue") || lowerItem.includes("wait")) {
    return "Charger availability varies by time and location. Popular times can mean waiting, adding friction to what should be routine.";
  }

  return "This factor contributes to the overall friction profile of ownership.";
}

function buildConfidenceBreakdown(confidence: BuyConfidence): PdfPresentation["confidenceBreakdown"] {
  const drivers = confidence.confidence_drivers || [];

  const findDriver = (category: string) =>
    drivers.find((d) => d.category === category) || {
      strength: "medium" as const,
      reason: "Not enough data to assess",
    };

  return {
    overall: confidence.confidence,
    overallNote: confidence.confidence_note,
    dataCompleteness: {
      strength: findDriver("data-completeness").strength,
      reason: findDriver("data-completeness").reason,
    },
    historyClarity: {
      strength: findDriver("history-clarity").strength,
      reason: findDriver("history-clarity").reason,
    },
    routinePredictability: {
      strength: findDriver("routine-predictability").strength,
      reason: findDriver("routine-predictability").reason,
    },
  };
}

function buildMissingData(
  routineFit?: RoutineFitAssessment
): PdfPresentation["missingData"] {
  const standardMissing = [
    {
      field: "Battery State of Health (SOH)",
      importance: "critical" as const,
      whyItMatters:
        "SOH directly indicates usable range and remaining battery life",
      howToFind: "Request OBD-II scan or dealer battery report",
    },
    {
      field: "Actual degradation curve",
      importance: "critical" as const,
      whyItMatters: "Shows if battery is degrading faster than typical",
      howToFind: "Compare current SOH to expected for age/mileage",
    },
    {
      field: "Fast-charging frequency",
      importance: "helpful" as const,
      whyItMatters: "Frequent DC fast charging accelerates degradation",
      howToFind: "Ask seller about charging habits or check infotainment logs",
    },
    {
      field: "Battery temperature management history",
      importance: "helpful" as const,
      whyItMatters: "Thermal stress affects long-term battery health",
      howToFind: "Review if vehicle was in extreme climates",
    },
    {
      field: "Recall completion status",
      importance: "helpful" as const,
      whyItMatters: "Unresolved recalls may affect safety or functionality",
      howToFind: "Run VIN through NHTSA database",
    },
  ];

  return standardMissing;
}

/**
 * P0/P1: Build seasonal friction section for PDF
 * Only populated if seasonal_sensitivity is MEDIUM or HIGH
 */
function buildSeasonalFriction(
  routineFit?: RoutineFitAssessment
): PdfPresentation["seasonalFriction"] {
  const sensitivity = routineFit?.seasonal_sensitivity;
  const triggerTags = routineFit?.seasonal_trigger_tags || [];

  // Only include section if sensitivity is MEDIUM or HIGH
  if (!sensitivity || sensitivity === "LOW") {
    return undefined;
  }

  // Generate headline based on sensitivity
  const headline =
    sensitivity === "HIGH"
      ? "Winter will require active planning"
      : "Winter may require some additional attention";

  // Generate explanation based on trigger tags
  let explanation =
    "Cold weather affects EV range and charging behavior. ";
  if (triggerTags.includes("WINTER_BUFFER_COMPRESSION")) {
    explanation +=
      "Your reliance on public/shared charging means winter range loss hits harder — less buffer to absorb the 20-40% range reduction.";
  } else if (triggerTags.includes("COLD_RECOVERY_RISK")) {
    explanation +=
      "Without a reliable backup option, recovering from a missed charge in winter becomes more stressful — cold batteries charge slower.";
  } else {
    explanation +=
      "Plan for 20-40% range reduction on cold days, and expect charging to take longer when the battery is cold.";
  }

  // What changes in winter
  const whatChanges: string[] = [
    "Range drops 20-40% depending on temperature and heating use",
    "Cold batteries charge slower, especially at fast chargers",
    "Preconditioning (warming the battery before charging) becomes important",
  ];

  if (triggerTags.includes("WINTER_BUFFER_COMPRESSION")) {
    whatChanges.push(
      "Public charger availability may decrease as more EVs compete for charging"
    );
  }

  // Buffer guidance
  const bufferGuidance =
    sensitivity === "HIGH"
      ? "Keep battery above 30% more often in winter. Plan charging stops before you need them."
      : "Consider keeping slightly more buffer in winter months. Check charger availability before heading out.";

  return {
    sensitivity,
    triggerTags,
    headline,
    explanation,
    whatChanges,
    bufferGuidance,
  };
}

/**
 * P0/P1: Build predictability analysis section for PDF
 * Explains the relationship between charging anchors, backups, and routine predictability
 */
function buildPredictabilityAnalysis(
  routineFit?: RoutineFitAssessment
): PdfPresentation["predictabilityAnalysis"] {
  const level = routineFit?.predictability_level;
  const anchorType = routineFit?.charging_anchor_type;
  const backupOption = routineFit?.backup_option;

  // Skip if no predictability data
  if (!level) {
    return undefined;
  }

  // Generate explanation based on level
  let explanation: string;
  if (level === "HIGH") {
    explanation =
      "Your charging setup is highly predictable. Home charging with a reliable backup means you rarely need to think about where or when to charge.";
  } else if (level === "MEDIUM") {
    explanation =
      "Your charging setup requires some planning. Work or destination charging can be reliable, but it's not as automatic as home charging.";
  } else {
    explanation =
      "Your charging setup has lower predictability. Without a reliable anchor, you'll need to plan charging more actively and may encounter variability.";
  }

  // Add anchor-specific context
  if (anchorType === "WORK") {
    explanation +=
      " Workplace charging can change — policy shifts, increased demand, or job changes can disrupt your routine.";
  } else if (anchorType === "PUBLIC_ANCHOR") {
    explanation +=
      " Public charger availability varies by time and location. Having a backup plan is especially important.";
  }

  // Convert backup option to user-friendly status
  let backupStatus: string;
  switch (backupOption) {
    case "YES_RELIABLE":
      backupStatus = "Reliable backup available";
      break;
    case "MAYBE":
      backupStatus = "Backup sometimes available";
      break;
    case "NONE":
      backupStatus = "No backup option";
      break;
    default:
      backupStatus = "Backup status unknown";
  }

  return {
    level,
    anchorType,
    backupStatus,
    explanation,
  };
}
