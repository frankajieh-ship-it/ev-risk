/**
 * On-Demand Receipt Section Generators
 *
 * Each function generates a single section of the receipt independently,
 * called only when the user requests it. Uses OpenAI Structured Outputs
 * (json_schema + strict: true) for reliable parsing without retries.
 *
 * Sections:
 *   - generateRedditDraft      → reddit_draft (structured Reddit post)
 *   - generateReceiptDetails   → receipt_details (fees, tricks, walk-away triggers)
 *   - generateNegotiationDeep  → negotiation_scripts (3-scenario scripts)
 */

import type { ListingReceipt, RedditDraft, ReceiptDetails } from "@/types/receipt";
import { hedgedGenerate } from "@/lib/providers/hedged-generate";

// Hedge delays for on-demand sections: slightly longer than core since user initiated
// and we can take up to 30s without pressure.
const SECTION_HEDGE_DELAYS: [number, number] = [10_000, 18_000];

// --- Shared helper ---

async function callStructuredSection<T>(
  systemPrompt: string,
  userPrompt: string,
  jsonSchema: Record<string, unknown>,
  schemaName: string,
  maxTokens: number,
): Promise<T> {
  const result = await hedgedGenerate({
    systemPrompt,
    userPrompt,
    jsonSchema,
    schemaName,
    temperature: 0.3,
    maxTokens,
    hedgeDelays: SECTION_HEDGE_DELAYS,
    validate: (json) => {
      // Basic non-null check — sections don't have a deep Zod validator,
      // but we verify the wrapper key exists and is non-empty
      if (!json || typeof json !== "object") {
        return { valid: false, errors: ["Response is not an object"] };
      }
      const obj = json as Record<string, unknown>;
      if (!(schemaName in obj) && !Object.keys(obj).some((k) => k === schemaName || k.startsWith(schemaName.replace("_", "")))) {
        // The top-level key should match schemaName (e.g. "reddit_draft", "receipt_details", "negotiation_deep")
        // Allow if the object has any keys at all (provider may return slightly differently keyed)
        if (Object.keys(obj).length === 0) {
          return { valid: false, errors: [`Empty response for section: ${schemaName}`] };
        }
      }
      return { valid: true, errors: [] };
    },
  });

  const content = result.result.rawText;
  if (!content) throw new Error(`Empty response for section: ${schemaName}`);
  return result.result.json as T;
}

// --- Reddit Draft ---

const REDDIT_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reddit_draft"],
  properties: {
    reddit_draft: {
      type: "object",
      additionalProperties: false,
      required: ["title", "body_facts", "body_uncertainty", "body_next_steps", "questions", "style"],
      properties: {
        title: { type: "string" },
        body_facts: { type: "array", items: { type: "string" } },
        body_uncertainty: { type: "array", items: { type: "string" } },
        body_next_steps: { type: "array", items: { type: "string" } },
        questions: { type: "array", items: { type: "string" } },
        style: {
          type: "object",
          additionalProperties: false,
          required: ["format", "max_questions"],
          properties: {
            format: { type: "string", enum: ["short_paragraph", "standard", "bullets"] },
            max_questions: { type: "number" },
          },
        },
      },
    },
  },
} as const;

const REDDIT_DRAFT_SYSTEM = `You write Reddit posts for used-car buyers. Given a receipt analysis, produce a reddit_draft JSON.

RULES:
- body_*: first-person buyer voice ("I plan to...", "I wasn't able to confirm..."). Never imperative ("Check the...", "Verify...").
- title: starts with year/make/model and price. 10-200 chars.
- body_facts: 1-5 items, 5-200 chars each. Concrete, specific, numbers where possible.
- body_uncertainty: 0-3 items, 5-200 chars each. Only genuine unknowns.
- body_next_steps: 0-3 items, 5-200 chars each.
- questions: EXACTLY 1 item. 10-200 chars. Must target the single biggest risk.
- Only 1 question mark total across ALL fields.
- No verdict language (good deal, bad deal, buy it, skip it, hard pass, I'd lean, avoid).
- No URLs. No smart quotes. No markdown * or _. Use "or" not "/".
- style.format: "short_paragraph". style.max_questions: 1.

Return ONLY the JSON object.`;

export async function generateRedditDraft(
  receipt: ListingReceipt,
): Promise<RedditDraft> {
  const ls = receipt.listing_summary;
  const label = `${ls.year} ${ls.make} ${ls.model}${ls.trim ? " " + ls.trim : ""}`;
  const priceStr = ls.price > 0 ? `$${ls.price.toLocaleString()}` : "price unknown";

  const userPrompt = `Generate a reddit_draft for this listing:

Vehicle: ${label}
Price: ${priceStr}
Mileage: ${ls.mileage?.toLocaleString() ?? "unknown"} ${ls.mileage_unit}
Seller: ${ls.seller_type}
Title: ${ls.title_status}
Accidents: ${ls.accidents_reported}
Service history: ${ls.service_history}

Verdict: ${receipt.verdict}
Verdict reason: ${receipt.verdict_reason}

Risk flags:
${(receipt.risk_flags || []).map((f) => `- ${f}`).join("\n")}

Must-ask questions:
${(receipt.must_answer_questions || []).map((q) => `- ${q}`).join("\n")}`;

  const result = await callStructuredSection<{ reddit_draft: RedditDraft }>(
    REDDIT_DRAFT_SYSTEM,
    userPrompt,
    REDDIT_DRAFT_SCHEMA as Record<string, unknown>,
    "reddit_draft",
    600,
  );

  return result.reddit_draft;
}

// --- Receipt Details ---

const RECEIPT_DETAILS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["receipt_details"],
  properties: {
    receipt_details: {
      type: "object",
      additionalProperties: false,
      required: ["fee_estimates", "common_listing_tricks", "walk_away_triggers"],
      properties: {
        fee_estimates: {
          type: "object",
          additionalProperties: false,
          required: ["currency", "notes", "tax_estimate_range", "doc_fee_estimate_range"],
          properties: {
            currency: { type: "string" },
            notes: { type: "string" },
            tax_estimate_range: {
              anyOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["low", "high"],
                  properties: { low: { type: "number" }, high: { type: "number" } },
                },
                { type: "null" },
              ],
            },
            doc_fee_estimate_range: {
              anyOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["low", "high"],
                  properties: { low: { type: "number" }, high: { type: "number" } },
                },
                { type: "null" },
              ],
            },
          },
        },
        common_listing_tricks: { type: "array", items: { type: "string" } },
        walk_away_triggers: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

const RECEIPT_DETAILS_SYSTEM = `You provide detailed purchase cost breakdowns and dealer tactic education for used-car buyers.

Given listing data, produce receipt_details JSON with:
- fee_estimates: realistic tax, doc fee ranges for this state/country. Notes max 220 chars. currency "USD" (or "GBP" for UK).
- common_listing_tricks: 3-10 specific tactics this type of seller uses. 1-140 chars each. Concrete, not generic.
- walk_away_triggers: 3-10 specific red-line conditions that justify walking away. 1-140 chars each. Specific to this deal.

Return ONLY the JSON object.`;

export async function generateReceiptDetails(
  receipt: ListingReceipt,
): Promise<ReceiptDetails> {
  const ls = receipt.listing_summary;
  const label = `${ls.year} ${ls.make} ${ls.model}${ls.trim ? " " + ls.trim : ""}`;
  const priceStr = ls.price > 0 ? `$${ls.price.toLocaleString()}` : "price unknown";

  const userPrompt = `Generate receipt_details for this listing:

Vehicle: ${label}
Price: ${priceStr}
Location: ${ls.zip_or_postcode || ls.country || "unknown"}
Country: ${ls.country}
Seller: ${ls.seller_type}
Title: ${ls.title_status}
Accidents: ${ls.accidents_reported}

Verdict: ${receipt.verdict}
Risk flags:
${(receipt.risk_flags || []).map((f) => `- ${f}`).join("\n")}

Listing signals: ${(receipt.listing_signals || []).slice(0, 10).join(", ") || "none"}`;

  const result = await callStructuredSection<{ receipt_details: ReceiptDetails }>(
    RECEIPT_DETAILS_SYSTEM,
    userPrompt,
    RECEIPT_DETAILS_SCHEMA as Record<string, unknown>,
    "receipt_details",
    700,
  );

  return result.receipt_details;
}

// --- Negotiation Scripts (Deep) ---

export interface NegotiationScript {
  scenario: string;   // 2-6 word scenario name
  opening: string;    // 20-200 chars
  body: string;       // 40-600 chars
}

const NEGOTIATION_DEEP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["negotiation_scripts"],
  properties: {
    negotiation_scripts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["scenario", "opening", "body"],
        properties: {
          scenario: { type: "string" },
          opening: { type: "string" },
          body: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const NEGOTIATION_DEEP_SYSTEM = `You write specific, actionable negotiation scripts for used-car buyers. Given a receipt analysis, produce exactly 3 negotiation scenarios.

Each scenario has:
- scenario: 2-6 word name (e.g. "Cash offer", "Inspection leverage", "Trade-in pressure")
- opening: 20-200 char opening line — specific to the vehicle and situation
- body: array of 2-4 tactical steps (each 20-200 chars), specific to this deal

RULES:
- Scripts must be specific to this vehicle's risks and price.
- Never generic advice. Reference concrete details (mileage, price, accident history, flags).
- Body steps are tactical moves, not generic reminders.
- No verdict language. Neutral, factual framing.

Return ONLY the JSON object.`;

export async function generateNegotiationDeep(
  receipt: ListingReceipt,
): Promise<NegotiationScript[]> {
  const ls = receipt.listing_summary;
  const label = `${ls.year} ${ls.make} ${ls.model}${ls.trim ? " " + ls.trim : ""}`;
  const priceStr = ls.price > 0 ? `$${ls.price.toLocaleString()}` : "price unknown";

  const userPrompt = `Generate negotiation_scripts for this listing:

Vehicle: ${label}
Price: ${priceStr}
Mileage: ${ls.mileage?.toLocaleString() ?? "unknown"} ${ls.mileage_unit}
Seller: ${ls.seller_type}
Accidents: ${ls.accidents_reported}
Title: ${ls.title_status}

Verdict: ${receipt.verdict}
Negotiation opener already shown to user: "${receipt.negotiation_opener}"

Risk flags:
${(receipt.risk_flags || []).map((f) => `- ${f}`).join("\n")}

Must-ask questions:
${(receipt.must_answer_questions || []).map((q) => `- ${q}`).join("\n")}

Produce EXACTLY 3 scenarios. Do not repeat what the opener already says.`;

  const result = await callStructuredSection<{ negotiation_scripts: NegotiationScript[] }>(
    NEGOTIATION_DEEP_SYSTEM,
    userPrompt,
    NEGOTIATION_DEEP_SCHEMA as Record<string, unknown>,
    "negotiation_deep",
    800,
  );

  return result.negotiation_scripts;
}
