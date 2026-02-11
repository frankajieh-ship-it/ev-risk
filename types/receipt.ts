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
  // Mode
  mode?: ReceiptMode;
  // Compare listing B (Pro only)
  listing_b_url?: string;
  listing_b_text?: string;
}

export interface ReceiptGenerateResponse {
  success: true;
  receipt: import("@/lib/receipt-schema-validator").Receipt;
  lint_passed: boolean;
  lint_errors: string[];
  lint_error_codes: import("@/lib/receipt-schema-validator").LintError[];
  remaining_free: number;
  vehicle_category?: import("@/lib/vehicle-classifier").VehicleCategory;
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
}

// --- Extraction Confidence ---

export type FieldConfidence = "extracted" | "inferred" | "missing";
export type FieldConfidenceMap = Partial<Record<keyof FetchedListingFields, FieldConfidence>>;

// --- History Entry ---

export interface ReceiptHistoryEntry {
  receipt_id: string;
  created_at: string; // ISO
  verdict: Verdict;
  year: number | null;
  make: string | null;
  model: string | null;
  price: number | null;
  receipt: import("@/lib/receipt-schema-validator").Receipt;
}
