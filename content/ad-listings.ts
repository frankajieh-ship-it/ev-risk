/**
 * Ad Landing Page — Hardcoded Listing Receipts
 *
 * Pre-analyzed receipt data for Reddit ad landing pages.
 * Each entry matches the ListingReceipt (Receipt) type exactly.
 */

import type { ListingReceipt } from "@/types/receipt";

// --- 2025 Kia EV6 Light Long Range AWD (GREEN verdict) ---

export const KIA_EV6_RECEIPT: ListingReceipt = {
  receipt_id: "ad-kia-ev6-2025-cargurus",
  schema_version: "v1",
  mode: "single",
  verdict: "GREEN",
  verdict_reason:
    "Low mileage, fair price for a 2025 EV6 LR AWD, and clean listing from a dealer. Key gaps remain around battery health and DC fast charging confirmation.",
  price_sanity: {
    label: "FAIR",
    confidence: 0.8,
    basis: "LISTING_ONLY",
    rationale_short:
      "Priced within expected range for a 2025 EV6 Light Long Range AWD with 3,213 miles based on current market listings.",
  },
  risk_flags: [
    "battery_proof_missing",
    "dcfc_unclear",
    "ownership_history_unclear",
  ],
  must_answer_questions: [
    "What is the current state of the battery health and SoH?",
    "Are there any service records available?",
    "What is the warranty status on the battery?",
  ],
  inspect_first: [
    "Request a battery health report or diagnostic from a Kia dealer",
    "Verify DC fast charging port type and functionality",
    "Check for any open recalls on the 2025 EV6",
    "Inspect tire condition and remaining tread depth",
    "Review the window sticker to confirm trim and options match the listing",
  ],
  negotiation_opener:
    "The asking price seems reasonable, but I have some questions about the battery health and whether DC fast charging has been confirmed on this trim. Can you provide a recent diagnostic or service record?",
  one_followup_question:
    "Has this vehicle ever been serviced under warranty, and are those records available?",
  receipt_reddit_text: "",
  listing_summary: {
    listing_url: "https://www.cargurus.com/Cars/listing/kia-ev6-2025",
    url_domain: "cargurus.com",
    country: "US",
    zip_or_postcode: "00000",
    price: 31497,
    currency: "USD",
    mileage: 3213,
    mileage_unit: "mi",
    year: 2025,
    make: "Kia",
    model: "EV6 Light Long Range AWD",
    trim: null,
    seller_type: "dealer",
    title_status: "clean",
    accidents_reported: "unknown",
    service_history: "unknown",
    owners: null,
    carfax_available: "unknown",
  },
  receipt_details: null,
  compare: null,
  operator_notes: {
    rationale:
      "Listing shows a nearly new 2025 Kia EV6 at a competitive price. The low mileage is a positive, but the absence of battery health documentation and unclear DC fast charging support are gaps that need attention before purchase.",
    assumptions: [
      "Price compared against similar 2025 EV6 LR AWD listings on CarGurus",
      "Title assumed clean based on dealer listing standards",
      "Battery health assumed unknown without documentation",
    ],
  },
  reddit_draft: null,
};

// --- 2023 Tesla Model 3 Performance AWD (RED verdict) ---

export const TESLA_MODEL3_RECEIPT: ListingReceipt = {
  receipt_id: "ad-tesla-model3-2023-cargurus",
  schema_version: "v1",
  mode: "single",
  verdict: "RED",
  verdict_reason:
    "High mileage for a 2023 Performance model, unknown seller type and title status, no service history provided, and no accident report. Too many unknowns at this price point — proceed with extreme caution.",
  price_sanity: {
    label: "OVERPRICED",
    confidence: 0.65,
    basis: "LISTING_ONLY",
    rationale_short:
      "At $31,631 with 27,844 miles, this is on the high side for a 2023 Model 3 Performance with no documented history. Comparable listings with clean titles and service records are priced similarly or lower.",
  },
  risk_flags: [
    "title_status_unknown",
    "accident_history_unknown",
    "service_history_missing",
    "seller_type_unknown",
    "high_mileage_for_year",
  ],
  must_answer_questions: [
    "Has this vehicle been in any accidents or had major repairs?",
    "Is the title clean, and are there any liens on the vehicle?",
    "Can the seller provide recent maintenance or service records?",
  ],
  inspect_first: [
    "Run a VIN check for accident and title history",
    "Request Tesla service records through the Tesla app or service center",
    "Have a pre-purchase inspection done by an independent shop",
    "Test Supercharger access to verify charging speed and account transfer",
    "Check all four tires for even wear and remaining tread",
  ],
  negotiation_opener:
    "This listing has several unknowns — no title status, no accident report, and no service history. Before discussing price, I'd need to see the full vehicle history report, Tesla service records, and a battery health check.",
  one_followup_question:
    "Why is a 2023 Performance model with 27,844 miles being sold now, and is there any remaining Tesla warranty coverage?",
  receipt_reddit_text: "",
  listing_summary: {
    listing_url: "https://www.cargurus.com/Cars/listing/tesla-model3-2023",
    url_domain: "cargurus.com",
    country: "US",
    zip_or_postcode: "00000",
    price: 31631,
    currency: "USD",
    mileage: 27844,
    mileage_unit: "mi",
    year: 2023,
    make: "Tesla",
    model: "Model 3 Performance AWD",
    trim: null,
    seller_type: "unknown",
    title_status: "unknown",
    accidents_reported: "unknown",
    service_history: "unknown",
    owners: null,
    carfax_available: "unknown",
  },
  receipt_details: null,
  compare: null,
  operator_notes: {
    rationale:
      "Multiple critical data points are missing — title status, accident history, service records, and seller type are all unknown. The high mileage for a 2023 model year combined with these gaps creates significant risk. The price is not justified without documentation.",
    assumptions: [
      "Price compared against similar 2023 Model 3 Performance listings on CarGurus",
      "Title and accident status assumed unknown due to missing documentation",
      "Battery health assumed unknown without Tesla service records",
    ],
  },
  reddit_draft: null,
};
