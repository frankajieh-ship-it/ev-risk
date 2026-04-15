/**
 * Shared types for PDF rendering
 *
 * These types define the contract between the Next.js PDF route
 * and the Netlify render-pdf function. No @react-pdf imports here.
 */

// ---- V2 types (inlined from types/v2.ts to avoid path alias issues) ----

export interface StressFlag {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
  routine_citation: string;
}

export interface BreakPoint {
  id: string;
  title: string;
  break_point: string;
  trigger: string;
  evidence: Array<{ label: string; value: string }>;
  impact: "Low" | "Medium" | "High";
  fallback_plan_b: {
    anchor: string;
    backup: string;
    buffer_rule: string;
  };
}

export interface RoutineFitConfidence {
  level: "high" | "medium" | "low";
  note: string;
  has_vehicle_data: boolean;
  has_battery_data: boolean;
}

export interface RoutineFitScore {
  score_0_100: number;
  label: "Great Fit" | "Good Fit" | "Mixed Fit" | "High Friction";
  mental_load: "low" | "medium" | "high";
  stress_flags: StressFlag[];
  breakpoints_ranked: BreakPoint[];
  confidence: RoutineFitConfidence;
}

export interface OwnershipRiskModule {
  module_id: "battery" | "recall" | "platform" | "warranty";
  status: "green" | "yellow" | "red" | "unknown";
  label: string;
  summary: string;
  detail?: string;
  data_available: boolean;
}

export interface OwnershipRiskFlags {
  overall_risk_label: "Low ownership friction" | "Moderate ownership friction" | "High ownership friction" | "Insufficient data";
  modules: OwnershipRiskModule[];
}

export interface MinimumViableRoutine {
  charging_access: "home" | "work" | "public";
  weekly_miles?: number;
  commute_miles_roundtrip?: number;
  climate: "winter" | "mild" | "hot";
  longest_day_pattern: "once_a_week" | "monthly_trip" | "rare_road_trip";
  region?: "US" | "UK";
}

// ---- V1 Report Payload ----

export interface ReportPayload {
  reportId: string;
  level: "green" | "yellow" | "red";
  score: number;
  summaryVerdict: string;
  batteryRiskExplanation: string[];
  platformRecallRisk: string[];
  ownershipFit: string[];
  dealerQuestions: string[];
  walkAwayTriggers: string[];
  vehicleYear?: number;
  vehicleModel?: string;
  routineFit?: {
    verdict: "good-fit" | "conditional-fit" | "high-friction";
    condition?: string;
    mental_load: "low" | "medium" | "high";
    reasons: Array<{
      text: string;
      type: "positive" | "neutral" | "negative";
    }>;
    confidence_current: number;
    confidence_with_battery_data: number;
    missing_data: string[];
  };
}

// ---- V2 Report PDF Data ----

export interface ReportPdfV2Data {
  reportId?: string;
  routineFit: RoutineFitScore;
  ownershipRisk: OwnershipRiskFlags;
  vehicle?: { make: string; model: string; year: number; mileage?: number };
  routine: MinimumViableRoutine;
  dealerQuestions: {
    top_3: string[];
    full_list: string[];
    walk_away_triggers: string[];
  };
  generatedAt?: string;
  confidencePair?: {
    routine_confidence_pct: number;
    routine_confidence_label: string;
    ownership_confidence_pct: number;
    ownership_confidence_label: string;
  };
}

// ---- Receipt PDF Data ----

export interface ReceiptPdfListingSummary {
  year: number;
  make: string;
  model: string;
  trim: string | null;
  price: number;
  currency: string;
  mileage: number;
  mileageUnit: string;
  sellerType: string;
  location: string;
}

export interface ReceiptPdfPriceSanity {
  label: string;
  confidence: number;
  rationale: string;
}

export interface ReceiptPdfDetails {
  feeEstimates: {
    notes?: string;
    taxEstimateRange?: { low: number; high: number } | null;
    docFeeEstimateRange?: { low: number; high: number } | null;
  } | null;
  commonListingTricks: string[];
  walkAwayTriggers: string[];
}

export interface DeepDiveMarketComp {
  title: string;
  price: number;
  mileage: number;
  source: string;
  delta_pct: number;
}

export interface DeepDiveNegotiationScript {
  scenario: string;
  opening: string;
  body: string;
}

export interface DeepDiveCostOfOwnership {
  insurance_yr: number;
  maintenance_yr: number;
  fuel_or_charging_yr: number;
  depreciation_yr: number;
  total_3yr: number;
}

export interface DeepDiveContentPdf {
  market_comparison: DeepDiveMarketComp[];
  extended_inspection: string[];
  negotiation_scripts: DeepDiveNegotiationScript[];
  cost_of_ownership: DeepDiveCostOfOwnership;
  model_known_issues: string[];
  verdict_deep: string;
}

export interface ReceiptPdfData {
  receiptId: string;
  verdict: "GREEN" | "YELLOW" | "RED";
  verdictReason: string;
  priceSanity: ReceiptPdfPriceSanity | null;
  riskFlags: string[];
  mustAnswerQuestions: string[];
  inspectFirst: string[];
  negotiationOpener: string;
  listingSummary: ReceiptPdfListingSummary;
  receiptDetails: ReceiptPdfDetails | null;
  deepDive: DeepDiveContentPdf | null;
  shareUrl?: string;
  shareQrDataUri?: string;
  generatedAt: string;
}

// ---- Sellers Report PDF Data ----

export interface SellersReportVehicleSummary {
  year: number;
  make: string;
  model: string;
  trim: string | null;
  vin_redacted: string | null;
  range_mi: number | null;
}

export interface SellersReportRecallSnapshot {
  open_count: number;
  resolved_count: number;
  summary: string;
}

export interface SellersReportBuyerAnswer {
  question: string;
  answer: string;
}

export interface SellersReportPdfData {
  vehicle_summary: SellersReportVehicleSummary;
  routine_fit_highlights: string[];
  recall_snapshot: SellersReportRecallSnapshot;
  buyer_ready_answers: SellersReportBuyerAnswer[];
  verification_token: string;
  generated_at: string;
}

// ---- Render function request contract ----

export interface RenderPdfRequest {
  version: "v1" | "v2" | "receipt" | "sellers_report";
  v1Data?: ReportPayload;
  v2Data?: ReportPdfV2Data;
  receiptData?: ReceiptPdfData;
  sellersReportData?: SellersReportPdfData;
}
