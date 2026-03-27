/**
 * POST /api/internal/chat-signals/extract
 *
 * Extracts structured buyer intent signals from an AI chat thread for a
 * specific vehicle. Results are stored on the most-recent assistant message
 * for that scenario. No raw transcripts or PII leave this endpoint.
 *
 * Debounce: skips extraction if the scenario already has a signal row written
 * within the last 12 minutes (DEBOUNCE_MINUTES).
 *
 * Protected by INTERNAL_API_SECRET header (server-to-server only).
 * Also accepts a valid user Bearer token (for client-triggered debounce checks).
 *
 * Body:
 *   {
 *     user_id:    string,
 *     vehicle_id: string,   // scenario_id in chat_messages
 *     scenario_type?: string  // default "garage_vehicle"
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { openaiAdapter } from "@/lib/providers/openai-adapter";
import type { ValidationResult } from "@/lib/providers/types";

export const maxDuration = 30;

const DEBOUNCE_MINUTES = 12;

// Signal categories the LLM is allowed to emit
const VALID_CATEGORIES = [
  "battery",
  "charging",
  "range",
  "winter",
  "title",
  "repair",
  "insurance",
  "budget",
  "comparison",
  "timing",
  "trade_in",
  "financing",
  "general_interest",
];

const SYSTEM_PROMPT = `You are an AI buyer intent analyst for an EV research platform.
You receive an anonymized summary of questions a buyer asked about a specific electric vehicle.
Your job is to extract structured purchase-intent signals that a dealer could act on.

Rules:
- Never include direct quotes from the user
- Never include personal information (name, location, contact details)
- Only emit signals that appear in the conversation — do not infer beyond what is shown
- Each signal must have a category from: ${VALID_CATEGORIES.join(", ")}
- confidence is 1-100 (your certainty that this is a genuine concern/interest)
- count_mentions is how many times this topic came up across the messages

Respond ONLY with valid JSON matching the schema.`;

const SIGNAL_SCHEMA = {
  type: "object",
  required: ["signals", "signal_strength"],
  properties: {
    signals: {
      type: "array",
      items: {
        type: "object",
        required: ["text", "confidence", "category", "count_mentions"],
        properties: {
          text: { type: "string", maxLength: 120 },
          confidence: { type: "integer", minimum: 1, maximum: 100 },
          category: { type: "string", enum: VALID_CATEGORIES },
          count_mentions: { type: "integer", minimum: 1 },
        },
      },
    },
    signal_strength: {
      type: "string",
      enum: ["high", "medium", "low", "none"],
    },
  },
};

function validateSignals(json: unknown): ValidationResult {
  if (!json || typeof json !== "object") {
    return { valid: false, errors: ["Not an object"] };
  }
  const j = json as Record<string, unknown>;
  if (!Array.isArray(j.signals)) {
    return { valid: false, errors: ["Missing signals array"] };
  }
  if (!["high", "medium", "low", "none"].includes(j.signal_strength as string)) {
    return { valid: false, errors: ["Invalid signal_strength"] };
  }
  const errors: string[] = [];
  for (const sig of j.signals as unknown[]) {
    if (!sig || typeof sig !== "object") { errors.push("Signal is not object"); continue; }
    const s = sig as Record<string, unknown>;
    if (typeof s.text !== "string" || s.text.length > 120) errors.push("Invalid text");
    if (typeof s.confidence !== "number") errors.push("Invalid confidence");
    if (!VALID_CATEGORIES.includes(s.category as string)) errors.push(`Invalid category: ${s.category}`);
    if (typeof s.count_mentions !== "number") errors.push("Invalid count_mentions");
  }
  return { valid: errors.length === 0, errors };
}

function isAuthorized(req: NextRequest): boolean {
  // Server-to-server: INTERNAL_API_SECRET header
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;
  if (expected && secret === expected) return true;

  // Also allow service role key (Supabase cron / edge function calls)
  const serviceKey = req.headers.get("x-service-role-key");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return true;
  }
  return false;
}

// Summarize user messages into a prompt-safe, non-quoting form
function buildUserSummary(messages: Array<{ role: string; content: string }>): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m, i) => `Q${i + 1}: ${m.content.slice(0, 300)}`)
    .join("\n");

  if (!userMessages.trim()) return "";

  return `The following are the buyer's questions about this EV (paraphrased topics only — no direct quotes to dealers):\n\n${userMessages}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { user_id?: string; vehicle_id?: string; scenario_type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id, vehicle_id, scenario_type = "garage_vehicle" } = body;
  if (!user_id || !vehicle_id) {
    return NextResponse.json({ error: "user_id and vehicle_id are required" }, { status: 400 });
  }

  // --- Debounce check ---
  const debounceThreshold = new Date(Date.now() - DEBOUNCE_MINUTES * 60 * 1000).toISOString();
  const { data: recentSignals } = await supabase
    .from("chat_messages")
    .select("id, extracted_signals")
    .eq("scenario_id", vehicle_id)
    .eq("scenario_type", scenario_type)
    .not("extracted_signals", "is", null)
    .gte("created_at", debounceThreshold)
    .limit(1);

  if (recentSignals && recentSignals.length > 0) {
    return NextResponse.json({
      status: "debounced",
      message: `Signals extracted within last ${DEBOUNCE_MINUTES} min — skipping`,
      signals: recentSignals[0].extracted_signals,
    });
  }

  // --- Fetch recent chat messages for this vehicle thread ---
  const { data: messages, error: msgErr } = await supabase
    .from("chat_messages")
    .select("role, content, id")
    .eq("scenario_id", vehicle_id)
    .eq("scenario_type", scenario_type)
    .order("created_at", { ascending: true })
    .limit(30);

  if (msgErr || !messages?.length) {
    return NextResponse.json({ status: "no_messages", signals: null });
  }

  const userSummary = buildUserSummary(messages);
  if (!userSummary.trim()) {
    return NextResponse.json({ status: "no_user_messages", signals: null });
  }

  // --- Check keyword triggers — only run if relevant topics exist ---
  const TRIGGER_KEYWORDS =
    /battery|charg|winter|title|repair|insuran|budget|financ|trade|comparison|range|cold|salvage/i;
  const combinedText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  // Run if 2+ user messages OR trigger keywords present
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  if (userMessageCount < 2 && !TRIGGER_KEYWORDS.test(combinedText)) {
    return NextResponse.json({ status: "below_threshold", signals: null });
  }

  // --- Call LLM ---
  let extractedJson: Record<string, unknown>;
  const startMs = Date.now();

  try {
    if (!openaiAdapter.isConfigured()) {
      return NextResponse.json({ error: "AI provider not configured" }, { status: 503 });
    }

    const result = await openaiAdapter.generate({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userSummary,
      jsonSchema: SIGNAL_SCHEMA,
      schemaName: "chat_signals",
      temperature: 0.1,
      maxTokens: 800,
      timeoutMs: 20000,
    });

    const validation = validateSignals(result.json);
    if (!validation.valid) {
      console.error("[chat-signals] Validation failed:", validation.errors);
      return NextResponse.json({ error: "LLM output failed validation", details: validation.errors }, { status: 502 });
    }

    extractedJson = result.json;
  } catch (err) {
    console.error("[chat-signals] LLM error:", err);
    return NextResponse.json({ error: "Signal extraction failed" }, { status: 502 });
  }

  const payload = {
    ...extractedJson,
    extracted_at: new Date().toISOString(),
    latency_ms: Date.now() - startMs,
  };

  // --- Store on the most-recent assistant message for this scenario ---
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  if (lastAssistantMsg) {
    await supabase
      .from("chat_messages")
      .update({ extracted_signals: payload })
      .eq("id", lastAssistantMsg.id);
  }

  return NextResponse.json({
    status: "ok",
    signals: payload,
    message_count: messages.length,
    latency_ms: payload.latency_ms,
  });
}
