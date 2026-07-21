/**
 * OFFO Listing Receipt — OpenAI Integration
 *
 * Constructs prompts, calls OpenAI, parses JSON response.
 * Server-side only (used in API routes).
 */

import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import { hedgedGenerate } from "@/lib/providers/hedged-generate";
import type { ListingReceipt, ReceiptGenerateRequest, DeepDiveContent } from "../types/receipt";
import type { LintError } from "./receipt-schema-validator";
import { validateReceiptSchema, sanitizeTextField } from "./receipt-schema-validator";
import { classifyVehicle } from "./vehicle-classifier";
import { getTemplatePack } from "./vehicle-category-templates";
import { scoreFallbackReceipt } from "./receipt-scoring";
import type { ReceiptScoringResult } from "./receipt-scoring";
import { RULES_BY_ID, type ListingSignalId } from "./receipt-rules";
import { getModelKnowledge } from "./vehicle-model-knowledge";
import { fetchNhtsaRecalls } from "./nhtsa-recall-client";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 55_000,  // 55s per call; runs in a Netlify Background Function (15 min limit)
      maxRetries: 0,
    });
  }
  return _openai;
}

// Minimum model for Structured Outputs support: gpt-4o-mini-2024-07-18
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

// Time budget: skip retry if first call already consumed most of the allowed time.
// Background function has 15 min; generous budget allows full retry on slow first calls.
const TIME_BUDGET_MS = 90_000;

// ---------------------------------------------------------------------------
// OpenAI Structured Outputs JSON Schema
//
// Covers only the fields the model produces directly. Fields injected by
// post-processing (fit_score, evidence_score, evidence_label, scoring_reasons,
// why_not_green, verify_before_visit, receipt_reddit_text) are omitted.
//
// Strict mode rules:
//   - All properties must be in `required`
//   - No `additionalProperties: true`
//   - Nullable fields use anyOf: [{ type }, { type: "null" }]
// ---------------------------------------------------------------------------

export const RECEIPT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version", "receipt_id", "mode", "verdict", "verdict_reason",
    "price_sanity", "risk_flags", "must_answer_questions", "inspect_first",
    "negotiation_opener", "one_followup_question",
    "listing_summary", "compare",
    "operator_notes", "listing_signals",
  ],
  properties: {
    schema_version: { type: "string" },
    receipt_id: { type: "string" },
    mode: { type: "string", enum: ["single", "compare"] },
    verdict: { type: "string", enum: ["GREEN", "YELLOW", "RED"] },
    verdict_reason: { type: "string" },
    price_sanity: {
      type: "object",
      additionalProperties: false,
      required: ["label", "confidence", "basis", "rationale_short", "user_market_range"],
      properties: {
        label: { type: "string", enum: ["UNDERPRICED", "FAIR", "OVERPRICED", "UNKNOWN"] },
        confidence: { type: "number" },
        basis: { type: "string", enum: ["LISTING_ONLY", "USER_MARKET_RANGE", "UNKNOWN"] },
        rationale_short: { type: "string" },
        user_market_range: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["low", "high", "currency"],
              properties: {
                low: { type: "number" },
                high: { type: "number" },
                currency: { type: "string" },
              },
            },
            { type: "null" },
          ],
        },
      },
    },
    risk_flags: { type: "array", items: { type: "string" } },
    must_answer_questions: { type: "array", items: { type: "string" } },
    inspect_first: { type: "array", items: { type: "string" } },
    negotiation_opener: { type: "string" },
    one_followup_question: { anyOf: [{ type: "string" }, { type: "null" }] },
    listing_summary: {
      type: "object",
      additionalProperties: false,
      required: [
        "listing_url", "url_domain", "country", "zip_or_postcode",
        "price", "currency", "mileage", "mileage_unit",
        "year", "make", "model", "trim", "seller_type", "title_status",
        "accidents_reported", "service_history", "owners",
        "carfax_available", "financing_vs_cash",
      ],
      properties: {
        listing_url: { type: "string" },
        url_domain: { type: "string" },
        country: { type: "string", enum: ["US", "UK", "CA", "AU", "OTHER"] },
        zip_or_postcode: { type: "string" },
        price: { type: "number" },
        currency: { type: "string" },
        mileage: { type: "number" },
        mileage_unit: { type: "string", enum: ["mi", "km", "unknown"] },
        year: { type: "number" },
        make: { type: "string" },
        model: { type: "string" },
        trim: { anyOf: [{ type: "string" }, { type: "null" }] },
        seller_type: { type: "string", enum: ["dealer", "private", "unknown"] },
        title_status: { type: "string", enum: ["clean", "salvage", "rebuilt", "lemon", "unknown"] },
        accidents_reported: { type: "string", enum: ["yes", "no", "unknown"] },
        service_history: { type: "string", enum: ["yes", "no", "unknown"] },
        owners: { anyOf: [{ type: "number" }, { type: "null" }] },
        carfax_available: { type: "string", enum: ["yes", "no", "unknown"] },
        financing_vs_cash: { type: "string", enum: ["financing", "cash", "unknown"] },
      },
    },
    compare: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["avg_price", "delta", "sample_size"],
          properties: {
            avg_price: { anyOf: [{ type: "number" }, { type: "null" }] },
            delta: { anyOf: [{ type: "number" }, { type: "null" }] },
            sample_size: { anyOf: [{ type: "number" }, { type: "null" }] },
          },
        },
        { type: "null" },
      ],
    },
    operator_notes: {
      type: "object",
      additionalProperties: false,
      required: ["rationale", "assumptions", "what_would_change_verdict"],
      properties: {
        rationale: { type: "string" },
        assumptions: { type: "array", items: { type: "string" } },
        what_would_change_verdict: { type: "array", items: { type: "string" } },
      },
    },
    listing_signals: { type: "array", items: { type: "string" } },
  },
} as const;

// ---------------------------------------------------------------------------
// Non-streaming structured completion using json_schema response format.
// Runs in the background function where there is no connection to keep alive.
// ---------------------------------------------------------------------------

async function callStructured(
  messages: OpenAI.ChatCompletionMessageParam[],
  opts: { temperature?: number; max_tokens?: number } = {},
): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number } | null }> {
  // Delegate to openai adapter — extracts system+user from messages array
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystemMsgs = messages.filter((m) => m.role !== "system");
  // Re-join non-system messages into a single user prompt for adapter compatibility
  const userContent = nonSystemMsgs
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("\n\n");

  const response = await getOpenAI().chat.completions.create({
    model: MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.max_tokens ?? 2400,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "receipt",
        strict: true,
        schema: RECEIPT_JSON_SCHEMA as Record<string, unknown>,
      },
    },
  });

  // Suppress unused variable warning
  void systemMsg; void userContent;

  return {
    content: response.choices[0]?.message?.content ?? "{}",
    usage: response.usage
      ? { prompt_tokens: response.usage.prompt_tokens, completion_tokens: response.usage.completion_tokens }
      : null,
  };
}

// --- System Prompt ---

export const SYSTEM_PROMPT = `You are OFFO Receipt Bot. Analyze a car listing → return a JSON receipt with risks, questions, and a seller strategy. Present facts neutrally; never tell the buyer what to do.

Return ONLY valid JSON. No markdown, no explanation.

SCHEMA:
{"schema_version":"v1","receipt_id":"<UUID v4>","mode":"single","verdict":"GREEN|YELLOW|RED","verdict_reason":"4-180ch","price_sanity":{"label":"UNDERPRICED|FAIR|OVERPRICED|UNKNOWN","confidence":0.0-1.0,"basis":"LISTING_ONLY|USER_MARKET_RANGE|UNKNOWN","rationale_short":"4-180ch","user_market_range":null},"risk_flags":["1-120ch","1-120ch","1-120ch"],"must_answer_questions":["1-140ch","1-140ch","1-140ch"],"inspect_first":["1-140ch",x5],"negotiation_opener":"8-420ch","one_followup_question":"max160ch or null","compare":null,"operator_notes":{"rationale":"10-500ch","assumptions":["1-120ch",0-6],"what_would_change_verdict":["1-140ch",0-4]},"listing_summary":{"listing_url":"str","url_domain":"str","country":"US|UK|CA|AU|OTHER","zip_or_postcode":"str","price":N,"currency":"str","mileage":N,"mileage_unit":"mi|km|unknown","year":N,"make":"str","model":"str","trim":"str|null","seller_type":"dealer|private|unknown","title_status":"clean|salvage|rebuilt|lemon|unknown","accidents_reported":"yes|no|unknown","service_history":"yes|no|unknown","owners":N|null,"carfax_available":"yes|no|unknown","financing_vs_cash":"financing|cash|unknown"},"listing_signals":["signal_id",...]}

ARRAY COUNTS (linter enforced): risk_flags=3, must_answer_questions=3, inspect_first=5. listing_signals=3-20.

RULES:
- No verdict language (good deal, bad deal, buy it, skip it, hard pass, avoid, must buy, steer you, I'd lean).
- No "annoying" (use stressful). No smart quotes. No markdown * or _. No URLs. Use "or" not "/".
- Cautious language: "may", "worth verifying", "tends to" — not "will", "definitely", "always".
- DCFC: if DCFC_SUPPORT=unknown, say "confirm DC fast charging support" — don't assume it.
- Location: if ambiguous, say "local listing" — don't guess a city.
- GREEN=fair price+no red flags. YELLOW=concerns or missing info. RED=major red flags or overpriced.
- Tone: direct, specific, concrete numbers. Like a friend who's bought 50 cars.

SIGNAL LIBRARY — use exact IDs in listing_signals[]:
Hard blockers: title_salvage, frame_damage_major, routine_impossible, dcfc_required_but_absent, odometer_title_mismatch, repair_risk_critical
Fit penalties: no_home_charging, single_site_dependency, plan_b_weak, winter_high_exposure, longest_day_tight_buffer, public_charging_cost_risk, multi_driver_one_charger, price_over_market_10_15, price_over_market_15_plus, prior_damage_minor, ownership_turnover_high, battery_replaced_unverified, dealer_addon_pressure, model_known_limit_vs_routine, service_network_sparse, independent_shop_restricted
Evidence bonuses: clean_title_explicit, battery_report_recent, battery_warranty_info, service_records_shown, dcfc_confirmed, charging_port_photo, vin_decoded, ownership_history_clear, fees_disclosed, tire_condition_visible, recall_status_clear
Evidence penalties: battery_proof_missing, battery_warranty_unclear, service_records_missing, ownership_history_unclear, title_status_unclear, vin_missing

SIGNAL RULES:
- Include EVERY signal that applies. Err on the side of including more signals.
- Hard blockers: only if strong evidence. Evidence bonuses: only if listing explicitly shows it. Evidence penalties: if listing does NOT address it.
- "Not mentioned" = the corresponding "missing" or "unclear" penalty applies.
- TITLE: The title_status in KNOWN DETAILS is pre-extracted from the listing — trust it. if listing_summary.title_status="clean" → include clean_title_explicit. If "salvage", "rebuilt", or "lemon" → include title_salvage. If "unknown" → include title_status_unclear. Only override title_status to "lemon" if the History section of the listing explicitly states a lemon title was issued — do NOT infer from legal boilerplate, footer disclosures, or generic lemon law mentions.
- Do NOT include dcfc_unclear, fees_unclear, or tire_condition_unclear — these are not scored.`;

// --- Prompt Sanitization ---

/**
 * Strip characters that could be used for prompt injection and cap length.
 * Applied to all user-supplied free-text fields before prompt interpolation.
 */
function sanitizeForPrompt(value: string | undefined | null, maxLen = 200): string {
  if (!value) return "";
  return value
    .replace(/[<>\[\]{}|`\\]/g, "") // strip injection-prone chars
    .replace(/\n{3,}/g, "\n\n")      // collapse excessive newlines
    .trim()
    .slice(0, maxLen);
}

// --- User Prompt Builder ---

export async function buildUserPrompt(input: ReceiptGenerateRequest): Promise<string> {
  const parts: string[] = ["ANALYZE THIS LISTING:", ""];

  if (input.listing_url) {
    parts.push(`LISTING URL: ${input.listing_url}`);
    parts.push("");
  }

  if (input.listing_text) {
    const trimmed = sanitizeForPrompt(input.listing_text, 2500);
    parts.push("LISTING TEXT:");
    parts.push(trimmed);
    parts.push("");
  }

  // Structured fields — sanitize all free-text user input before interpolation
  const fields: string[] = [];
  if (input.year) fields.push(`Year: ${input.year}`);
  if (input.make) fields.push(`Make: ${sanitizeForPrompt(input.make)}`);
  if (input.model) fields.push(`Model: ${sanitizeForPrompt(input.model)}`);
  if (input.trim) fields.push(`Trim: ${sanitizeForPrompt(input.trim)}`);
  if (input.mileage) fields.push(`Mileage: ${input.mileage.toLocaleString()}`);
  if (input.price) {
    const priceStr = input.region === "UK"
      ? `£${input.price.toLocaleString()}`
      : `$${input.price.toLocaleString()}`;
    fields.push(`Asking Price: ${priceStr}`);
  }
  if (input.vin) fields.push(`VIN: ${sanitizeForPrompt(input.vin, 20)}`);
  if (input.location) fields.push(`Location: ${sanitizeForPrompt(input.location)}`);
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

  // User routine context — inject when present so AI can personalize signals and advice
  if (input.routine_context) {
    const mvr = input.routine_context;
    const chargeLabel =
      mvr.charging_access === "home"
        ? `home charging${mvr.home_charging_type === "L2" ? " (Level 2)" : mvr.home_charging_type === "L1" ? " (Level 1/slow)" : ""}`
        : mvr.charging_access === "work"
        ? "workplace charging (no home charging)"
        : "public charging only (no home or work charging)";
    const routineLines: string[] = ["USER ROUTINE — personalize signals and advice to match this buyer:"];
    routineLines.push(`- Charging access: ${chargeLabel}`);
    if (mvr.commute_miles_roundtrip) routineLines.push(`- Daily commute: ${mvr.commute_miles_roundtrip} miles roundtrip`);
    else if (mvr.weekly_miles) routineLines.push(`- Weekly driving: ~${mvr.weekly_miles} miles`);
    if (mvr.climate === "winter") routineLines.push("- Climate: cold (significant range loss expected in winter)");
    else if (mvr.climate === "hot") routineLines.push("- Climate: hot (moderate range loss, fast-charging heat sensitivity)");
    if (mvr.longest_day_pattern === "once_a_week") routineLines.push("- Longest day: frequent (weekly 100+ mi trips)");
    else if (mvr.longest_day_pattern === "monthly_trip") routineLines.push("- Longest day: occasional (monthly 100+ mi trips)");
    else if (mvr.longest_day_pattern === "rare_road_trip") routineLines.push("- Longest day: rare (road trips only)");
    if (mvr.public_charging_dependency) routineLines.push(`- Public charging dependency: ${mvr.public_charging_dependency.toLowerCase()}`);
    parts.push(routineLines.join("\n"));
    parts.push("");
  }

  // Market comps — inject when available so AI can anchor price_sanity to real data
  if (input.market_price_range) {
    const mpr = input.market_price_range;
    const currency = input.region === "UK" ? "£" : "$";
    const marketLines: string[] = ["MARKET DATA — use this to anchor price_sanity and user_market_range:"];
    marketLines.push(`- Comparable listings range: ${currency}${mpr.low.toLocaleString()}–${currency}${mpr.high.toLocaleString()} (${mpr.count} active listings)`);
    if (input.auto_dev_specs?.used_tmv) {
      marketLines.push(`- Used TMV (Edmunds): ${currency}${input.auto_dev_specs.used_tmv.toLocaleString()}`);
    }
    if (input.auto_dev_specs?.msrp) {
      marketLines.push(`- Original MSRP: ${currency}${input.auto_dev_specs.msrp.toLocaleString()}`);
    }
    marketLines.push(`- Set price_sanity.basis to "USER_MARKET_RANGE" and populate user_market_range with low/high from above.`);
    parts.push(marketLines.join("\n"));
    parts.push("");
  }

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

  // Model-specific knowledge injection — grounds AI in real known issues, warranty, and market context
  const modelKnowledge = getModelKnowledge(input.year ?? null, input.make ?? "", input.model ?? "");
  if (modelKnowledge) {
    const knowledgeLines = ["MODEL KNOWLEDGE — use this to inform signals, inspection items, and advice:"];
    if (modelKnowledge.known_issues_block) {
      knowledgeLines.push(modelKnowledge.known_issues_block);
    }
    if (modelKnowledge.battery_warranty) {
      knowledgeLines.push(`Battery warranty: ${modelKnowledge.battery_warranty}`);
    }
    if (modelKnowledge.lease_return_note) {
      knowledgeLines.push(`Market context: ${modelKnowledge.lease_return_note}`);
    }
    if (modelKnowledge.reliability_score > 0) {
      knowledgeLines.push(`Reliability score: ${modelKnowledge.reliability_score}/10`);
    }
    if (modelKnowledge.service_block) {
      knowledgeLines.push(modelKnowledge.service_block);
    }
    parts.push(knowledgeLines.join("\n"));
    parts.push("");
  }

  // Live NHTSA recall injection — grounded facts prevent AI from inventing recall details
  if (input.year && input.make && input.model) {
    try {
      const recallData = await fetchNhtsaRecalls(input.year, input.make, input.model);
      parts.push(recallData.prompt_block);
      parts.push("");
    } catch {
      // Non-fatal — proceed without recall data rather than failing the receipt
    }
  }

  parts.push("Generate the receipt JSON now. Return ONLY the JSON object.");

  return parts.join("\n");
}

// --- Main Generate Function ---

// Pin listing_summary.title_status to the scraper-extracted value when available.
// The AI reads raw listing_text and can misfire on legal boilerplate (e.g. "lemon law"
// footer links on CarGurus). The structured field from the scraper is authoritative.
function pinTitleStatus(receipt: ListingReceipt, input: ReceiptGenerateRequest): ListingReceipt {
  const scraped = input.title_status;
  if (!scraped || scraped === "unknown") return receipt;
  const ls = receipt.listing_summary as Record<string, unknown> | undefined;
  if (!ls) return receipt;
  if (ls.title_status === scraped) return receipt;
  console.log(`[generateReceipt] Pinning title_status: AI="${ls.title_status}" → scraper="${scraped}"`);
  return { ...receipt, listing_summary: { ...ls, title_status: scraped } } as ListingReceipt;
}

export async function generateReceipt(
  input: ReceiptGenerateRequest
): Promise<{ receipt: ListingReceipt; raw_response: string; retried: boolean }> {
  const startTime = Date.now();
  const userPrompt = await buildUserPrompt(input);

  // First attempt
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const firstResponse = await callStructured(messages, {
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
      receipt: pinTitleStatus(firstValidation.sanitized!, input),
      raw_response: firstContent,
      retried: false,
    };
  }

  // --- Try deterministic fixes before expensive retry ---
  const deterministicResult = applyDeterministicFixesToReceipt(parsed, firstValidation);
  if (deterministicResult.fixed) {
    console.log("[Receipt OpenAI] Deterministic fixes resolved all lint errors, skipping retry");
    return {
      receipt: pinTitleStatus(deterministicResult.receipt as ListingReceipt, input),
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
      receipt: pinTitleStatus((firstValidation.sanitized || parsed) as ListingReceipt, input),
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

  const retryResponse = await callStructured(messages, {
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
      receipt: pinTitleStatus(parsed as ListingReceipt, input),
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
      receipt: pinTitleStatus((retryValidation.sanitized || retryParsed) as ListingReceipt, input),
      raw_response: retryContent,
      retried: true,
    };
  }

  return {
    receipt: pinTitleStatus((firstValidation.sanitized || parsed) as ListingReceipt, input),
    raw_response: firstContent,
    retried: true,
  };
}

// --- Fallback Receipt (analysis skipped) ---

/**
 * Builds a minimal receipt from structured input fields when the analysis
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
    verdict_reason: `Analysis timed out for this ${label}. Scores based on available listing data.`,
    price_sanity: {
      label: "UNKNOWN",
      confidence: 0,
      basis: "UNKNOWN",
      rationale_short: "Analysis was unavailable — price not evaluated",
      user_market_range: null,
    },
    risk_flags: [
      "Analysis timed out — regenerate for full risk assessment",
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
    receipt_reddit_text: `${label} at ${priceStr} — looking for community input.\n\nThis is a basic receipt generated from listing data. Detailed analysis was unavailable, so no complete risk assessment or pricing analysis is included. Key details worth confirming include title status, accident history, and maintenance records.\n\nHas anyone had experience with this vehicle and what should I watch out for?`,
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
      rationale: `Analysis timed out after taking too long to respond. This fallback receipt was generated from the structured fields provided. Regenerate for a complete detailed analysis.`,
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

// --- Enhanced Fallback Receipt (rule-extracted signals) ---

/**
 * Signal-to-question mapping for evidence penalties.
 * Each key is a penalty signal ID, value is a buyer-facing question.
 */
const PENALTY_QUESTIONS: Partial<Record<ListingSignalId, string>> = {
  battery_proof_missing: "Can you provide a recent battery health report or state-of-health percentage?",
  service_records_missing: "Are service or maintenance records available for this vehicle?",
  title_status_unclear: "What is the title status — clean, salvage, or rebuilt?",
  battery_warranty_unclear: "Is the battery still under the manufacturer warranty, and when does it expire?",
  ownership_history_unclear: "How many previous owners has this vehicle had?",
  vin_missing: "Can you provide the full 17-digit VIN for a history check?",
};

const GENERIC_QUESTIONS = [
  "Has this vehicle been in any accidents or had major repairs?",
  "Is the title clean, and are there any liens on the vehicle?",
  "Can the seller provide recent maintenance or inspection records?",
];

const GENERIC_INSPECT = [
  "Check for uneven panel gaps or paint mismatches indicating body work",
  "Inspect tire wear patterns for alignment or suspension issues",
  "Test all electronics, AC, and infotainment systems",
  "Look under the vehicle for rust, fluid leaks, or frame damage",
  "Take it for a test drive on highway and listen for unusual noises",
];

/**
 * Builds a signal-specific fallback receipt from deterministically extracted
 * signals. Replaces generic "analysis timed out" boilerplate with specific risk
 * flags, questions, and scoring derived from listing text patterns.
 */
export function buildEnhancedFallbackReceipt(
  input: ReceiptGenerateRequest,
  signals: ListingSignalId[],
  scoring: ReceiptScoringResult
): ListingReceipt {
  const year = input.year || 0;
  const make = input.make || "Unknown";
  const model = input.model || "Vehicle";
  const price = input.price || 0;
  const mileage = input.mileage || 0;
  const label = `${year > 0 ? year + " " : ""}${make} ${model}`;
  const priceStr = price > 0 ? `$${price.toLocaleString()}` : "unlisted price";

  // --- Risk flags: top 3 scoring reasons by severity ---
  const riskFlags = scoring.scoring_reasons
    .filter((r) => r.points <= 0)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 3)
    .map((r) => r.label);
  // Pad to 3 if we don't have enough
  const genericRisks = [
    "Verify title status and accident history independently",
    "Check service records and maintenance history before purchase",
    "Confirm all pricing details including fees before committing",
  ];
  while (riskFlags.length < 3) {
    const filler = genericRisks[riskFlags.length];
    if (filler && !riskFlags.includes(filler)) riskFlags.push(filler);
    else break;
  }

  // --- Questions: from evidence penalty signals ---
  const questions: string[] = [];
  const signalSet = new Set(signals);
  for (const [penaltyId, question] of Object.entries(PENALTY_QUESTIONS)) {
    if (signalSet.has(penaltyId as ListingSignalId) && questions.length < 3) {
      questions.push(question!);
    }
  }
  // Pad to 3
  for (const q of GENERIC_QUESTIONS) {
    if (questions.length >= 3) break;
    if (!questions.includes(q)) questions.push(q);
  }

  // --- Inspect first: from verify_before_visit, padded from generics ---
  const inspectFirst = [...scoring.verify_before_visit];
  for (const item of GENERIC_INSPECT) {
    if (inspectFirst.length >= 5) break;
    if (!inspectFirst.includes(item)) inspectFirst.push(item);
  }

  // listing_signals is string[] of signal IDs
  const listingSignals = signals.filter((id) => RULES_BY_ID.has(id));

  // Infer accidents_reported from signals when user didn't provide it.
  // clean_title_explicit is a TITLE signal — it does not imply accident history.
  const inferredAccidents: "yes" | "no" | "unknown" =
    input.accidents_reported && input.accidents_reported !== "unknown"
      ? input.accidents_reported
      : signalSet.has("prior_damage_minor" as ListingSignalId)
        ? "yes"
        : "unknown";

  // Infer title_status from signals when user didn't provide it
  // title_salvage covers salvage/rebuilt/flood/lemon (single hard-blocker signal)
  const inferredTitle: "clean" | "salvage" | "rebuilt" | "lemon" | "unknown" =
    input.title_status && input.title_status !== "unknown"
      ? input.title_status
      : signalSet.has("title_salvage" as ListingSignalId)
        ? "salvage"
        : signalSet.has("clean_title_explicit" as ListingSignalId)
          ? "clean"
          : "unknown";

  return {
    receipt_id: uuidv4(),
    schema_version: "v1",
    mode: "single",
    verdict: scoring.verdict,
    verdict_reason: `Quick signal-based analysis. Deep analysis is processing in the background — refresh in 15–30 seconds for a complete verdict.`,
    price_sanity: {
      label: "UNKNOWN",
      confidence: 0,
      basis: "UNKNOWN",
      rationale_short: price > 0
        ? `Listed at $${price.toLocaleString()}. Deep market comparison processing — refresh shortly.`
        : "No price found in listing. Add the price and regenerate for a full market comparison.",
      user_market_range: null,
    },
    risk_flags: riskFlags,
    must_answer_questions: questions,
    inspect_first: inspectFirst,
    negotiation_opener: price > 0
      ? `I am interested in the ${label} listed at ${priceStr}. Before we discuss price further, I would like to verify a few details about the vehicle history and condition.`
      : `I am interested in the ${label}. Before we discuss terms, I would like to verify a few details about the vehicle history and condition.`,
    one_followup_question: null,
    receipt_reddit_text: `${label} at ${priceStr} — looking for community input.\n\nThis is a quick receipt generated from listing data. Key signals found: ${signals.length > 0 ? signals.slice(0, 5).join(", ") : "none"}. Full detailed analysis was unavailable.\n\nHas anyone had experience with this vehicle and what should I watch out for?`,
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
      title_status: inferredTitle,
      accidents_reported: inferredAccidents,
      service_history: input.service_history || "unknown",
      owners: input.owners || null,
      carfax_available: input.carfax_available || "unknown",
    },
    receipt_details: null,
    compare: null,
    operator_notes: {
      rationale: `Analysis timed out. This receipt was generated from ${signals.length} signals extracted from listing text and structured fields. Regenerate for a complete detailed analysis with pricing and deep-dive content.`,
      assumptions: [
        "Signals extracted from listing text via pattern matching",
        "No independent price or market analysis performed",
      ],
      what_would_change_verdict: scoring.verdict === "GREEN"
        ? ["Accident history or title issues discovered later could move this toward RED"]
        : [
            "A clean Carfax and service records could move this toward GREEN",
            "Accident history or title issues could move this toward RED",
          ],
    },
    listing_signals: listingSignals,
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
 * skips the processing call entirely. Otherwise processes remaining fixes.
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

  // If deterministic fixes resolved everything, skip processing call
  if (remainingErrors.length === 0 && deterministicChanged) {
    return { ...receipt, receipt_reddit_text: fixedText };
  }

  // Step 2: Process remaining errors
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
    const response = await getOpenAI().chat.completions.create({
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

import type { PackTier } from "./price-assignment";

const DEEP_DIVE_HEDGE_DELAYS: [number, number] = [12_000, 22_000];

const DEEP_DIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["market_comparison", "extended_inspection", "negotiation_scripts", "cost_of_ownership", "model_known_issues", "verdict_deep"],
  properties: {
    market_comparison: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "price", "mileage", "source", "delta_pct"],
        properties: {
          title: { type: "string" },
          price: { type: "number" },
          mileage: { type: "number" },
          source: { type: "string" },
          delta_pct: { type: "number" },
        },
      },
    },
    extended_inspection: { type: "array", items: { type: "string" } },
    negotiation_scripts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["scenario", "opening", "body"],
        properties: {
          scenario: { type: "string" },
          opening: { type: "string" },
          body: { type: "string" },
        },
      },
    },
    cost_of_ownership: {
      type: "object",
      additionalProperties: false,
      required: ["insurance_yr", "maintenance_yr", "fuel_or_charging_yr", "depreciation_yr", "total_3yr"],
      properties: {
        insurance_yr: { type: "number" },
        maintenance_yr: { type: "number" },
        fuel_or_charging_yr: { type: "number" },
        depreciation_yr: { type: "number" },
        total_3yr: { type: "number" },
      },
    },
    model_known_issues: { type: "array", items: { type: "string" } },
    verdict_deep: { type: "string" },
  },
} as const;

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
    { "title": "<year make model trim>", "price": <number, full dollar amount e.g. 54999 not 54>, "mileage": <number>, "source": "<marketplace name>", "delta_pct": <number, percent difference from listing> }
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
- market_comparison: 3-5 items. Use realistic comparable listings. price MUST be the full dollar amount (e.g. 54999, never 54 or 54.9). delta_pct is (comp_price - listing_price) / listing_price * 100.
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
  ];

  const modelKnowledge = getModelKnowledge(ls.year ?? null, ls.make ?? "", ls.model ?? "");
  if (modelKnowledge) {
    const knowledgeLines = ["MODEL KNOWLEDGE — use this to ground model_known_issues[], inspection items, and advice:"];
    if (modelKnowledge.known_issues_block) {
      knowledgeLines.push(modelKnowledge.known_issues_block);
    }
    if (modelKnowledge.battery_warranty) {
      knowledgeLines.push(`Battery warranty: ${modelKnowledge.battery_warranty}`);
    }
    if (modelKnowledge.lease_return_note) {
      knowledgeLines.push(`Market context: ${modelKnowledge.lease_return_note}`);
    }
    if (modelKnowledge.reliability_score > 0) {
      knowledgeLines.push(`Reliability score: ${modelKnowledge.reliability_score}/10`);
    }
    if (modelKnowledge.service_block) {
      knowledgeLines.push(modelKnowledge.service_block);
    }
    parts.push(knowledgeLines.join("\n"));
    parts.push("");
  }

  parts.push("Generate the deep dive JSON now. Return ONLY the JSON object.");

  return parts.join("\n");
}

/**
 * Generate a deep dive analysis for a Buyer Pass purchase.
 * Full deep dive with gpt-4o: market comparison, cost, known issues, etc.
 */
export async function generateDeepDive(
  baseReceipt: ListingReceipt,
  _tier?: PackTier
): Promise<DeepDiveContent> {
  const userPrompt = buildDeepDiveUserPrompt(baseReceipt);

  const result = await hedgedGenerate({
    systemPrompt: DEEP_DIVE_SYSTEM_PROMPT,
    userPrompt,
    jsonSchema: DEEP_DIVE_SCHEMA as Record<string, unknown>,
    schemaName: "deep_dive",
    temperature: 0.3,
    maxTokens: 4000,
    timeoutMs: 45_000,
    hedgeDelays: DEEP_DIVE_HEDGE_DELAYS,
    validate: (json) => {
      const d = json as Partial<DeepDiveContent>;
      if (!Array.isArray(d.extended_inspection) || d.extended_inspection.length === 0)
        return { valid: false, reason: "missing extended_inspection" };
      if (!Array.isArray(d.negotiation_scripts) || d.negotiation_scripts.length === 0)
        return { valid: false, reason: "missing negotiation_scripts" };
      if (!d.verdict_deep)
        return { valid: false, reason: "missing verdict_deep" };
      if (!Array.isArray(d.market_comparison) || d.market_comparison.length === 0)
        return { valid: false, reason: "missing market_comparison" };
      if (!d.cost_of_ownership)
        return { valid: false, reason: "missing cost_of_ownership" };
      return { valid: true };
    },
  });

  const parsed = result.result.json as Partial<DeepDiveContent>;

  return {
    market_comparison: parsed.market_comparison!,
    extended_inspection: parsed.extended_inspection!,
    negotiation_scripts: parsed.negotiation_scripts!,
    cost_of_ownership: parsed.cost_of_ownership!,
    model_known_issues: parsed.model_known_issues || [],
    verdict_deep: parsed.verdict_deep!,
  };
}
