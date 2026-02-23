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
import { validateReceiptSchema, sanitizeTextField } from "@/lib/receipt-schema-validator";
import { classifyVehicle } from "@/lib/vehicle-classifier";
import { getTemplatePack } from "@/lib/vehicle-category-templates";
import { scoreFallbackReceipt } from "@/lib/receipt-scoring";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 25_000,       // 25s — generous; streaming keeps connection alive
  maxRetries: 0,         // We handle retries ourselves; don't let the SDK retry silently
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Time budget: skip retry if first call already consumed most of the allowed time
const TIME_BUDGET_MS = 8000;

// ---------------------------------------------------------------------------
// Streaming helper — collects streamed chunks into a single string.
// Streaming avoids the full-response SDK timeout and keeps the Netlify
// connection alive with incremental data.
// ---------------------------------------------------------------------------

async function streamCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  opts: { model?: string; temperature?: number; max_tokens?: number } = {},
): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number } | null }> {
  const stream = await openai.chat.completions.create({
    model: opts.model || MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.max_tokens ?? 1800,
    response_format: { type: "json_object" },
    stream: true,
    stream_options: { include_usage: true },
  });

  const chunks: string[] = [];
  let usage: { prompt_tokens: number; completion_tokens: number } | null = null;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) chunks.push(delta);
    if (chunk.usage) {
      usage = {
        prompt_tokens: chunk.usage.prompt_tokens,
        completion_tokens: chunk.usage.completion_tokens,
      };
    }
  }

  return { content: chunks.join(""), usage };
}

// --- System Prompt ---

const SYSTEM_PROMPT = `You are OFFO Receipt Bot. Analyze a car listing → return a JSON receipt with risks, questions, and a Reddit draft. Present facts neutrally; never tell the buyer what to do.

Return ONLY valid JSON. No markdown, no explanation.

SCHEMA:
{"schema_version":"v1","receipt_id":"<UUID v4>","mode":"single","verdict":"GREEN|YELLOW|RED","verdict_reason":"4-180ch","price_sanity":{"label":"UNDERPRICED|FAIR|OVERPRICED|UNKNOWN","confidence":0.0-1.0,"basis":"LISTING_ONLY|USER_MARKET_RANGE|UNKNOWN","rationale_short":"4-180ch","user_market_range":null},"risk_flags":["1-120ch","1-120ch","1-120ch"],"must_answer_questions":["1-140ch","1-140ch","1-140ch"],"inspect_first":["1-140ch",x5],"negotiation_opener":"8-420ch","one_followup_question":"max160ch or null","reddit_draft":{"title":"10-200ch, starts with year/make/model+price","body_facts":["5-200ch",1-5 items],"body_uncertainty":["5-200ch",0-3],"body_next_steps":["5-200ch",0-3],"questions":["10-200ch, EXACTLY 1"],"style":{"format":"short_paragraph","max_questions":1}},"receipt_details":{"fee_estimates":{"currency":"USD","notes":"max220ch","tax_estimate_range":{"low":N,"high":N}|null,"doc_fee_estimate_range":{"low":N,"high":N}|null},"common_listing_tricks":["1-140ch",3-10],"walk_away_triggers":["1-140ch",3-10]},"compare":null,"operator_notes":{"rationale":"10-500ch","assumptions":["1-120ch",0-6],"what_would_change_verdict":["1-140ch",0-4]},"listing_summary":{"listing_url":"str","url_domain":"str","country":"US|UK|CA|AU|OTHER","zip_or_postcode":"str","price":N,"currency":"str","mileage":N,"mileage_unit":"mi|km|unknown","year":N,"make":"str","model":"str","trim":"str|null","seller_type":"dealer|private|unknown","title_status":"clean|salvage|rebuilt|unknown","accidents_reported":"yes|no|unknown","service_history":"yes|no|unknown","owners":N|null,"carfax_available":"yes|no|unknown","financing_vs_cash":"financing|cash|unknown"},"listing_signals":["signal_id",...]}

ARRAY COUNTS (linter enforced): risk_flags=3, must_answer_questions=3, inspect_first=5, reddit_draft.questions=1. listing_signals=3-20.

RULES:
- reddit_draft body: first-person buyer voice ("I plan to...", "I wasn't able to confirm..."). Never imperative ("Check the...", "Verify...").
- Only 1 question mark total in the entire reddit_draft. Question must target the biggest risk_flag for this specific listing.
- No verdict language (good deal, bad deal, buy it, skip it, hard pass, avoid, must buy, steer you, I'd lean).
- No "annoying" (use stressful). No smart quotes. No markdown * or _. No URLs. Use "or" not "/".
- Cautious language: "may", "worth verifying", "tends to" — not "will", "definitely", "always".
- DCFC: if DCFC_SUPPORT=unknown, say "confirm DC fast charging support" — don't assume it.
- Location: if ambiguous, say "local listing" — don't guess a city.
- GREEN=fair price+no red flags. YELLOW=concerns or missing info. RED=major red flags or overpriced.
- Tone: direct, specific, concrete numbers. Like a friend who's bought 50 cars.

SIGNAL LIBRARY — use exact IDs in listing_signals[]:
Hard blockers: title_salvage, frame_damage_major, routine_impossible, dcfc_required_but_absent, odometer_title_mismatch
Fit penalties: no_home_charging, single_site_dependency, plan_b_weak, winter_high_exposure, longest_day_tight_buffer, public_charging_cost_risk, multi_driver_one_charger, price_over_market_10_15, price_over_market_15_plus, prior_damage_minor, ownership_turnover_high, battery_replaced_unverified, dealer_addon_pressure, model_known_limit_vs_routine
Evidence bonuses: clean_title_explicit, battery_report_recent, battery_warranty_info, service_records_shown, dcfc_confirmed, charging_port_photo, vin_decoded, ownership_history_clear, fees_disclosed, tire_condition_visible, recall_status_clear
Evidence penalties: battery_proof_missing, battery_warranty_unclear, service_records_missing, dcfc_unclear, ownership_history_unclear, fees_unclear, tire_condition_unclear, title_status_unclear, vin_missing

SIGNAL RULES:
- Include EVERY signal that applies. Err on the side of including more signals.
- Hard blockers: only if strong evidence. Evidence bonuses: only if listing explicitly shows it. Evidence penalties: if listing does NOT address it.
- "Not mentioned" = the corresponding "missing" or "unclear" penalty applies.`;

// --- User Prompt Builder ---

function buildUserPrompt(input: ReceiptGenerateRequest): string {
  const parts: string[] = ["ANALYZE THIS LISTING:", ""];

  if (input.listing_url) {
    parts.push(`LISTING URL: ${input.listing_url}`);
    parts.push("");
  }

  if (input.listing_text) {
    const trimmed = input.listing_text.substring(0, 3500);
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
  if (input.price) {
    const priceStr = input.region === "UK"
      ? `£${input.price.toLocaleString()}`
      : `$${input.price.toLocaleString()}`;
    fields.push(`Asking Price: ${priceStr}`);
  }
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

  // Region-specific instructions
  if (input.region === "UK") {
    parts.push("REGION: UK");
    parts.push("- Use GBP (£) for all prices and fee estimates.");
    parts.push("- Use UK terminology: V5C (not title), MOT (not inspection), dealer extras (not doc fees), HPI check (not Carfax).");
    parts.push("- If estimating fees, use UK ranges (admin fees £99-£299, VAT 20%).");
    parts.push("- Do not reference US-specific paperwork or pricing patterns.");
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

  const firstResponse = await streamCompletion(messages, {
    temperature: 0.3,
    max_tokens: 1800,
  });

  const firstContent = firstResponse.content || "{}";
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

  const retryResponse = await streamCompletion(messages, {
    temperature: 0.2,
    max_tokens: 1800,
  });

  const retryContent = retryResponse.content || "{}";
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

  // Derive verdict from structured fields instead of hardcoding YELLOW
  const scoring = scoreFallbackReceipt({
    title_status: input.title_status,
    service_history: input.service_history,
    accidents_reported: input.accidents_reported,
    owners: input.owners,
    carfax_available: input.carfax_available,
    vin: input.vin,
  });

  return {
    receipt_id: uuidv4(),
    schema_version: "v1",
    mode: "single",
    verdict: scoring.verdict,
    verdict_reason: `AI analysis timed out for this ${label}. Scores based on available listing data.`,
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
    // Scoring fields from deterministic engine
    listing_signals: [],
    fit_score: scoring.fit_score,
    evidence_score: scoring.evidence_score,
    evidence_label: scoring.evidence_label,
    scoring_reasons: scoring.scoring_reasons,
    why_not_green: scoring.why_not_green,
    verify_before_visit: scoring.verify_before_visit,
  } as ListingReceipt;
}

// --- Deterministic Fix Pre-Pass ---

/**
 * Try deterministic fixes on a receipt that passed Zod but failed lint.
 * Text sanitization now runs inside validateReceiptSchema(), so we just
 * re-validate the raw object to pick up those fixes.
 * Returns { fixed: true, receipt } if all lint errors are resolved, otherwise { fixed: false }.
 */
function applyDeterministicFixesToReceipt(
  parsed: unknown,
  validation: { sanitized: unknown; lintErrors: LintError[] }
): { fixed: boolean; receipt: unknown } {
  if (!validation.sanitized || validation.lintErrors.length === 0) {
    return { fixed: false, receipt: parsed };
  }

  // Re-validate — sanitizeReceiptTextFields runs inside validateReceiptSchema
  const revalidation = validateReceiptSchema(validation.sanitized);
  if (revalidation.valid) {
    return { fixed: true, receipt: revalidation.sanitized || validation.sanitized };
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
  const fixedText = sanitizeTextField(originalText);

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

// --- Deep Dive Generation (Paid pack content) ---

import type { PackTier } from "@/lib/price-assignment";

const DEEP_DIVE_MODEL = "gpt-4o";
const STARTER_DIVE_MODEL = "gpt-4o-mini";

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

const STARTER_DIVE_SYSTEM_PROMPT = `You are OFFO Starter Analyst, part of OFFO Lab's used-car analysis engine.

Given a base receipt (the free-tier analysis), produce a focused starter analysis with:
1. Extended inspection checklist (10 items, specific to this vehicle)
2. Negotiation scripts (3 scenarios)
3. Deep verdict (expanded reasoning)

OUTPUT: Return ONLY a valid JSON object matching this schema:
{
  "extended_inspection": ["<specific check item, 10-160 chars>", ...],
  "negotiation_scripts": [
    { "scenario": "<2-6 word scenario name>", "opening": "<opening line, 20-200 chars>", "body": "<full script, 40-600 chars>" }
  ],
  "verdict_deep": "<expanded verdict with reasoning, 100-800 chars>"
}

CONSTRAINTS:
- extended_inspection: EXACTLY 10 items. Specific to this vehicle's make/model/drivetrain.
- negotiation_scripts: EXACTLY 3 scenarios (e.g., "Cash offer", "Trade-in leverage", "Found issues").
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
 * Generate a deep dive analysis for a paid pack.
 * - decision_pack: full deep dive with gpt-4o (market comparison, cost, known issues, etc.)
 * - starter_pack: focused starter analysis with gpt-4o-mini (inspection, negotiation, verdict only)
 */
export async function generateDeepDive(
  baseReceipt: ListingReceipt,
  tier: PackTier = "decision_pack"
): Promise<DeepDiveContent> {
  const userPrompt = buildDeepDiveUserPrompt(baseReceipt);

  const isStarter = tier === "starter_pack";
  const model = isStarter ? STARTER_DIVE_MODEL : DEEP_DIVE_MODEL;
  const systemPrompt = isStarter ? STARTER_DIVE_SYSTEM_PROMPT : DEEP_DIVE_SYSTEM_PROMPT;

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: isStarter ? 2000 : 4000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content) as Partial<DeepDiveContent>;

  // Validation: starter only requires inspection, negotiation, verdict
  if (!parsed.extended_inspection || !Array.isArray(parsed.extended_inspection)) {
    throw new Error("Deep dive missing extended_inspection");
  }
  if (!parsed.negotiation_scripts || !Array.isArray(parsed.negotiation_scripts)) {
    throw new Error("Deep dive missing negotiation_scripts");
  }
  if (!parsed.verdict_deep) {
    throw new Error("Deep dive missing verdict_deep");
  }

  if (!isStarter) {
    // Full pack requires all fields
    if (!parsed.market_comparison || !Array.isArray(parsed.market_comparison)) {
      throw new Error("Deep dive missing market_comparison");
    }
    if (!parsed.cost_of_ownership) {
      throw new Error("Deep dive missing cost_of_ownership");
    }
  }

  // Fill empty arrays/defaults for starter pack to match DeepDiveContent shape
  const result: DeepDiveContent = {
    market_comparison: parsed.market_comparison || [],
    extended_inspection: parsed.extended_inspection,
    negotiation_scripts: parsed.negotiation_scripts,
    cost_of_ownership: parsed.cost_of_ownership || {
      insurance_yr: 0,
      maintenance_yr: 0,
      fuel_or_charging_yr: 0,
      depreciation_yr: 0,
      total_3yr: 0,
    },
    model_known_issues: parsed.model_known_issues || [],
    verdict_deep: parsed.verdict_deep,
  };

  return result;
}
