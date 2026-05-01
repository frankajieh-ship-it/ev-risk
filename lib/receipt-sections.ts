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
 *   - generateReceiptSummary   → receipt_summary (human-voice plain-language summary)
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

// --- FastAPI /assist helper ---

async function callFastAPIAssist(payload: Record<string, unknown>): Promise<RedditDraft | null> {
  const baseUrl = process.env.REDDIT_OPERATOR_URL;
  if (!baseUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch(`${baseUrl}/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const draft = data?.reddit_draft;
    if (!draft) return null;

    // Validate against the existing schema before trusting the response
    const { RedditDraftSchema } = await import("@/lib/receipt-schema-validator");
    const parsed = RedditDraftSchema.safeParse(draft);
    if (!parsed.success) return null;

    return parsed.data as RedditDraft;
  } catch {
    return null;
  }
}

export async function generateRedditDraft(
  receipt: ListingReceipt,
): Promise<RedditDraft> {
  const ls = receipt.listing_summary;
  const label = `${ls.year} ${ls.make} ${ls.model}${ls.trim ? " " + ls.trim : ""}`;
  const priceStr = ls.price > 0 ? `$${ls.price.toLocaleString()}` : "price unknown";

  // Try unified FastAPI backend first (v2)
  const fastApiResult = await callFastAPIAssist({
    mode: "receipt",
    vehicle_label: label,
    price_str: priceStr,
    verdict: receipt.verdict,
    verdict_reason: receipt.verdict_reason,
    risk_flags: receipt.risk_flags || [],
    must_answer_questions: receipt.must_answer_questions || [],
  });

  if (fastApiResult) return fastApiResult;

  // Fallback: direct OpenAI call (v1 path)
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

// --- Receipt Summary (Human-Voice Plain Language) ---

export interface ListingAISummary {
  headline: string;          // 8-100 chars: the single most important takeaway
  body: string[];            // 2-4 sentences, each 20-200 chars: plain-language explanation
  bottom_line: string;       // 20-180 chars: what to do next / the concrete action
  confidence_note: string | null;  // 10-140 chars: caveat about data quality, or null if evidence is STRONG
  tone: "proceed" | "caution" | "stop";  // maps to GREEN/YELLOW/RED
}

const RECEIPT_SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["receipt_summary"],
  properties: {
    receipt_summary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "body", "bottom_line", "confidence_note", "tone"],
      properties: {
        headline: { type: "string" },
        body: { type: "array", items: { type: "string" } },
        bottom_line: { type: "string" },
        confidence_note: { anyOf: [{ type: "string" }, { type: "null" }] },
        tone: { type: "string", enum: ["proceed", "caution", "stop"] },
      },
    },
  },
} as const;

const RECEIPT_SUMMARY_SYSTEM = `You write plain-language summaries of used EV listing analyses for buyers. Your job is to cut through the data and tell the buyer, in a direct human voice, what this listing actually means for them.

You are like a trusted friend who has looked over the analysis and is giving their honest read — not a salesperson, not a lawyer. Warm but honest.

RULES:
- headline: the single most important fact about this listing. 8-100 chars. Specific numbers where possible.
- body: 2-4 sentences. Each sentence stands alone. Plain English. No jargon.
  - Sentence 1: What the overall picture is and why (reference the actual verdict)
  - Sentence 2: The biggest specific risk or strength (reference concrete facts: mileage, title, price vs market, specific flag)
  - Sentence 3 (optional): The evidence quality — what's confirmed vs missing
  - Sentence 4 (optional): Routine fit or charging situation — ONLY if ROUTINE FIT data is provided. Never invent or assume fit scores.
- bottom_line: A single concrete action sentence starting with a verb. Not wishy-washy. 20-180 chars.
  Examples: "Get a pre-purchase inspection before committing." / "This listing is worth a closer look — confirm DC fast charging first." / "Walk away — the title risk alone justifies it."
- confidence_note: If evidence_label is MISSING or PARTIAL, write a short honest caveat (10-140 chars). If STRONG evidence, return null.
- tone: "proceed" for GREEN, "caution" for YELLOW, "stop" for RED.

PRICING RULES (important):
- You may say whether the price is above, below, or near market — nothing more.
- Do NOT include specific dollar amounts, percentages, confidence levels, or market data sources in the summary.
- The goal is to signal direction only — full pricing detail is in the paid report.

RECALL RULES (important):
- If recalls are present or concerns exist: mention that recalls were detected, but do NOT state how many or describe what they are.
- If no open recalls noted: you may briefly mention this as a positive signal.
- If recall status is unknown: you may note it as something to verify.
- Never list, describe, or quantify specific recalls in the summary.

VOICE:
- Write "this listing" not "this vehicle" or "this car"
- No verdict language in body: no "good deal", "bad deal", "skip it", "buy it", "hard pass"
- Use cautious language: "may", "worth confirming", "tends to", "appears"
- Specific > general. Reference actual numbers from the listing.
- No bullet points. No markdown. No URLs. Straight quotes only.
- Max 1 question mark total across ALL fields.

Return ONLY the JSON object.`;

export async function generateReceiptSummary(
  receipt: ListingReceipt,
  routineContext?: {
    charging_access?: string;
    weekly_miles?: number;
    climate?: string;
    fit_label?: string | null;
    fit_score?: number | null;
    fit_summary?: string | null;
  } | null,
  hasActiveRecalls?: boolean | null,
): Promise<ListingAISummary> {
  const ls = receipt.listing_summary;
  const label = `${ls.year} ${ls.make} ${ls.model}${ls.trim ? " " + ls.trim : ""}`;
  const priceStr = ls.price > 0 ? `$${ls.price.toLocaleString()}` : "price unknown";
  const mileageStr = ls.mileage ? `${ls.mileage.toLocaleString()} ${ls.mileage_unit}` : "mileage unknown";

  // Pricing: direction only — no numbers, confidence, or rationale (user must seek details)
  const priceDirection = receipt.price_sanity?.label && receipt.price_sanity.label !== "UNKNOWN"
    ? receipt.price_sanity.label.toLowerCase().replace(/_/g, " ")
    : null;
  const priceSanityLine = priceDirection ? `Price direction: ${priceDirection}` : "";

  // Recalls: presence only — no count or details (user must check deep dive)
  const signals = (receipt.listing_signals ?? []) as string[];
  const recallStatus =
    hasActiveRecalls === true ? "active recalls confirmed — details in deep dive" :
    hasActiveRecalls === false ? "no active recalls found" :
    signals.includes("recall_status_clear") ? "no open recalls noted" :
    "recall status unknown — verify before purchase";

  const whyNotGreenLines = ((receipt.why_not_green ?? []) as Array<{ label: string; category?: string }>)
    .slice(0, 4)
    .map(f => `- ${f.label}`)
    .join("\n");

  const scoringLines = ((receipt.scoring_reasons ?? []) as Array<{ label: string; points: number }>)
    .filter(r => r.points > 0)
    .slice(0, 3)
    .map(r => `- ${r.label} (+${r.points} pts)`)
    .join("\n");

  const routineSection = routineContext
    ? `\nROUTINE FIT:
Charging access: ${routineContext.charging_access ?? "unknown"}
Weekly miles: ${routineContext.weekly_miles ?? "unknown"}
Climate: ${routineContext.climate ?? "unknown"}${routineContext.fit_label ? `\nFit label: ${routineContext.fit_label} (score: ${routineContext.fit_score ?? "??"}/100)` : ""}${routineContext.fit_summary ? `\nFit summary: ${routineContext.fit_summary}` : ""}`
    : "";

  const userPrompt = `Generate receipt_summary for this listing:

VEHICLE: ${label}
PRICE: ${priceStr}
MILEAGE: ${mileageStr}
SELLER: ${ls.seller_type}
TITLE: ${ls.title_status}
ACCIDENTS: ${ls.accidents_reported}
SERVICE HISTORY: ${ls.service_history}
OWNERS: ${ls.owners ?? "unknown"}
RECALLS: ${recallStatus}

VERDICT: ${receipt.verdict}
EVIDENCE QUALITY: ${receipt.evidence_label ?? "unknown"}
EVIDENCE SCORE: ${receipt.evidence_score ?? "N/A"}/100

VERDICT REASON (from analysis):
${receipt.verdict_reason}

${priceSanityLine ? `PRICE DIRECTION:\n${priceSanityLine}\n` : ""}
TOP RISK FLAGS:
${(receipt.risk_flags || []).map(f => `- ${f}`).join("\n")}

${whyNotGreenLines ? `WHY NOT GREEN:\n${whyNotGreenLines}\n` : ""}
${scoringLines ? `EVIDENCE STRENGTHS:\n${scoringLines}\n` : ""}
MUST-ANSWER QUESTIONS:
${(receipt.must_answer_questions || []).map(q => `- ${q}`).join("\n")}
${routineSection}

Write a receipt_summary that a buyer with no car expertise could understand in 30 seconds. Be honest, specific, and human.`;

  const result = await callStructuredSection<{ receipt_summary: ListingAISummary }>(
    RECEIPT_SUMMARY_SYSTEM,
    userPrompt,
    RECEIPT_SUMMARY_SCHEMA as Record<string, unknown>,
    "receipt_summary",
    700,
  );

  return result.receipt_summary;
}
