/**
 * Presentation Tier Types
 *
 * Separates web vs PDF content at the data layer.
 * Web = orientation ("how will this feel")
 * PDF = explanation ("why" in detail)
 */

import type {
  SeasonalSensitivity,
  SeasonalTriggerTag,
  PredictabilityLevel,
  PlanningTolerance,
  ChargingAnchorType,
  BackupOption,
} from "./index";

// Mental load labels for web display
export type MentalLoadLabel =
  | "Low mental overhead"
  | "Ongoing planning required"
  | "Frequent attention required";

// Fit signal types
export type FitSignal =
  | "Good Fit"
  | "Good Fit — with conditions"
  | "Conditional Fit"
  | "High Friction";

// Confidence levels
export type ConfidenceLevel = "High" | "Medium" | "Low";

/**
 * Web Presentation - Compressed 6-block view
 * Constraint: 1.5 screen heights max
 */
export interface WebPresentation {
  // Block 1: Fit Verdict
  fitSignal: FitSignal;
  oneSentenceVerdict: string;
  mentalLoadLabel: MentalLoadLabel;

  // Block 2: What Breaks First (MAX 2 - P0 Decision Card constraint)
  whatBreaksFirst: string[];

  // Block 3: Top Drivers (MAX 2, labels only)
  topDrivers: string[];

  // Block 4: Plan B (conditional, MAX 4)
  showPlanB: boolean;
  planB: string[];

  // Block 5: Confidence
  confidenceLevel: ConfidenceLevel;
  confidenceSummary: string;

  // Block 6: Decision Capture
  sessionId: string | null;

  // P0/P1: NEW - Conditional bullets (at most 1 of each)
  seasonalSensitivity?: SeasonalSensitivity;
  seasonalBullet?: string; // Only populated if MEDIUM/HIGH

  predictabilityLevel?: PredictabilityLevel;
  predictabilityOneLiner?: string; // Only populated if LOW

  planningTolerance?: PlanningTolerance;
  planningToleranceBullet?: string; // Only if LOW + conditional/high friction

  // P0: Stability bullet for low-friction setups
  stabilityBullet?: string; // Only if Good Fit with home + full control

  // P1: Your Situation - share-first Reddit-native paragraph
  yourSituationSummary?: string; // Always visible, copy-to-clipboard ready
}

/**
 * PDF Presentation - Full explanation
 * Contains all content removed from web
 */
export interface PdfPresentation {
  // Section 1: Executive Summary
  fitSignal: FitSignal;
  oneSentenceVerdict: string;
  mentalLoadLevel: "low" | "medium" | "high";
  mentalLoadLabel: MentalLoadLabel;

  // Section 2: Mental Load & Routine Impact (expanded)
  mentalLoadDetails: {
    level: "low" | "medium" | "high";
    label: string;
    description: string;
    whyItMatters: string;
    practicalImplications: string[];
  };

  // Section 3: What Breaks First (with explanations)
  whatBreaksFirstExpanded: Array<{
    item: string;
    explanation: string;
    timeline?: string;
  }>;

  // Section 4: History x Routine Interaction
  historyRoutineSignals: Array<{
    type: "friction" | "buffer" | "low-stress";
    headline: string;
    explanation: string;
    impact: "HIGH" | "MEDIUM" | "LOW";
  }>;

  // Section 5: Confidence Breakdown
  confidenceBreakdown: {
    overall: ConfidenceLevel;
    overallNote: string;
    dataCompleteness: { strength: "high" | "medium" | "low"; reason: string };
    historyClarity: { strength: "high" | "medium" | "low"; reason: string };
    routinePredictability: {
      strength: "high" | "medium" | "low";
      reason: string;
    };
  };

  // Section 6: Missing Data & What It Would Change
  missingData: Array<{
    field: string;
    importance: "critical" | "helpful" | "nice-to-have";
    whyItMatters: string;
    howToFind: string;
  }>;
  currentConfidence: number;
  confidenceWithBatteryData: number;

  // Section 7: Cost/Battery/Degradation
  numericScore: number;
  batteryDetails: {
    chemistry: string;
    degradationPercent: number;
    estimatedReplacementCost: number;
    healthContext: string;
  };
  platformDetails: {
    totalRecalls: number;
    criticalRecalls: number;
    reliabilityScore: number;
  };

  // Section 8: Appendix
  topDriversWithImpact: Array<{ label: string; impact: "HIGH" | "MEDIUM" | "LOW" }>;
  fullPlanB: string[];
  assumptions: string[];
  disclaimers: string[];
  dataSources: string[];

  // P0/P1: NEW - Section 9: Seasonal Friction (conditional)
  seasonalFriction?: {
    sensitivity: SeasonalSensitivity;
    triggerTags: SeasonalTriggerTag[];
    headline: string;
    explanation: string;
    whatChanges: string[];
    bufferGuidance: string;
  };

  // P0/P1: NEW - Section 10: Predictability Analysis
  predictabilityAnalysis?: {
    level: PredictabilityLevel;
    anchorType?: ChargingAnchorType;
    backupStatus: string;  // Human-readable status description
    explanation: string;
  };
}

/**
 * Combined presentation data
 */
export interface PresentationData {
  web: WebPresentation;
  pdf: PdfPresentation;
}
