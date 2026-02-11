/**
 * OFFO Listing Receipt — Type Definitions
 * Matches the v1 JSON schema exactly.
 */

// --- Enums / Unions ---

export type ReceiptMode = "single" | "compare";
export type Verdict = "GREEN" | "YELLOW" | "RED";
export type PriceSanityLabel = "UNDERPRICED" | "FAIR" | "OVERPRICED" | "UNKNOWN";
export type PriceBasis = "LISTING_ONLY" | "USER_MARKET_RANGE" | "UNKNOWN";
export type CompareWinner = "A" | "B" | "TIE";
export type SellerType = "dealer" | "private" | "unknown";
export type TitleStatus = "clean" | "salvage" | "rebuilt" | "unknown";
export type Country = "US" | "UK" | "CA" | "AU" | "OTHER";
export type MileageUnit = "mi" | "km" | "unknown";
export type YesNoUnknown = "yes" | "no" | "unknown";

// --- Sub-objects ---

export interface PriceRange {
  low: number;
  high: number;
}

export interface MarketRange {
  low: number;
  high: number;
  currency: string;
}

export interface PriceSanity {
  label: PriceSanityLabel;
  confidence: number; // 0-1
  basis: PriceBasis;
  rationale_short: string; // 4-180 chars
  user_market_range: MarketRange | null;
}

export interface FeeEstimates {
  currency: string;
  notes: string; // max 220 chars
  tax_estimate_range: PriceRange | null;
  doc_fee_estimate_range: PriceRange | null;
}

export interface ReceiptDetails {
  fee_estimates: FeeEstimates;
  common_listing_tricks: string[]; // 3-10 items, each 1-140 chars
  walk_away_triggers: string[]; // 3-10 items, each 1-140 chars
}

export interface ListingSummary {
  listing_url: string;
  url_domain: string;
  country: Country;
  zip_or_postcode: string;
  price: number;
  currency: string;
  mileage: number;
  mileage_unit: MileageUnit;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  seller_type: SellerType;
  title_status: TitleStatus;
  accidents_reported: YesNoUnknown;
  service_history: YesNoUnknown;
  owners: number | null;
  carfax_available: YesNoUnknown;
}

export interface CompareSection {
  winner: CompareWinner;
  why: [string, string]; // exactly 2
  tie_breaker_questions: string[]; // 0-2
  listing_b_summary: ListingSummary;
}

export interface OperatorNotes {
  rationale: string; // 10-500 chars
  assumptions: string[]; // 0-6
  what_would_change_verdict: string[]; // 0-4
}

// --- Main Receipt ---

export interface ListingReceipt {
  schema_version: "v1";
  receipt_id: string; // uuid
  created_at?: string; // ISO date-time
  mode: ReceiptMode;
  verdict: Verdict;
  verdict_reason: string; // 4-180 chars
  price_sanity: PriceSanity;
  risk_flags: [string, string, string]; // exactly 3, each 1-120 chars
  must_answer_questions: [string, string, string]; // exactly 3, each 1-140 chars
  inspect_first: [string, string, string, string, string]; // exactly 5, each 1-140 chars
  negotiation_opener: string; // 8-420 chars
  one_followup_question: string | null; // max 160
  receipt_reddit_text: string; // 40-1200 chars
  receipt_details: ReceiptDetails | null;
  compare: CompareSection | null;
  operator_notes: OperatorNotes;
  listing_summary: ListingSummary;
}

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
  // Identity
  receipt_token: string;
  session_id?: string;
  // Mode
  mode?: ReceiptMode;
  // Compare listing B (Pro only)
  listing_b_url?: string;
  listing_b_text?: string;
}

export interface ReceiptGenerateResponse {
  success: true;
  receipt: ListingReceipt;
  lint_passed: boolean;
  lint_errors: string[];
  remaining_free: number;
}

export interface ReceiptGenerateError {
  success: false;
  error: string;
  lint_errors?: string[];
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
}

// --- History Entry ---

export interface ReceiptHistoryEntry {
  receipt_id: string;
  created_at: string; // ISO
  verdict: Verdict;
  year: number | null;
  make: string | null;
  model: string | null;
  price: number | null;
  receipt: ListingReceipt;
}
