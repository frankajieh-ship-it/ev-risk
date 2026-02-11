/**
 * Receipt Schema Validator (Linter Gate)
 *
 * Validates AI-generated receipt output against the v1 schema.
 * If validation fails, the Copy button is disabled on the frontend.
 * Hand-written to match codebase convention (no Zod).
 */

import type { ListingReceipt } from "@/types/receipt";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: ListingReceipt | null;
}

const VERDICTS = ["GREEN", "YELLOW", "RED"];
const PRICE_LABELS = ["UNDERPRICED", "FAIR", "OVERPRICED", "UNKNOWN"];
const PRICE_BASES = ["LISTING_ONLY", "USER_MARKET_RANGE", "UNKNOWN"];
const SELLER_TYPES = ["dealer", "private", "unknown"];
const TITLE_STATUSES = ["clean", "salvage", "rebuilt", "unknown"];
const COUNTRIES = ["US", "UK", "CA", "AU", "OTHER"];
const MILEAGE_UNITS = ["mi", "km", "unknown"];
const YES_NO_UNKNOWN = ["yes", "no", "unknown"];
const COMPARE_WINNERS = ["A", "B", "TIE"];

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

function checkString(
  errors: string[],
  field: string,
  value: unknown,
  min: number,
  max: number
): string | null {
  if (!isString(value)) {
    errors.push(`${field}: expected string, got ${typeof value}`);
    return null;
  }
  if (value.length < min) {
    errors.push(`${field}: too short (${value.length} < ${min})`);
  }
  if (value.length > max) {
    errors.push(`${field}: too long (${value.length} > ${max})`);
  }
  return value;
}

function checkEnum(
  errors: string[],
  field: string,
  value: unknown,
  allowed: string[]
): string | null {
  if (!isString(value) || !allowed.includes(value)) {
    errors.push(`${field}: expected one of [${allowed.join(", ")}], got "${value}"`);
    return null;
  }
  return value;
}

function checkStringArray(
  errors: string[],
  field: string,
  value: unknown,
  exactCount: number | null,
  minCount: number,
  maxCount: number,
  minLen: number,
  maxLen: number
): string[] {
  if (!Array.isArray(value)) {
    errors.push(`${field}: expected array, got ${typeof value}`);
    return [];
  }
  if (exactCount !== null && value.length !== exactCount) {
    errors.push(`${field}: expected exactly ${exactCount} items, got ${value.length}`);
  } else {
    if (value.length < minCount) {
      errors.push(`${field}: too few items (${value.length} < ${minCount})`);
    }
    if (value.length > maxCount) {
      errors.push(`${field}: too many items (${value.length} > ${maxCount})`);
    }
  }
  return value.map((item, i) => {
    if (!isString(item)) {
      errors.push(`${field}[${i}]: expected string, got ${typeof item}`);
      return String(item);
    }
    if (item.length < minLen) {
      errors.push(`${field}[${i}]: too short (${item.length} < ${minLen})`);
    }
    if (item.length > maxLen) {
      errors.push(`${field}[${i}]: too long (${item.length} > ${maxLen})`);
    }
    return item;
  });
}

function validatePriceSanity(
  errors: string[],
  ps: unknown
): ListingReceipt["price_sanity"] | null {
  if (!ps || typeof ps !== "object") {
    errors.push("price_sanity: missing or not an object");
    return null;
  }
  const obj = ps as Record<string, unknown>;

  checkEnum(errors, "price_sanity.label", obj.label, PRICE_LABELS);
  if (!isNumber(obj.confidence) || obj.confidence < 0 || obj.confidence > 1) {
    errors.push(`price_sanity.confidence: expected number 0-1, got ${obj.confidence}`);
  }
  checkEnum(errors, "price_sanity.basis", obj.basis, PRICE_BASES);
  checkString(errors, "price_sanity.rationale_short", obj.rationale_short, 4, 180);

  // user_market_range is nullable
  if (obj.user_market_range !== null && obj.user_market_range !== undefined) {
    const umr = obj.user_market_range as Record<string, unknown>;
    if (typeof umr !== "object") {
      errors.push("price_sanity.user_market_range: expected object or null");
    } else {
      if (!isNumber(umr.low) || umr.low < 0) errors.push("price_sanity.user_market_range.low: expected non-negative number");
      if (!isNumber(umr.high) || umr.high < 0) errors.push("price_sanity.user_market_range.high: expected non-negative number");
      if (!isString(umr.currency)) errors.push("price_sanity.user_market_range.currency: expected string");
    }
  }

  return obj as unknown as ListingReceipt["price_sanity"];
}

function validateListingSummary(
  errors: string[],
  prefix: string,
  ls: unknown
): ListingReceipt["listing_summary"] | null {
  if (!ls || typeof ls !== "object") {
    errors.push(`${prefix}: missing or not an object`);
    return null;
  }
  const obj = ls as Record<string, unknown>;

  // Required string fields
  const requiredFields = [
    "listing_url", "url_domain", "country", "zip_or_postcode",
    "currency", "make", "model"
  ];
  for (const f of requiredFields) {
    if (obj[f] === undefined || obj[f] === null) {
      // These are required by schema but AI might set them to empty/null
      // We warn but don't hard-fail
      errors.push(`${prefix}.${f}: required field is missing or null`);
    }
  }

  // Enum fields
  if (obj.country) checkEnum(errors, `${prefix}.country`, obj.country, COUNTRIES);
  if (obj.mileage_unit) checkEnum(errors, `${prefix}.mileage_unit`, obj.mileage_unit, MILEAGE_UNITS);
  if (obj.seller_type) checkEnum(errors, `${prefix}.seller_type`, obj.seller_type, SELLER_TYPES);
  if (obj.title_status) checkEnum(errors, `${prefix}.title_status`, obj.title_status, TITLE_STATUSES);
  if (obj.accidents_reported) checkEnum(errors, `${prefix}.accidents_reported`, obj.accidents_reported, YES_NO_UNKNOWN);
  if (obj.service_history) checkEnum(errors, `${prefix}.service_history`, obj.service_history, YES_NO_UNKNOWN);
  if (obj.carfax_available) checkEnum(errors, `${prefix}.carfax_available`, obj.carfax_available, YES_NO_UNKNOWN);

  // Number fields
  if (obj.year !== null && obj.year !== undefined && !isNumber(obj.year)) {
    errors.push(`${prefix}.year: expected number`);
  }
  if (obj.price !== null && obj.price !== undefined && !isNumber(obj.price)) {
    errors.push(`${prefix}.price: expected number`);
  }
  if (obj.mileage !== null && obj.mileage !== undefined && !isNumber(obj.mileage)) {
    errors.push(`${prefix}.mileage: expected number`);
  }

  return obj as unknown as ListingReceipt["listing_summary"];
}

function validateReceiptDetails(
  errors: string[],
  rd: unknown
): ListingReceipt["receipt_details"] | null {
  if (rd === null || rd === undefined) return null;
  if (typeof rd !== "object") {
    errors.push("receipt_details: expected object or null");
    return null;
  }
  const obj = rd as Record<string, unknown>;

  // fee_estimates
  if (!obj.fee_estimates || typeof obj.fee_estimates !== "object") {
    errors.push("receipt_details.fee_estimates: missing or not an object");
  } else {
    const fe = obj.fee_estimates as Record<string, unknown>;
    if (!isString(fe.currency)) errors.push("receipt_details.fee_estimates.currency: expected string");
    if (!isString(fe.notes)) errors.push("receipt_details.fee_estimates.notes: expected string");
  }

  checkStringArray(errors, "receipt_details.common_listing_tricks", obj.common_listing_tricks, null, 3, 10, 1, 140);
  checkStringArray(errors, "receipt_details.walk_away_triggers", obj.walk_away_triggers, null, 3, 10, 1, 140);

  return obj as unknown as ListingReceipt["receipt_details"];
}

function validateCompare(
  errors: string[],
  cmp: unknown
): ListingReceipt["compare"] | null {
  if (cmp === null || cmp === undefined) return null;
  if (typeof cmp !== "object") {
    errors.push("compare: expected object or null");
    return null;
  }
  const obj = cmp as Record<string, unknown>;

  checkEnum(errors, "compare.winner", obj.winner, COMPARE_WINNERS);
  checkStringArray(errors, "compare.why", obj.why, 2, 2, 2, 1, 160);
  checkStringArray(errors, "compare.tie_breaker_questions", obj.tie_breaker_questions, null, 0, 2, 1, 140);
  validateListingSummary(errors, "compare.listing_b_summary", obj.listing_b_summary);

  return obj as unknown as ListingReceipt["compare"];
}

function validateOperatorNotes(
  errors: string[],
  on: unknown
): ListingReceipt["operator_notes"] | null {
  if (!on || typeof on !== "object") {
    errors.push("operator_notes: missing or not an object");
    return null;
  }
  const obj = on as Record<string, unknown>;

  checkString(errors, "operator_notes.rationale", obj.rationale, 10, 500);
  checkStringArray(errors, "operator_notes.assumptions", obj.assumptions, null, 0, 6, 1, 120);
  checkStringArray(errors, "operator_notes.what_would_change_verdict", obj.what_would_change_verdict, null, 0, 4, 1, 140);

  return obj as unknown as ListingReceipt["operator_notes"];
}

export function validateReceiptSchema(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["Response is not an object"], sanitized: null };
  }

  const obj = raw as Record<string, unknown>;

  // Top-level required fields
  if (obj.schema_version !== "v1") {
    errors.push(`schema_version: expected "v1", got "${obj.schema_version}"`);
  }

  if (!isString(obj.receipt_id)) {
    errors.push("receipt_id: missing or not a string");
  }

  checkEnum(errors, "mode", obj.mode, ["single", "compare"]);
  checkEnum(errors, "verdict", obj.verdict, VERDICTS);
  checkString(errors, "verdict_reason", obj.verdict_reason, 4, 180);

  // price_sanity
  validatePriceSanity(errors, obj.price_sanity);

  // Fixed-count arrays
  checkStringArray(errors, "risk_flags", obj.risk_flags, 3, 3, 3, 1, 120);
  checkStringArray(errors, "must_answer_questions", obj.must_answer_questions, 3, 3, 3, 1, 140);
  checkStringArray(errors, "inspect_first", obj.inspect_first, 5, 5, 5, 1, 140);

  // Strings
  checkString(errors, "negotiation_opener", obj.negotiation_opener, 8, 420);
  checkString(errors, "receipt_reddit_text", obj.receipt_reddit_text, 40, 1200);

  // one_followup_question: null or string max 160
  if (obj.one_followup_question !== null && obj.one_followup_question !== undefined) {
    checkString(errors, "one_followup_question", obj.one_followup_question, 0, 160);
  }

  // Nested objects
  validateReceiptDetails(errors, obj.receipt_details);
  validateCompare(errors, obj.compare);
  validateOperatorNotes(errors, obj.operator_notes);
  validateListingSummary(errors, "listing_summary", obj.listing_summary);

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    sanitized: valid ? (obj as unknown as ListingReceipt) : (obj as unknown as ListingReceipt),
  };
}
