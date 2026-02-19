/**
 * Receipt Schema Validator (Zod) + Reddit Text Linter
 *
 * Part A: Zod schema replaces the hand-written validator.
 * Part B: lintReceiptRedditText() — pure function with content rules.
 * Part C: validateReceiptSchema() — combined Zod parse + lint.
 */

import { z } from "zod";

// --- Part A: Zod Schema ---

const PriceRangeSchema = z.object({
  low: z.number().min(0),
  high: z.number().min(0),
});

const MarketRangeSchema = z.object({
  low: z.number().min(0),
  high: z.number().min(0),
  currency: z.string(),
});

const PriceSanitySchema = z.object({
  label: z.enum(["UNDERPRICED", "FAIR", "OVERPRICED", "UNKNOWN"]),
  confidence: z.number().min(0).max(1),
  basis: z.enum(["LISTING_ONLY", "USER_MARKET_RANGE", "UNKNOWN"]),
  rationale_short: z.string().min(4).max(180),
  user_market_range: MarketRangeSchema.nullable().optional(),
});

const FeeEstimatesSchema = z.object({
  currency: z.string(),
  notes: z.string().max(220),
  tax_estimate_range: PriceRangeSchema.nullable().optional(),
  doc_fee_estimate_range: PriceRangeSchema.nullable().optional(),
});

const ReceiptDetailsSchema = z.object({
  fee_estimates: FeeEstimatesSchema,
  common_listing_tricks: z.array(z.string().min(1).max(140)).min(3).max(10),
  walk_away_triggers: z.array(z.string().min(1).max(140)).min(3).max(10),
});

const ListingSummarySchema = z.object({
  listing_url: z.string(),
  url_domain: z.string(),
  country: z.enum(["US", "UK", "CA", "AU", "OTHER"]),
  zip_or_postcode: z.string(),
  price: z.number(),
  currency: z.string(),
  mileage: z.number(),
  mileage_unit: z.enum(["mi", "km", "unknown"]),
  year: z.number(),
  make: z.string(),
  model: z.string(),
  trim: z.string().nullable(),
  seller_type: z.enum(["dealer", "private", "unknown"]),
  title_status: z.enum(["clean", "salvage", "rebuilt", "unknown"]),
  accidents_reported: z.enum(["yes", "no", "unknown"]),
  service_history: z.enum(["yes", "no", "unknown"]),
  owners: z.number().nullable(),
  carfax_available: z.enum(["yes", "no", "unknown"]),
  financing_vs_cash: z.enum(["financing", "cash", "unknown"]).optional(),
}).passthrough();

const CompareSectionSchema = z.object({
  winner: z.enum(["A", "B", "TIE"]),
  why: z.array(z.string().min(1).max(160)).min(1).max(4),
  tie_breaker_questions: z.array(z.string().min(1).max(140)).max(2),
  listing_b_summary: ListingSummarySchema,
}).passthrough();

const OperatorNotesSchema = z.object({
  rationale: z.string().min(10).max(500),
  assumptions: z.array(z.string().min(1).max(120)).max(6).optional(),
  what_would_change_verdict: z.array(z.string().min(1).max(140)).max(5).optional(),
});

const RedditDraftStyleSchema = z.object({
  format: z.enum(["short_paragraph", "standard", "bullets"]).default("short_paragraph"),
  max_questions: z.number().min(1).max(1).default(1),
});

export const RedditDraftSchema = z.object({
  title: z.string().min(10).max(200),
  body_facts: z.array(z.string().min(5).max(200)).min(1).max(5),
  body_uncertainty: z.array(z.string().min(5).max(200)).max(3),
  body_next_steps: z.array(z.string().min(5).max(200)).max(3),
  questions: z.array(z.string().min(10).max(200)).min(1).max(2),
  style: RedditDraftStyleSchema,
});

export type RedditDraft = z.infer<typeof RedditDraftSchema>;

export const ReceiptSchema = z.object({
  receipt_id: z.string(),
  schema_version: z.literal("v1"),
  mode: z.enum(["single", "compare"]),
  verdict: z.enum(["GREEN", "YELLOW", "RED"]),
  verdict_reason: z.string().min(4).max(180),
  price_sanity: PriceSanitySchema,
  risk_flags: z.array(z.string().min(1).max(120)).min(1).max(5),
  must_answer_questions: z.array(z.string().min(1).max(140)).min(1).max(5),
  inspect_first: z.array(z.string().min(1).max(140)).min(3).max(8),
  negotiation_opener: z.string().min(8).max(420),
  one_followup_question: z.string().max(160).nullable(),
  receipt_reddit_text: z.string().max(1200).default(""),
  listing_summary: ListingSummarySchema,
  receipt_details: ReceiptDetailsSchema.nullable().optional(),
  compare: CompareSectionSchema.nullable().optional(),
  operator_notes: OperatorNotesSchema,
  reddit_draft: RedditDraftSchema.nullable().optional(),
});

export type Receipt = z.infer<typeof ReceiptSchema>;

// --- Part B: Lint function for receipt_reddit_text ---

export interface LintError {
  code: string;
  message: string;
  fixable: boolean;
}

export function lintReceiptRedditText(text: string): LintError[] {
  const errors: LintError[] = [];

  // Length check (900 is the strict Reddit-copy limit)
  if (text.length > 900) {
    errors.push({ code: "MAX_CHARS", message: `Text too long (${text.length}/900 chars)`, fixable: true });
  }

  // No smart / curly quotes
  if (/[\u201C\u201D\u201E\u201F\u2018\u2019\u201A\u201B]/.test(text)) {
    errors.push({ code: "SMART_QUOTES", message: "Contains smart/curly quotes", fixable: true });
  }

  // No italics markers (* or _)
  if (/[*_]/.test(text)) {
    errors.push({ code: "ITALIC_MARKERS", message: "Contains markdown italic markers (* or _)", fixable: true });
  }

  // No word/word pattern
  if (/\b[A-Za-z]+\/[A-Za-z]+\b/.test(text)) {
    errors.push({ code: "WORD_SLASH", message: "Contains word/word pattern (use 'or' instead)", fixable: true });
  }

  // Max 1 question mark (OFFO rule: one question max across entire draft)
  const qCount = (text.match(/\?/g) || []).length;
  if (qCount > 1) {
    errors.push({ code: "TOO_MANY_QUESTIONS", message: `Too many questions (${qCount}, max 1)`, fixable: true });
  }

  // No URLs
  if (/https?:\/\/|www\./i.test(text)) {
    errors.push({ code: "CONTAINS_URL", message: "Contains URL", fixable: true });
  }

  // No promo terms
  const PROMO_TERMS = ["sign up", "subscribe", "dm me", "check out", "my tool", "try our", "link in bio"];
  const lower = text.toLowerCase();
  for (const term of PROMO_TERMS) {
    if (lower.includes(term)) {
      errors.push({ code: "PROMO_TERM", message: `Contains promo term: "${term}"`, fixable: true });
      break;
    }
  }

  // No verdict language
  const BANNED_VERDICT = [
    "good deal", "bad deal", "buy it", "skip it", "you should",
    "i'd lean", "i would lean", "great deal", "terrible deal",
    "don't buy", "do not buy", "must buy", "hard pass",
    "steer you", "avoid",
  ];
  for (const phrase of BANNED_VERDICT) {
    if (lower.includes(phrase)) {
      errors.push({ code: "VERDICT_LANGUAGE", message: `Contains banned verdict phrase: "${phrase}"`, fixable: true });
      break;
    }
  }

  // Banned word: "annoying" → "stressful"
  if (/\bannoying\b/i.test(text)) {
    errors.push({ code: "BANNED_WORD_ANNOYING", message: 'Contains "annoying" (use "stressful" instead)', fixable: true });
  }

  // Quotation marks (straight " or ')
  if (/["']/.test(text)) {
    errors.push({ code: "QUOTATION_MARKS", message: "Contains quotation marks (remove all \" and ')", fixable: true });
  }

  // Absolute claims
  if (/\b(will|definitely|always|indicates|too good to be true)\b/i.test(text)) {
    errors.push({ code: "ABSOLUTE_CLAIMS", message: "Contains absolute language (use cautious alternatives: may, often, can suggest)", fixable: true });
  }

  return errors;
}

// --- Part C: Normalize array lengths before strict Zod parse ---

/**
 * OpenAI occasionally returns arrays with slightly wrong counts (e.g. 4
 * risk_flags instead of exactly 3). Rather than hard-failing, truncate or
 * pad to match the schema's exact-length constraints.
 */
function normalizeArrayLengths(raw: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...raw };

  const targets: Record<string, { length: number; pad: string }> = {
    risk_flags: { length: 3, pad: "Review vehicle history report for additional concerns" },
    must_answer_questions: { length: 3, pad: "What is the full maintenance and repair history?" },
    inspect_first: { length: 5, pad: "Have a trusted mechanic perform a pre-purchase inspection" },
  };

  for (const [field, { length, pad }] of Object.entries(targets)) {
    const arr = copy[field];
    if (!Array.isArray(arr)) continue;
    if (arr.length > length) {
      copy[field] = arr.slice(0, length);
    } else if (arr.length < length) {
      copy[field] = [...arr, ...Array(length - arr.length).fill(pad)];
    }
  }

  // Nested: compare.why (length 2)
  if (copy.compare && typeof copy.compare === "object") {
    const compare = { ...(copy.compare as Record<string, unknown>) };
    if (Array.isArray(compare.why)) {
      if (compare.why.length > 2) compare.why = compare.why.slice(0, 2);
      else if (compare.why.length < 2) {
        compare.why = [...compare.why, ...Array(2 - compare.why.length).fill("Compare additional details to make your decision")];
      }
    }
    copy.compare = compare;
  }

  // Nested: reddit_draft.questions (length 1)
  if (copy.reddit_draft && typeof copy.reddit_draft === "object") {
    const draft = { ...(copy.reddit_draft as Record<string, unknown>) };
    if (Array.isArray(draft.questions)) {
      if (draft.questions.length > 1) draft.questions = draft.questions.slice(0, 1);
      else if (draft.questions.length < 1) {
        draft.questions = ["What should I know before buying this vehicle?"];
      }
    }
    copy.reddit_draft = draft;
  }

  return copy;
}

// --- Part D: Combined validate function ---

export function validateReceiptSchema(raw: unknown): {
  valid: boolean;
  errors: string[];
  lintErrors: LintError[];
  sanitized: Receipt | null;
} {
  // Step 1: Normalize array lengths, then Zod parse
  const normalized = typeof raw === "object" && raw !== null
    ? normalizeArrayLengths(raw as Record<string, unknown>)
    : raw;
  const parsed = ReceiptSchema.safeParse(normalized);
  if (!parsed.success) {
    const schemaErrors = parsed.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    );
    return { valid: false, errors: schemaErrors, lintErrors: [], sanitized: null };
  }

  // Step 2: Lint receipt_reddit_text (skip if empty — deterministic renderer overwrites it)
  const lintErrors = parsed.data.receipt_reddit_text
    ? lintReceiptRedditText(parsed.data.receipt_reddit_text)
    : [];

  return {
    valid: lintErrors.length === 0,
    errors: lintErrors.map((e) => `lint:${e.code}: ${e.message}`),
    lintErrors,
    sanitized: parsed.data,
  };
}
