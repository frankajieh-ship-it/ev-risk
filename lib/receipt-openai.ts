/**
 * OFFO Listing Receipt — OpenAI Integration
 *
 * Constructs prompts, calls OpenAI, parses JSON response.
 * Server-side only (used in API routes).
 */

import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import type { ListingReceipt, ReceiptGenerateRequest } from "@/types/receipt";
import { validateReceiptSchema } from "@/lib/receipt-schema-validator";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// --- System Prompt ---

const SYSTEM_PROMPT = `You are OFFO Receipt Bot, a used-car listing analyst built by OFFO Lab.

YOUR JOB: Analyze a car listing and produce a structured JSON "receipt" that helps a buyer know if the deal is good, what to watch for, and what to ask the seller.

OUTPUT FORMAT: Return ONLY a valid JSON object. No markdown fences, no explanation, no trailing text.

JSON SCHEMA:
{
  "schema_version": "v1",
  "receipt_id": "<generate a UUID v4>",
  "mode": "single",
  "verdict": "GREEN" | "YELLOW" | "RED",
  "verdict_reason": "<string, 4-180 chars: why this verdict>",
  "price_sanity": {
    "label": "UNDERPRICED" | "FAIR" | "OVERPRICED" | "UNKNOWN",
    "confidence": <number 0.0-1.0>,
    "basis": "LISTING_ONLY" | "USER_MARKET_RANGE" | "UNKNOWN",
    "rationale_short": "<string, 4-180 chars>",
    "user_market_range": null
  },
  "risk_flags": ["<1-120 chars>", "<1-120 chars>", "<1-120 chars>"],
  "must_answer_questions": ["<1-140 chars>", "<1-140 chars>", "<1-140 chars>"],
  "inspect_first": ["<1-140>", "<1-140>", "<1-140>", "<1-140>", "<1-140>"],
  "negotiation_opener": "<string, 8-420 chars: a ready-to-use opening line for the buyer>",
  "one_followup_question": "<string max 160 chars>" or null,
  "receipt_reddit_text": "<string, 40-1200 chars: a shareable reddit-style deal summary that starts with the vehicle and price>",
  "receipt_details": {
    "fee_estimates": {
      "currency": "USD",
      "notes": "<string, max 220 chars>",
      "tax_estimate_range": { "low": <number>, "high": <number> } or null,
      "doc_fee_estimate_range": { "low": <number>, "high": <number> } or null
    },
    "common_listing_tricks": ["<string, 1-140 chars>", ...],
    "walk_away_triggers": ["<string, 1-140 chars>", ...]
  },
  "compare": null,
  "operator_notes": {
    "rationale": "<string, 10-500 chars: explain your reasoning transparently>",
    "assumptions": ["<string, 1-120 chars>", ...],
    "what_would_change_verdict": ["<string, 1-140 chars>", ...]
  },
  "listing_summary": {
    "listing_url": "<string or provide the URL given>",
    "url_domain": "<string>",
    "country": "US" | "UK" | "CA" | "AU" | "OTHER",
    "zip_or_postcode": "<string>",
    "price": <number>,
    "currency": "<string>",
    "mileage": <number>,
    "mileage_unit": "mi" | "km" | "unknown",
    "year": <integer>,
    "make": "<string>",
    "model": "<string>",
    "trim": "<string>" or null,
    "seller_type": "dealer" | "private" | "unknown",
    "title_status": "clean" | "salvage" | "rebuilt" | "unknown",
    "accidents_reported": "yes" | "no" | "unknown",
    "service_history": "yes" | "no" | "unknown",
    "owners": <integer> or null,
    "carfax_available": "yes" | "no" | "unknown"
  }
}

CRITICAL CONSTRAINTS — the linter will reject your output if these fail:
- risk_flags: EXACTLY 3 items, each 1-120 characters
- must_answer_questions: EXACTLY 3 items, each 1-140 characters
- inspect_first: EXACTLY 5 items, each 1-140 characters
- common_listing_tricks: 3-10 items, each 1-140 characters
- walk_away_triggers: 3-10 items, each 1-140 characters
- assumptions: 0-6 items, each 1-120 characters
- what_would_change_verdict: 0-4 items, each 1-140 characters
- verdict_reason: 4-180 characters
- negotiation_opener: 8-420 characters
- receipt_reddit_text: 40-1200 characters
- operator_notes.rationale: 10-500 characters

VERDICT GUIDELINES:
- GREEN: Price is fair or better, no major red flags, standard used-car caution applies
- YELLOW: Some concerns worth investigating, price may be slightly high, or key info is missing
- RED: Significant red flags, overpriced, or information suggests avoid

TONE: Direct, specific, no filler. Write like a knowledgeable friend who has bought 50 cars — not like a lawyer or a robot. Use concrete numbers and specifics from the listing.`;

// --- User Prompt Builder ---

function buildUserPrompt(input: ReceiptGenerateRequest): string {
  const parts: string[] = ["ANALYZE THIS LISTING:", ""];

  if (input.listing_url) {
    parts.push(`LISTING URL: ${input.listing_url}`);
    parts.push("");
  }

  if (input.listing_text) {
    const trimmed = input.listing_text.substring(0, 8000);
    parts.push("LISTING TEXT:");
    parts.push(trimmed);
    parts.push("");
  }

  // Structured fields
  const fields: string[] = [];
  if (input.year) fields.push(`Year: ${input.year}`);
  if (input.make) fields.push(`Make: ${input.make}`);
  if (input.model) fields.push(`Model: ${input.model}`);
  if (input.trim) fields.push(`Trim: ${input.trim}`);
  if (input.mileage) fields.push(`Mileage: ${input.mileage.toLocaleString()}`);
  if (input.price) fields.push(`Asking Price: $${input.price.toLocaleString()}`);
  if (input.vin) fields.push(`VIN: ${input.vin}`);
  if (input.location) fields.push(`Location: ${input.location}`);

  if (fields.length > 0) {
    parts.push("KNOWN DETAILS:");
    for (const f of fields) {
      parts.push(`- ${f}`);
    }
    parts.push("");
  }

  parts.push("Generate the receipt JSON now. Return ONLY the JSON object.");

  return parts.join("\n");
}

// --- Main Generate Function ---

export async function generateReceipt(
  input: ReceiptGenerateRequest
): Promise<{ receipt: ListingReceipt; raw_response: string; retried: boolean }> {
  const userPrompt = buildUserPrompt(input);

  // First attempt
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const firstResponse = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const firstContent = firstResponse.choices[0]?.message?.content || "{}";
  let parsed: unknown;

  try {
    parsed = JSON.parse(firstContent);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  // Inject receipt_id if missing
  if (parsed && typeof parsed === "object" && !(parsed as Record<string, unknown>).receipt_id) {
    (parsed as Record<string, unknown>).receipt_id = uuidv4();
  }

  // Validate
  const firstValidation = validateReceiptSchema(parsed);

  if (firstValidation.valid) {
    return {
      receipt: firstValidation.sanitized!,
      raw_response: firstContent,
      retried: false,
    };
  }

  // --- Retry with repair prompt ---
  console.log(
    `[Receipt OpenAI] First attempt had ${firstValidation.errors.length} lint errors, retrying...`
  );

  const repairPrompt = `Your previous response had these schema validation errors:
${firstValidation.errors.map((e) => `- ${e}`).join("\n")}

Fix ONLY these issues and return the corrected complete JSON. Keep all other content the same. Return ONLY the JSON object.`;

  messages.push({ role: "assistant", content: firstContent });
  messages.push({ role: "user", content: repairPrompt });

  const retryResponse = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const retryContent = retryResponse.choices[0]?.message?.content || "{}";
  let retryParsed: unknown;

  try {
    retryParsed = JSON.parse(retryContent);
  } catch {
    // Return first attempt if retry is unparseable
    return {
      receipt: parsed as ListingReceipt,
      raw_response: firstContent,
      retried: true,
    };
  }

  // Inject receipt_id if missing
  if (retryParsed && typeof retryParsed === "object" && !(retryParsed as Record<string, unknown>).receipt_id) {
    (retryParsed as Record<string, unknown>).receipt_id = uuidv4();
  }

  const retryValidation = validateReceiptSchema(retryParsed);

  // Return the better result (retry if it passed, otherwise first)
  if (retryValidation.valid || retryValidation.errors.length < firstValidation.errors.length) {
    return {
      receipt: (retryValidation.sanitized || retryParsed) as ListingReceipt,
      raw_response: retryContent,
      retried: true,
    };
  }

  return {
    receipt: (firstValidation.sanitized || parsed) as ListingReceipt,
    raw_response: firstContent,
    retried: true,
  };
}

// --- Formatting Fixer ---

/**
 * Lightweight fix for text-format lint errors only.
 * Rewrites receipt_reddit_text, verdict_reason, negotiation_opener
 * to match length constraints. Does NOT touch arrays or structured data.
 */
export async function fixReceiptFormatting(
  receipt: Record<string, unknown>,
  errors: string[]
): Promise<Record<string, unknown> | null> {
  // Only fix text-length errors
  const textFieldErrors = errors.filter(
    (e) =>
      e.includes("receipt_reddit_text") ||
      e.includes("verdict_reason") ||
      e.includes("negotiation_opener") ||
      e.includes("rationale")
  );

  if (textFieldErrors.length === 0) return null;

  const fixPrompt = `The following receipt JSON has text fields that violate length constraints:

${textFieldErrors.map((e) => `- ${e}`).join("\n")}

Current values:
- verdict_reason (4-180 chars): "${receipt.verdict_reason || ""}"
- negotiation_opener (8-420 chars): "${receipt.negotiation_opener || ""}"
- receipt_reddit_text (40-1200 chars): "${receipt.receipt_reddit_text || ""}"
- operator_notes.rationale (10-500 chars): "${(receipt.operator_notes as Record<string, unknown>)?.rationale || ""}"

Return a JSON object with ONLY the fixed fields. Example: { "verdict_reason": "...", "receipt_reddit_text": "..." }
Fix ONLY the fields mentioned in the errors. Keep the content meaning identical, just adjust the length.
Return ONLY the JSON object.`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: "You fix text field lengths in JSON. Return ONLY a JSON object with the corrected fields." },
        { role: "user", content: fixPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const fixes = JSON.parse(content);
    if (!fixes || typeof fixes !== "object") return null;

    // Merge fixes into receipt (only allowed fields)
    const patched = { ...receipt };
    const allowedFields = ["verdict_reason", "negotiation_opener", "receipt_reddit_text"];

    for (const field of allowedFields) {
      if (fixes[field] && typeof fixes[field] === "string") {
        patched[field] = fixes[field];
      }
    }

    // Handle nested operator_notes.rationale
    if (fixes.rationale && typeof fixes.rationale === "string" && patched.operator_notes) {
      patched.operator_notes = {
        ...(patched.operator_notes as Record<string, unknown>),
        rationale: fixes.rationale,
      };
    }

    return patched;
  } catch (err) {
    console.error("[Receipt OpenAI] Formatting fixer failed:", err);
    return null;
  }
}
