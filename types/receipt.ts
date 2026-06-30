/**
 * OFFO Listing Receipt — Type Definitions
 *
 * The main Receipt type is inferred from the Zod schema.
 * Non-AI types (request, response, history) stay hand-written.
 */

export type { Receipt as ListingReceipt } from "@/lib/receipt-schema-validator";
export type { LintError } from "@/lib/receipt-schema-validator";
export type { RedditDraft } from "@/lib/receipt-schema-validator";
export type { VehicleCategory, VehicleClassification } from "@/lib/vehicle-classifier";
export type { ListingSignalId, ScoringCategory } from "@/lib/receipt-rules";
export type { EvidenceLabel, ScoringReason, ReceiptScoringResult } from "@/lib/receipt-scoring";
import type { Receipt } from "@/lib/receipt-schema-validator";

// --- Derived sub-types from Zod schema ---

export type ReceiptDetails = NonNullable<Receipt["receipt_details"]>;
export type OperatorNotes = Receipt["operator_notes"];
export type ListingSummary = Receipt["listing_summary"];
export type PriceSanity = Receipt["price_sanity"];
export type CompareSection = NonNullable<Receipt["compare"]>;

// --- Enums / Unions (still used by non-AI code) ---

export type ReceiptMode = "single" | "compare";
export type Verdict = "GREEN" | "YELLOW" | "RED";
export type PriceSanityLabel = "UNDERPRICED" | "FAIR" | "OVERPRICED" | "UNKNOWN";

// --- Structured Listing Fields (shared between input card & API) ---

export interface StructuredListingFields {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
  price?: number;
  vin?: string;
  location?: string;
  seller_type?: "dealer" | "private" | "unknown";
  title_status?: "clean" | "salvage" | "rebuilt" | "unknown";
  accidents_reported?: "yes" | "no" | "unknown";
  service_history?: "yes" | "no" | "unknown";
  owners?: number;
  carfax_available?: "yes" | "no" | "unknown";
  financing_vs_cash?: "financing" | "cash" | "unknown";
  country?: "US" | "UK" | "CA" | "AU" | "OTHER";
  zip_or_postcode?: string;
  market_price_range?: { low: number; high: number; count: number };
  auto_dev_specs?: {
    engine?: string;
    mpg_city?: string;
    mpg_highway?: string;
    drive_type?: string;
    fuel_type?: string;
    body_style?: string;
    doors?: number;
    msrp?: number;
  };
}

// --- VehicleFacts (canonical input object with provenance tracking) ---

export type FieldSource = "user" | "extracted" | "vin" | "unknown";

export interface VehicleFacts extends StructuredListingFields {
  listing_url?: string;
  listing_text?: string;
  listing_source?: string; // "autotrader", "cargurus", "text_paste", "manual"
  confidence_fields: Partial<Record<keyof StructuredListingFields, FieldSource>>;
}

// --- Progressive Generation Status ---

export type GenerationStatus = "lite" | "generating" | "full" | "failed";

// --- API Request / Response ---

export interface ReceiptGenerateRequest {
  // Input sources (at least one required)
  listing_url?: string | null;
  listing_text?: string | null;
  // Pre-parsed fields (from fetch endpoint or manual entry)
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
  price?: number;
  vin?: string;
  location?: string;
  // Extended structured fields
  seller_type?: "dealer" | "private" | "unknown";
  title_status?: "clean" | "salvage" | "rebuilt" | "unknown";
  accidents_reported?: "yes" | "no" | "unknown";
  service_history?: "yes" | "no" | "unknown";
  owners?: number;
  carfax_available?: "yes" | "no" | "unknown";
  financing_vs_cash?: "financing" | "cash" | "unknown";
  country?: "US" | "UK" | "CA" | "AU" | "OTHER";
  zip_or_postcode?: string;
  // Identity
  receipt_token: string;
  session_id?: string;
  extraction_id?: string;
  // Region
  region?: "US" | "UK";
  // Mode
  mode?: ReceiptMode;
  // Compare listing B (Pro only)
  listing_b_url?: string;
  listing_b_text?: string;
  // Optional routine context — when present, backend computes routine fit
  routine_context?: import("@/types/v2").MinimumViableRoutine;
  // Market context from Auto.dev enrichment (passed through from fetch endpoint)
  market_price_range?: { low: number; high: number; count: number };
  auto_dev_specs?: {
    engine?: string;
    mpg_city?: string;
    mpg_highway?: string;
    drive?: string;
    body_style?: string;
    msrp?: number;
    used_tmv?: number;
  };
}

export interface ReceiptGenerateResponse {
  success: true;
  receipt: import("@/lib/receipt-schema-validator").Receipt;
  receipt_id: string;
  generation_status: GenerationStatus;
  lint_passed: boolean;
  lint_errors: string[];
  lint_error_codes: import("@/lib/receipt-schema-validator").LintError[];
  remaining_free: number;
  vehicle_category?: import("@/lib/vehicle-classifier").VehicleCategory;
  // Routine fit — present when routine_context was provided in the request
  routine_context_used?: boolean;
  routine_fit_label?: string;
  routine_fit_score?: number;
  routine_fit_summary?: string;
}

export interface ReceiptGenerateError {
  success: false;
  error: string;
  lint_errors?: string[];
  lint_error_codes?: import("@/lib/receipt-schema-validator").LintError[];
  remaining_free?: number;
  resetAt?: string;
}

// --- Fetched Fields (from URL extraction) ---

export interface FetchedListingFields {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
  price?: number;
  vin?: string;
  location?: string;
  url_domain?: string;
  title_status?: "clean" | "salvage" | "rebuilt" | "unknown";
  accidents_reported?: "yes" | "no" | "unknown";
  /** EV-specific specs extracted from listing page or text */
  range_mi?: number;
  battery_kwh?: number;
  dc_fast_kw?: number;
  efficiency_mi_per_kwh?: number;
  /** Photo URLs from Auto.dev market listings */
  photo_urls?: string[];
  /** Market price range from Auto.dev listings */
  market_price_range?: { low: number; high: number; count: number };
  /** VIN-decoded specs from Auto.dev */
  auto_dev_specs?: {
    engine?: string;
    mpg_city?: string;
    mpg_highway?: string;
    drive?: string;
    body_style?: string;
    msrp?: number;
    used_tmv?: number;
  };
  /** NHTSA recall data — fetched free on every receipt */
  recalls?: {
    recall_count: number;
    park_it: boolean;
    park_outside: boolean;
    recalls: Array<{
      campaign_number: string;
      component: string;
      summary: string;
      consequence: string;
      remedy: string;
      report_date: string;
      park_it: boolean;
      park_outside: boolean;
      over_the_air_update: boolean;
    }>;
  };
  /** VIN history — only present on paid receipts */
  vin_history?: {
    provider: string;
    title_status: "clean" | "salvage" | "rebuilt" | "unknown";
    accident_count: number;
    theft_reported: boolean;
    salvage_reported: boolean;
    ownership_count: number | null;
    open_lien: boolean | null;
  };
}

// --- Extraction Confidence ---

export type FieldConfidence = "extracted" | "inferred" | "missing";
export type FieldConfidenceMap = Partial<Record<keyof FetchedListingFields, FieldConfidence>>;

// --- Deep Dive Content (Decision Pack paid upgrade) ---

export interface DeepDiveMarketComp {
  title: string;
  price: number;
  mileage: number;
  source: string;
  delta_pct: number;
  source_url?: string;
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

export interface DeepDiveContent {
  market_comparison: DeepDiveMarketComp[];
  extended_inspection: string[];
  negotiation_scripts: DeepDiveNegotiationScript[];
  cost_of_ownership: DeepDiveCostOfOwnership;
  model_known_issues: string[];
  verdict_deep: string;
}

// --- Share Snapshot (public-safe subset for QR share pages) ---

export interface ShareSnapshot {
  verdict: Verdict;
  verdict_reason: string;
  risk_flags: string[];
  must_answer_questions: string[];
  price_sanity_label: PriceSanityLabel;
  listing_summary: {
    year: number | null;
    make: string | null;
    model: string | null;
    price: number | null;
    mileage: number | null;
    seller_type: string | null;
  };
  timestamp: string;
}

// --- History Entry ---

export interface ReceiptHistoryEntry {
  receipt_id: string;
  created_at: string; // ISO
  verdict: Verdict;
  evidence_label?: "STRONG" | "PARTIAL" | "MISSING";
  fit_score?: number;
  year: number | null;
  make: string | null;
  model: string | null;
  price: number | null;
  receipt: import("@/lib/receipt-schema-validator").Receipt;
}
