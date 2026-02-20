/**
 * OFFO Listing Receipt — OpenAI Integration
 *
 * Constructs prompts, calls OpenAI, parses JSON response.
 * Server-side only (used in API routes).
 */

import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import type { ListingReceipt, ReceiptGenerateRequest, DeepDiveContent } from "@/types/receipt";
import type { LintError } from "@/lib/receipt-schema-validator";
import { validateReceiptSchema } from "@/lib/receipt-schema-validator";
import { classifyVehicle } from "@/lib/vehicle-classifier";
import { getTemplatePack } from "@/lib/vehicle-category-templates";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Time budget: skip retry if first call already consumed most of the allowed time
const TIME_BUDGET_MS = 8000;

// --- System Prompt ---

const SYSTEM_PROMPT = `You are OFFO Receipt Bot, a used-car listing analyst built by OFFO Lab.

YOUR JOB: Analyze a car listing and produce a structured JSON "receipt" that helps a buyer understand the listing, identify risks, and draft a Reddit post to ask the community for opinions.

Do NOT tell the user what to do. Present facts and uncertainties. Let the community give advice.

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
  "reddit_draft": {
    "title": "<string, 10-200 chars: starts with year/make/model and price, ends with a short hook>",
    "body_facts": ["<verified facts from the listing, 5-200 chars each, 1-5 items>"],
    "body_uncertainty": ["<first-person buyer voice: what I could not confirm, e.g. 'I was not able to find service records in the listing', 5-200 chars each, 0-3 items>"],
    "body_next_steps": ["<first-person buyer voice: what I plan to verify next, e.g. 'I plan to have the battery health tested before committing', 5-200 chars each, 0-3 items>"],
    "questions": ["<EXACTLY 1 specific question for the community, 10-200 chars>"],
    "style": { "format": "short_paragraph", "max_questions": 1 }
  },
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
    "carfax_available": "yes" | "no" | "unknown",
    "financing_vs_cash": "financing" | "cash" | "unknown"
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
- operator_notes.rationale: 10-500 characters
- reddit_draft.title: 10-200 characters, starts with the vehicle and price
- reddit_draft.body_facts: 1-5 items, each 5-200 characters
- reddit_draft.body_uncertainty: 0-3 items, each 5-200 characters
- reddit_draft.body_next_steps: 0-3 items, each 5-200 characters
- reddit_draft.questions: EXACTLY 1 item, 10-200 characters

REDDIT DRAFT TONE RULES:
- Never use verdict language: "good deal", "bad deal", "buy it", "skip it", "you should", "I'd lean", "I would lean", "great deal", "terrible deal", "don't buy", "do not buy", "must buy", "hard pass", "steer you", "avoid"
- Never use "annoying" (use "stressful" instead)
- No quotation marks of any kind in receipt_reddit_text or negotiation_opener (no " or ')
- No absolute claims. Use cautious language: "may", "adds uncertainty", "worth verifying", "tends to" instead of "will", "definitely", "always", "indicates"
- Present facts neutrally. The buyer is asking for opinions, not being told what to do.
- Use concrete numbers and specifics from the listing.
- No smart/curly quotes — use straight quotes only.
- No markdown italic markers (* or _).
- No URLs in the text.
- No slashes as alternates (use "or" instead of "/").

FIRST-PERSON VOICE (mandatory):
- All body text must be written from the buyer's perspective using "I" or "my".
- body_next_steps: "I plan to...", "I'm going to check...", "I was advised to inspect..."
- body_uncertainty: "I wasn't able to confirm...", "The listing doesn't mention...", "I'm not sure about..."
- Never use imperative or instructional voice: NOT "Check the battery", "Verify the title", "Look for rust"
- The title can remain neutral (vehicle + price + hook).

REDDIT DRAFT QUESTION RULES:
- EXACTLY 1 question across the entire draft (title + body combined). Total count of ? must be <= 1.
- The question must address the biggest decision uncertainty from your risk_flags, specific to THIS listing.
- No generic questions. Use the vehicle category for focus: EV: battery or charging concern. PHEV: battery condition and engine concern. ICE: mechanical or service concern. Truck: frame or towing concern.

DCFC GATING RULE:
- If DCFC_SUPPORT in the user prompt is "unknown", do NOT recommend finding nearby DC fast chargers or assume the vehicle supports DC fast charging.
- Instead, frame it as: "confirm whether DC fast charging is supported and which connector."
- Only mention DCFC stations or speed if DCFC_SUPPORT is "yes".

LOCATION RULE:
- If location data is ambiguous or conflicting (e.g., ZIP suggests one city but listing text mentions another), do not mention a specific city. Use "local listing" or omit location entirely.
- Only use location data you are confident about.

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
  if (input.seller_type && input.seller_type !== "unknown")
    fields.push(`Seller type: ${input.seller_type}`);
  if (input.title_status && input.title_status !== "unknown")
    fields.push(`Title status: ${input.title_status}`);
  if (input.accidents_reported && input.accidents_reported !== "unknown")
    fields.push(`Accidents reported: ${input.accidents_reported}`);
  if (input.service_history && input.service_history !== "unknown")
    fields.push(`Service history: ${input.service_history}`);
  if (input.owners) fields.push(`Previous owners: ${input.owners}`);
  if (input.carfax_available && input.carfax_available !== "unknown")
    fields.push(`Carfax available: ${input.carfax_available}`);
  if (input.financing_vs_cash && input.financing_vs_cash !== "unknown")
    fields.push(`Payment method: ${input.financing_vs_cash}`);
  if (input.country) fields.push(`Country: ${input.country}`);
  if (input.zip_or_postcode) fields.push(`ZIP/Postcode: ${input.zip_or_postcode}`);

  if (fields.length > 0) {
    parts.push("KNOWN DETAILS:");
    for (const f of fields) {
      parts.push(`- ${f}`);
    }
    parts.push("");
  }

  // Vehicle category injection
  const classification = classifyVehicle(
    input.make || "",
    input.model || "",
    input.trim,
    input.listing_text
  );
  const pack = getTemplatePack(classification);

  parts.push(`VEHICLE CATEGORY: ${classification.category} (${classification.subCategory})`);
  parts.push(`FOCUS AREAS: ${pack.focusAreas.join(", ")}`);

  // DCFC support injection for EVs
  if (classification.category === "EV") {
    const dcfc = classification.dcfcSupport;
    if (dcfc === "yes") {
      parts.push(`DCFC_SUPPORT: yes`);
    } else if (dcfc === "no") {
      parts.push(`DCFC_SUPPORT: no (this vehicle does NOT support DC fast charging)`);
    } else {
      parts.push(`DCFC_SUPPORT: unknown (confirm capability first — do NOT assume DCFC is available)`);
    }
  }
  parts.push("");

  // Location conflict detection
  if (input.location && input.zip_or_postcode) {
    parts.push(
      `NOTE: Both location ("${input.location}") and ZIP/postcode ("${input.zip_or_postcode}") were provided. These may conflict. Use only confirmed location data in reddit_draft. If uncertain, say "local listing" instead of a specific city.`
    );
    parts.push("");
  }

  // Missing data notice
  const TOP_6 = ["year", "make", "model", "price", "mileage", "location"] as const;
  const populated = TOP_6.filter(
    (k) => (input as unknown as Record<string, unknown>)[k]
  );
  if (populated.length < TOP_6.length) {
    const missing = TOP_6.filter((k) => !populated.includes(k));
    parts.push(
      `NOTE: Missing listing details: ${missing.join(", ")}. Acknowledge this in reddit_draft.body_uncertainty.`
    );
    parts.push("");
  }

  parts.push("Generate the receipt JSON now. Return ONLY the JSON object.");

  return parts.join("\n");
}

// --- Main Generate Function ---

export async function generateReceipt(
  input: ReceiptGenerateRequest
): Promise<{ receipt: ListingReceipt; raw_response: string; retried: boolean }> {
  const startTime = Date.now();
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
    max_tokens: 2500,
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

  // --- Try deterministic fixes before expensive retry ---
  const deterministicResult = applyDeterministicFixesToReceipt(parsed, firstValidation);
  if (deterministicResult.fixed) {
    console.log("[Receipt OpenAI] Deterministic fixes resolved all lint errors, skipping retry");
    return {
      receipt: deterministicResult.receipt as ListingReceipt,
      raw_response: firstContent,
      retried: false,
    };
  }

  // --- Skip retry if time budget exhausted ---
  const elapsed = Date.now() - startTime;
  if (elapsed > TIME_BUDGET_MS) {
    console.log(
      `[Receipt OpenAI] First attempt took ${elapsed}ms (budget: ${TIME_BUDGET_MS}ms), skipping retry`
    );
    return {
      receipt: (firstValidation.sanitized || parsed) as ListingReceipt,
      raw_response: firstContent,
      retried: false,
    };
  }

  // --- Retry with repair prompt ---
  console.log(
    `[Receipt OpenAI] First attempt had ${firstValidation.errors.length} lint errors, retrying... (${elapsed}ms elapsed)`
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
    max_tokens: 2500,
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

// --- Fallback Receipt (no AI call) ---

/**
 * Builds a minimal receipt from structured input fields when the AI call
 * times out or fails. Returns a YELLOW verdict with generic checklist items.
 */
export function buildFallbackReceipt(input: ReceiptGenerateRequest): ListingReceipt {
  const year = input.year || 0;
  const make = input.make || "Unknown";
  const model = input.model || "Vehicle";
  const price = input.price || 0;
  const mileage = input.mileage || 0;
  const label = `${year > 0 ? year + " " : ""}${make} ${model}`;
  const priceStr = price > 0 ? `$${price.toLocaleString()}` : "unlisted price";

  return {
    receipt_id: uuidv4(),
    schema_version: "v1",
    mode: "single",
    verdict: "YELLOW",
    verdict_reason: `AI analysis timed out for this ${label}. Basic receipt generated from listing data.`,
    price_sanity: {
      label: "UNKNOWN",
      confidence: 0,
      basis: "UNKNOWN",
      rationale_short: "AI analysis was unavailable — price not evaluated",
      user_market_range: null,
    },
    risk_flags: [
      "AI analysis timed out — regenerate for full risk assessment",
      "Verify title status and accident history independently",
      "Check service records and maintenance history before purchase",
    ],
    must_answer_questions: [
      "Has this vehicle been in any accidents or had major repairs?",
      "Is the title clean, and are there any liens on the vehicle?",
      "Can the seller provide recent maintenance or inspection records?",
    ],
    inspect_first: [
      "Check for uneven panel gaps or paint mismatches indicating body work",
      "Inspect tire wear patterns for alignment or suspension issues",
      "Test all electronics, AC, and infotainment systems",
      "Look under the vehicle for rust, fluid leaks, or frame damage",
      "Take it for a test drive on highway and listen for unusual noises",
    ],
    negotiation_opener: price > 0
      ? `I am interested in the ${label} listed at ${priceStr}. Before we discuss price further, I would like to verify a few details about the vehicle history and condition.`
      : `I am interested in the ${label}. Before we discuss terms, I would like to verify a few details about the vehicle history and condition.`,
    one_followup_question: null,
    receipt_reddit_text: `${label} at ${priceStr} — looking for community input.\n\nThis is a basic receipt generated from listing data. AI analysis was unavailable, so no detailed risk assessment or pricing analysis is included. Key details worth confirming include title status, accident history, and maintenance records.\n\nHas anyone had experience with this vehicle and what should I watch out for?`,
    reddit_draft: null,
    listing_summary: {
      listing_url: input.listing_url || "",
      url_domain: input.listing_url ? (() => { try { return new URL(input.listing_url).hostname.replace("www.", ""); } catch { return ""; } })() : "",
      country: input.country || "US",
      zip_or_postcode: input.zip_or_postcode || "",
      price,
      currency: "USD",
      mileage,
      mileage_unit: "mi",
      year,
      make,
      model,
      trim: input.trim || null,
      seller_type: input.seller_type || "unknown",
      title_status: input.title_status || "unknown",
      accidents_reported: input.accidents_reported || "unknown",
      service_history: input.service_history || "unknown",
      owners: input.owners || null,
      carfax_available: input.carfax_available || "unknown",
    },
    receipt_details: null,
    compare: null,
    operator_notes: {
      rationale: `AI analysis timed out after the model took too long to respond. This fallback receipt was generated from the structured fields provided. Regenerate for a complete AI-powered analysis.`,
      assumptions: [
        "All listing details taken at face value from user input",
        "No independent price or market analysis performed",
      ],
      what_would_change_verdict: [
        "A clean Carfax and service records could move this toward GREEN",
        "Accident history or title issues could move this toward RED",
      ],
    },
  } as ListingReceipt;
}

// --- Deterministic Fix Pre-Pass ---

/**
 * Apply regex-based fixes that don't need an AI call.
 * Returns the fixed text.
 */
function applyDeterministicFixes(text: string): string {
  let out = text;
  // "annoying" → "stressful"
  out = out.replace(/\bannoying\b/gi, "stressful");
  // Smart quotes → straight quotes
  out = out.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
  out = out.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  // Absolute claims filter
  out = out.replace(/\bwill\b/gi, "may");
  out = out.replace(/\bdefinitely\b/gi, "");
  out = out.replace(/\balways\b/gi, "often");
  out = out.replace(/\bindicates\b/gi, "can suggest");
  out = out.replace(/\btoo good to be true\b/gi, "priced lower than expected");
  // Quotation marks removal
  out = out.replace(/["']/g, "");
  // Clean up double spaces from removals
  out = out.replace(/  +/g, " ").trim();
  return out;
}

/**
 * Try deterministic regex fixes on a receipt that passed Zod but failed lint.
 * Returns { fixed: true, receipt } if all lint errors are resolved, otherwise { fixed: false }.
 */
function applyDeterministicFixesToReceipt(
  parsed: unknown,
  validation: { sanitized: unknown; lintErrors: LintError[] }
): { fixed: boolean; receipt: unknown } {
  if (!validation.sanitized || validation.lintErrors.length === 0) {
    return { fixed: false, receipt: parsed };
  }
  const record = { ...(validation.sanitized as Record<string, unknown>) };
  const text = (record.receipt_reddit_text as string) || "";
  if (!text) return { fixed: false, receipt: parsed };

  const fixedText = applyDeterministicFixes(text);
  if (fixedText === text) return { fixed: false, receipt: parsed };

  record.receipt_reddit_text = fixedText;
  const revalidation = validateReceiptSchema(record);
  if (revalidation.valid) {
    return { fixed: true, receipt: revalidation.sanitized || record };
  }
  return { fixed: false, receipt: parsed };
}

// --- Formatting Fixer ---

/**
 * Lightweight fix for lint errors.
 * First applies deterministic regex fixes. If that resolves all issues,
 * skips the OpenAI call entirely. Otherwise calls AI for remaining fixes.
 */
export async function fixReceiptFormatting(
  receipt: Record<string, unknown>,
  lintErrors: LintError[]
): Promise<Record<string, unknown> | null> {
  if (lintErrors.length === 0) return null;

  // Step 1: Try deterministic fixes first
  const deterministicCodes = new Set([
    "SMART_QUOTES",
    "BANNED_WORD_ANNOYING",
    "ABSOLUTE_CLAIMS",
    "QUOTATION_MARKS",
  ]);
  const originalText = (receipt.receipt_reddit_text as string) || "";
  const fixedText = applyDeterministicFixes(originalText);

  const remainingErrors = lintErrors.filter((e) => !deterministicCodes.has(e.code));
  const deterministicChanged = fixedText !== originalText;

  // If deterministic fixes resolved everything, skip AI call
  if (remainingErrors.length === 0 && deterministicChanged) {
    return { ...receipt, receipt_reddit_text: fixedText };
  }

  // Step 2: AI fix for remaining errors
  const textToFix = deterministicChanged ? fixedText : originalText;
  const errorsToFix = remainingErrors.length > 0 ? remainingErrors : lintErrors;

  const errorList = errorsToFix
    .map((e) => `- [${e.code}] ${e.message}`)
    .join("\n");

  const fixPrompt = `The following receipt JSON has lint violations in its receipt_reddit_text field:

${errorList}

Current receipt_reddit_text:
"${textToFix}"

RULES for the fixed text:
- Max 900 characters
- Replace smart/curly quotes with straight quotes
- Remove markdown italic markers (* and _)
- Replace word/word patterns with "or" (e.g. "buy/lease" → "buy or lease")
- Max 1 question mark total
- No URLs (remove any http/https/www links)
- No promo terms (sign up, subscribe, dm me, check out, my tool, try our, link in bio)
- No verdict language: "good deal", "bad deal", "buy it", "skip it", "you should", "I'd lean", "great deal", "terrible deal", "don't buy", "must buy", "hard pass", "steer you", "avoid"
- Never use "annoying" (use "stressful" instead)
- Keep the same factual content and neutral tone
- Present facts and uncertainties — do NOT tell the user what to do

Return a JSON object with ONLY the fixed field: { "receipt_reddit_text": "..." }
Return ONLY the JSON object.`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You fix text lint violations in JSON. Return ONLY a JSON object with the corrected field.",
        },
        { role: "user", content: fixPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return deterministicChanged ? { ...receipt, receipt_reddit_text: fixedText } : null;

    const fixes = JSON.parse(content);
    if (!fixes || typeof fixes !== "object") return deterministicChanged ? { ...receipt, receipt_reddit_text: fixedText } : null;

    // Merge fixes into receipt (only allowed fields)
    const patched = { ...receipt };
    if (deterministicChanged) {
      patched.receipt_reddit_text = fixedText;
    }

    const allowedFields = [
      "verdict_reason",
      "negotiation_opener",
      "receipt_reddit_text",
    ];

    for (const field of allowedFields) {
      if (fixes[field] && typeof fixes[field] === "string") {
        patched[field] = fixes[field];
      }
    }

    // Handle nested operator_notes.rationale
    if (
      fixes.rationale &&
      typeof fixes.rationale === "string" &&
      patched.operator_notes
    ) {
      patched.operator_notes = {
        ...(patched.operator_notes as Record<string, unknown>),
        rationale: fixes.rationale,
      };
    }

    return patched;
  } catch (err) {
    console.error("[Receipt OpenAI] Formatting fixer failed:", err);
    // Return deterministic fixes if available
    return deterministicChanged ? { ...receipt, receipt_reddit_text: fixedText } : null;
  }
}

// --- Deep Dive Generation (Decision Pack paid content) ---

const DEEP_DIVE_MODEL = "gpt-4o";

const DEEP_DIVE_SYSTEM_PROMPT = `You are OFFO Deep Dive Analyst, a paid upgrade tier of OFFO Lab's used-car analysis engine.

Given a base receipt (the free-tier analysis), produce an EXPANDED deep dive analysis with:
1. Market comparison (3-5 similar listings)
2. Extended inspection checklist (10 items, specific to this vehicle)
3. Negotiation scripts (3 scenarios)
4. 3-year cost of ownership estimate
5. Model-specific known issues
6. Deep verdict (expanded reasoning)

OUTPUT: Return ONLY a valid JSON object matching this schema:
{
  "market_comparison": [
    { "title": "<year make model trim>", "price": <number>, "mileage": <number>, "source": "<marketplace name>", "delta_pct": <number, percent difference from listing> }
  ],
  "extended_inspection": ["<specific check item, 10-160 chars>", ...],
  "negotiation_scripts": [
    { "scenario": "<2-6 word scenario name>", "opening": "<opening line, 20-200 chars>", "body": "<full script, 40-600 chars>" }
  ],
  "cost_of_ownership": {
    "insurance_yr": <number, annual estimate USD>,
    "maintenance_yr": <number>,
    "fuel_or_charging_yr": <number>,
    "depreciation_yr": <number>,
    "total_3yr": <number, sum of all * 3>
  },
  "model_known_issues": ["<known issue specific to this year/make/model, 10-200 chars>", ...],
  "verdict_deep": "<expanded verdict with reasoning, 100-800 chars>"
}

CONSTRAINTS:
- market_comparison: 3-5 items. Use realistic comparable listings. delta_pct is (comp_price - listing_price) / listing_price * 100.
- extended_inspection: EXACTLY 10 items. Specific to this vehicle's make/model/drivetrain.
- negotiation_scripts: EXACTLY 3 scenarios (e.g., "Cash offer", "Trade-in leverage", "Found issues").
- cost_of_ownership: Realistic annual estimates in USD for the specific vehicle.
- model_known_issues: 3-8 items specific to this year/make/model/generation.
- verdict_deep: Synthesize all findings into actionable guidance.

Use concrete numbers. Be specific to the exact vehicle. No generic advice.`;

function buildDeepDiveUserPrompt(baseReceipt: ListingReceipt): string {
  const ls = baseReceipt.listing_summary;
  const parts: string[] = [
    "BASE RECEIPT ANALYSIS:",
    "",
    `Vehicle: ${ls.year} ${ls.make} ${ls.model}${ls.trim ? " " + ls.trim : ""}`,
    `Price: $${ls.price?.toLocaleString() || "unknown"}`,
    `Mileage: ${ls.mileage?.toLocaleString() || "unknown"} ${ls.mileage_unit || "mi"}`,
    `Location: ${ls.zip_or_postcode || ls.country || "unknown"}`,
    `Seller: ${ls.seller_type || "unknown"}`,
    `Title: ${ls.title_status || "unknown"}`,
    `Accidents: ${ls.accidents_reported || "unknown"}`,
    `Service history: ${ls.service_history || "unknown"}`,
    "",
    `Free-tier verdict: ${baseReceipt.verdict}`,
    `Verdict reason: ${baseReceipt.verdict_reason}`,
    "",
    `Risk flags:`,
    ...(baseReceipt.risk_flags || []).map((f) => `- ${f}`),
    "",
    `Must-ask questions:`,
    ...(baseReceipt.must_answer_questions || []).map((q) => `- ${q}`),
    "",
    `Inspect first:`,
    ...(baseReceipt.inspect_first || []).map((i) => `- ${i}`),
    "",
    `Price sanity: ${baseReceipt.price_sanity?.label} (confidence: ${baseReceipt.price_sanity?.confidence})`,
    `Price rationale: ${baseReceipt.price_sanity?.rationale_short || "N/A"}`,
    "",
    "Generate the deep dive JSON now. Return ONLY the JSON object.",
  ];

  return parts.join("\n");
}

/**
 * Generate a deep dive analysis for a paid Decision Pack.
 * Uses gpt-4o for higher quality than the free-tier mini model.
 */
export async function generateDeepDive(
  baseReceipt: ListingReceipt
): Promise<DeepDiveContent> {
  const userPrompt = buildDeepDiveUserPrompt(baseReceipt);

  const response = await openai.chat.completions.create({
    model: DEEP_DIVE_MODEL,
    messages: [
      { role: "system", content: DEEP_DIVE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content) as DeepDiveContent;

  // Basic validation
  if (!parsed.market_comparison || !Array.isArray(parsed.market_comparison)) {
    throw new Error("Deep dive missing market_comparison");
  }
  if (!parsed.extended_inspection || !Array.isArray(parsed.extended_inspection)) {
    throw new Error("Deep dive missing extended_inspection");
  }
  if (!parsed.negotiation_scripts || !Array.isArray(parsed.negotiation_scripts)) {
    throw new Error("Deep dive missing negotiation_scripts");
  }
  if (!parsed.cost_of_ownership) {
    throw new Error("Deep dive missing cost_of_ownership");
  }
  if (!parsed.verdict_deep) {
    throw new Error("Deep dive missing verdict_deep");
  }

  return parsed;
}
