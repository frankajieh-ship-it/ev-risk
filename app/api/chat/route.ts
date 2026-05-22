/**
 * OFFO Chat — 5-Stage Multi-Model Pipeline
 *
 * Stage 1: Grok classifier (intent + key concern)          ─┐ parallel
 * Stage 2: VIN data fetch (Auto.dev / VINaudit, optional)  ─┘
 * Stage 3: Claude — writes the full OFFO answer (lead writer)
 * Stage 4: GPT-4o — fact-checks Claude, surfaces any missed numbers/flags
 * Stage 5: Grok — weaves in GPT addendum if needed, sharpens OFFO voice
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 26;
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { grokAdapter } from "@/lib/providers/grok-adapter";
import { openaiAdapter } from "@/lib/providers/openai-adapter";
import { anthropicAdapter } from "@/lib/providers/anthropic-adapter";
import type { GenerateOpts } from "@/lib/providers/types";

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

// All users: 200 messages per day (chat is free for shoppers)
const paidChatLimiter = new RateLimiter(24 * 60 * 60 * 1000, 200);

// ---------------------------------------------------------------------------
// VIN data cache (24h in-memory per serverless instance)
// ---------------------------------------------------------------------------

interface VinCacheEntry {
  data: Record<string, unknown>;
  expiresAt: number;
}
const vinCache = new Map<string, VinCacheEntry>();

async function fetchVinData(vin: string): Promise<Record<string, unknown>> {
  const cached = vinCache.get(vin);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const data: Record<string, unknown> = {};

  const timeout = 3_000;

  // Auto.dev
  if (process.env.AUTO_DEV_API_KEY) {
    try {
      const ac = new AbortController();
      const id = setTimeout(() => ac.abort(), timeout);
      const res = await fetch(
        `https://auto.dev/api/vin/${vin}?apikey=${process.env.AUTO_DEV_API_KEY}`,
        { signal: ac.signal }
      );
      clearTimeout(id);
      if (res.ok) data.autodev = await res.json();
    } catch {
      // ignore
    }
  }

  // VINaudit
  if (process.env.VINAUDIT_API_KEY) {
    try {
      const ac = new AbortController();
      const id = setTimeout(() => ac.abort(), timeout);
      const res = await fetch(
        `https://api.vinaudit.com/query.php?key=${process.env.VINAUDIT_API_KEY}&vin=${vin}&format=json`,
        { signal: ac.signal }
      );
      clearTimeout(id);
      if (res.ok) data.vinaudit = await res.json();
    } catch {
      // ignore
    }
  }

  vinCache.set(vin, { data, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  return data;
}

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

const classifySchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["price", "reliability", "negotiation", "routine_fit", "comparison", "general"],
    },
    user_state: { type: "string" },
    key_concern: { type: "string" },
    suggested_angle: { type: "string" },
  },
  required: ["intent", "user_state", "key_concern", "suggested_angle"],
  additionalProperties: false,
} as const;

const synthSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
  },
  required: ["reply"],
  additionalProperties: false,
} as const;

// GPT-4o fact-check addendum: only what Claude missed or understated
const factSchema = {
  type: "object",
  properties: {
    addendum: { type: "string" },
  },
  required: ["addendum"],
  additionalProperties: false,
} as const;

// ---------------------------------------------------------------------------
// Context summary builder
// ---------------------------------------------------------------------------

function buildContextSummary(
  ctx: ChatContext,
  scenarioType: "receipt" | "compare" | "auction" | "advisor"
): string {
  if (scenarioType === "auction") {
    const parts: string[] = [];
    if (ctx.lot_number)       parts.push(`Lot #: ${ctx.lot_number}`);
    if (ctx.vehicle)          parts.push(`Vehicle: ${ctx.vehicle}`);
    if (ctx.vin)              parts.push(`VIN: ${ctx.vin}`);
    if (ctx.mileage)          parts.push(`Odometer: ${ctx.mileage.toLocaleString()} mi`);
    if (ctx.title_status)     parts.push(`Title: ${ctx.title_status}`);
    if (ctx.primary_damage)   parts.push(`Primary damage: ${ctx.primary_damage}`);
    if (ctx.secondary_damage) parts.push(`Secondary damage: ${ctx.secondary_damage}`);
    if (ctx.salvage_grade)    parts.push(`OFFO salvage grade: ${ctx.salvage_grade.toUpperCase()} (score ${ctx.salvage_score}/100)`);
    if (ctx.arv)              parts.push(`After-repair value (ARV): $${ctx.arv.toLocaleString()}`);
    if (ctx.max_safe_bid)     parts.push(`OFFO max safe bid: $${ctx.max_safe_bid.toLocaleString()}`);
    if (ctx.repair_cost_low && ctx.repair_cost_high)
      parts.push(`Estimated repair range: $${ctx.repair_cost_low.toLocaleString()}–$${ctx.repair_cost_high.toLocaleString()}`);
    if (ctx.run_and_drive)    parts.push(`Run & drive: ${ctx.run_and_drive}`);
    if (ctx.price)            parts.push(`Current bid: $${ctx.price.toLocaleString()}`);
    if (ctx.auction_source)   parts.push(`Auction: ${ctx.auction_source}`);
    return parts.filter(Boolean).join("\n");
  }
  if (scenarioType === "receipt") {
    const parts: string[] = [];
    if (ctx.vehicle) parts.push(`Vehicle: ${ctx.vehicle}`);
    if (ctx.price) parts.push(`Listed price: $${ctx.price.toLocaleString()}`);
    if (ctx.mileage) parts.push(`Mileage: ${ctx.mileage.toLocaleString()} mi`);
    if (ctx.top_concerns?.length)
      parts.push(`Key concerns flagged: ${ctx.top_concerns.join(", ")}`);
    return parts.join("\n");
  } else {
    const parts: string[] = [];
    if (ctx.comparison_label_a) parts.push(`Option A: ${ctx.comparison_label_a}`);
    if (ctx.comparison_label_b) parts.push(`Option B: ${ctx.comparison_label_b}`);
    if (ctx.winner_signal) parts.push(`Signal: ${ctx.winner_signal}`);
    return parts.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatContext {
  vehicle?: string;
  price?: number;
  mileage?: number;
  vin?: string;
  top_concerns?: string[];
  comparison_label_a?: string;
  comparison_label_b?: string;
  winner_signal?: string;
  // Auction-specific
  lot_number?: string;
  title_status?: string;
  primary_damage?: string;
  secondary_damage?: string;
  salvage_score?: number;
  salvage_grade?: string;
  arv?: number;
  max_safe_bid?: number;
  repair_cost_low?: number;
  repair_cost_high?: number;
  auction_source?: string;
  run_and_drive?: string;
}

interface ClassifyResult {
  intent: string;
  user_state: string;
  key_concern: string;
  suggested_angle: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  // Parse body
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const clientIP = getClientIP(request);

  const sessionId = (body.session_id as string) || "";
  const scenarioType = (body.scenario_type as string) || "";
  const scenarioId = (body.scenario_id as string) || "";
  const message = (body.message as string) || "";
  const ctx = (body.context as ChatContext) || {};
  const userId = (body.user_id as string) || null;
  const advisorSessionId = (body.advisor_session_id as string) || null;
  const history = (body.history as { role: "user" | "assistant"; content: string }[]) || [];

  // Validate required fields
  if (!sessionId || sessionId.length < 5) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }
  if (!["receipt", "compare", "auction", "advisor"].includes(scenarioType)) {
    return NextResponse.json({ error: "Invalid scenario_type" }, { status: 400 });
  }
  if (!scenarioId) {
    return NextResponse.json({ error: "Missing scenario_id" }, { status: 400 });
  }
  if (!message || message.trim().length === 0) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  // Chat is free for all users — rate limit only
  const limitKey = sessionId || clientIP;

  // Rate limiting: 200/day per session
  const rateCheck = paidChatLimiter.check(limitKey);
  if (!rateCheck.allowed) {
    const retryAfter = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many messages. Please wait before sending more.", retry_after: retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // Master timeout: 25s (function limit is 30s; leave 5s buffer)
  const masterController = new AbortController();
  const masterTimeout = setTimeout(() => masterController.abort(), 25_000);

  const sources: string[] = [];
  let fallback = false;

  try {
    const contextSummary = buildContextSummary(ctx, scenarioType as "receipt" | "compare" | "auction" | "advisor");
    const auctionPersonaLine = scenarioType === "auction"
      ? "\nYou are advising a buyer at a salvage/auction. Focus on: bid risk, repair cost realism, salvage title implications, insurance/resale friction, and whether the numbers work. Be direct about risks."
      : "";
    const offoContext = `You are OFFO — an honest, direct EV buying advisor. Be concise, specific, and helpful. Use bullet points when listing multiple items. Never be vague. Write in plain text only — no markdown, no ** bold **, no em dashes (—), no asterisks.${auctionPersonaLine}\n\nCurrent context:\n${contextSummary}`;

    // -------------------------------------------------------------------
    // Stage 1: Grok classifier
    // -------------------------------------------------------------------
    let classify: ClassifyResult = {
      intent: "general",
      user_state: "curious",
      key_concern: message,
      suggested_angle: "balanced",
    };

    if (grokAdapter.isConfigured()) {
      try {
        const opts: GenerateOpts = {
          systemPrompt:
            "You are a routing classifier. Analyze the user message and return JSON with intent, user_state, key_concern, and suggested_angle. Be brief.",
          userPrompt: `Context:\n${contextSummary}\n\nUser message: "${message}"`,
          jsonSchema: classifySchema,
          schemaName: "ClassifyResult",
          temperature: 0.0,
          maxTokens: 200,
          timeoutMs: 4_000,
          signal: masterController.signal,
        };
        const result = await grokAdapter.generate(opts);
        classify = result.json as unknown as ClassifyResult;
        sources.push("grok_classify");
      } catch {
        // fallthrough with defaults
      }
    }

    // -------------------------------------------------------------------
    // Stage 2: VIN data fetch (parallel, non-blocking)
    // -------------------------------------------------------------------
    let vinData: Record<string, unknown> = {};
    if (ctx.vin) {
      try {
        vinData = await fetchVinData(ctx.vin);
      } catch {
        // ignore
      }
    }

    const vinSummary =
      Object.keys(vinData).length > 0
        ? `\nAdditional vehicle data: ${JSON.stringify(vinData).slice(0, 500)}`
        : "";

    // -------------------------------------------------------------------
    // Stage 3: Claude — lead writer, full OFFO answer
    // Claude's strength is natural, human-sounding prose. Give it full context
    // and let it write the complete answer without role constraints.
    // -------------------------------------------------------------------
    const historySummary = history.length > 0
      ? "\n\nConversation so far:\n" + history.map((m) => `${m.role === "user" ? "User" : "OFFO"}: ${m.content}`).join("\n")
      : "";

    const claudeSystemPrompt = `${offoContext}\n\nUser intent: ${classify.intent}\nKey concern: ${classify.key_concern}\nSuggested angle: ${classify.suggested_angle}${vinSummary}${historySummary}`;

    let claudeReply = "";

    if (anthropicAdapter.isConfigured()) {
      try {
        const claudeResult = await anthropicAdapter.generate({
          systemPrompt: claudeSystemPrompt,
          userPrompt: `User asked: "${message}"\n\nWrite the complete OFFO answer. Be direct, specific, and buyer-first. 3-5 sentences. No filler phrases like "Great question" or "Absolutely".`,
          jsonSchema: synthSchema,
          schemaName: "ChatReply",
          temperature: 0.6,
          maxTokens: 500,
          timeoutMs: 9_000,
          signal: masterController.signal,
        });
        claudeReply = (claudeResult.json.reply as string) || "";
        if (claudeReply) sources.push("anthropic");
      } catch {
        // fall through to GPT-4o as lead
      }
    }

    // -------------------------------------------------------------------
    // Stage 4: GPT-4o — fact-check, surface anything Claude missed
    // GPT-4o is strong on numbers and skeptical analysis. Its only job is
    // to find what Claude understated or omitted — not rewrite the answer.
    // -------------------------------------------------------------------
    let gptAddendum = "";

    if (openaiAdapter.isConfigured() && claudeReply) {
      try {
        const gptResult = await openaiAdapter.generate({
          systemPrompt: `You are a rigorous fact-checker for EV buying advice. Your only job: read the draft answer and identify any important numbers, red flags, or technical facts that were missed or understated. Return a single addendum sentence (or two at most). If the draft is complete and accurate, return an empty string.`,
          userPrompt: `Original question: "${message}"\n\nContext:\n${claudeSystemPrompt}\n\nDraft answer:\n${claudeReply}\n\nWhat specific number, flag, or fact is missing or understated? Be concise — one sentence max, or empty string if nothing is missing.`,
          jsonSchema: factSchema,
          schemaName: "FactAddendum",
          temperature: 0.15,
          maxTokens: 150,
          timeoutMs: 5_000,
          signal: masterController.signal,
        });
        gptAddendum = ((gptResult.json.addendum as string) || "").trim();
        if (gptAddendum) sources.push("openai");
      } catch {
        // addendum is optional — no action needed
      }
    } else if (openaiAdapter.isConfigured() && !claudeReply) {
      // Claude failed — use GPT-4o as lead writer instead
      try {
        const gptResult = await openaiAdapter.generate({
          systemPrompt: claudeSystemPrompt,
          userPrompt: `User asked: "${message}"\n\nWrite the complete OFFO answer. Be direct, specific, and buyer-first. 3-5 sentences.`,
          jsonSchema: synthSchema,
          schemaName: "ChatReply",
          temperature: 0.4,
          maxTokens: 500,
          timeoutMs: 8_000,
          signal: masterController.signal,
        });
        claudeReply = (gptResult.json.reply as string) || "";
        if (claudeReply) sources.push("openai");
      } catch {
        // fall through to Grok direct
      }
    }

    if (!claudeReply) {
      // Both Claude and GPT-4o failed — attempt direct Grok answer as last resort
      if (grokAdapter.isConfigured()) {
        try {
          const grokDirectResult = await grokAdapter.generate({
            systemPrompt: `${offoContext}\n\nUser intent: ${classify.intent}\nKey concern: ${classify.key_concern}`,
            userPrompt: `User asked: "${message}"\n\nProvide a helpful, direct OFFO answer (3-5 sentences).`,
            jsonSchema: synthSchema,
            schemaName: "ChatReply",
            temperature: 0.4,
            maxTokens: 500,
            timeoutMs: 8_000,
            signal: masterController.signal,
          });
          claudeReply = (grokDirectResult.json.reply as string) || "";
          if (claudeReply) sources.push("grok_direct");
        } catch {
          // still failed
        }
      }
    }

    if (!claudeReply) {
      // All providers failed
      fallback = true;
      const latencyMs = Date.now() - t0;
      persistAsync(sessionId, scenarioType, scenarioId, message, "I'm having trouble right now. Try refreshing or ask again.", sources, latencyMs, classify.intent, "fallback", userId, advisorSessionId);
      return NextResponse.json({
        reply: "I'm having trouble right now. Try refreshing or ask again in a moment.",
        sources: [],
        latency_ms: latencyMs,
        fallback: true,
      });
    }

    // -------------------------------------------------------------------
    // Stage 5: Grok — voice editor
    // Grok's job: if GPT found something Claude missed, weave it in naturally.
    // Then sharpen to OFFO voice — punchy, no corporate filler, buyer-first.
    // If there's no addendum, just polish the Claude draft.
    // -------------------------------------------------------------------
    let finalReply = "";

    if (grokAdapter.isConfigured()) {
      const addendumInstruction = gptAddendum
        ? `GPT-4o flagged one thing Claude missed: "${gptAddendum}" — weave this in naturally if it adds real value. If it's redundant, drop it.`
        : "No additional facts were flagged — the draft is complete.";

      try {
        const synthResult = await grokAdapter.generate({
          systemPrompt: `${offoContext}\n\nYou are the final voice editor for OFFO chat. You receive a drafted answer and optionally a fact addendum. Your job:\n1. If the addendum adds real value, work it in naturally — don't just append it.\n2. Cut any filler, hedging, or corporate language.\n3. Keep it 3-5 sentences. The final reply should sound like a knowledgeable friend who has seen hundreds of EV deals — direct, warm, no BS.\n4. Do not add new information beyond what's provided.`,
          userPrompt: `Original question: "${message}"\n\nDraft answer:\n${claudeReply}\n\n${addendumInstruction}\n\nReturn the final polished OFFO reply:`,
          jsonSchema: synthSchema,
          schemaName: "ChatReply",
          temperature: 0.35,
          maxTokens: 600,
          timeoutMs: 6_000,
          signal: masterController.signal,
        });
        finalReply = (synthResult.json.reply as string) || "";
        if (finalReply) sources.push("grok_synth");
      } catch {
        // Fall through to Claude draft directly
      }
    }

    // If Grok voice edit failed, Claude's draft is still a great answer
    if (!finalReply) {
      finalReply = claudeReply;
      fallback = !finalReply;
    }

    if (!finalReply) {
      finalReply = "I'm having trouble right now. Try refreshing or ask again in a moment.";
      fallback = true;
    }

    // Strip markdown that renders as raw symbols in plain-text chat UI
    finalReply = finalReply
      .replace(/\*\*([^*]+)\*\*/g, "$1")   // **bold** → plain
      .replace(/\*([^*]+)\*/g, "$1")        // *italic* → plain
      .replace(/—/g, "-")                   // em dash → hyphen
      .replace(/–/g, "-")                   // en dash → hyphen
      .replace(/\s{2,}/g, " ")              // collapse double spaces left by stripping
      .trim();

    const latencyMs = Date.now() - t0;
    const primaryModel = sources.includes("grok_synth")
      ? "grok"
      : sources.includes("anthropic")
      ? "anthropic"
      : sources.includes("openai")
      ? "openai"
      : "grok_direct";

    // Persist async (non-blocking)
    persistAsync(sessionId, scenarioType, scenarioId, message, finalReply, sources, latencyMs, classify.intent, primaryModel, userId, advisorSessionId);

    return NextResponse.json({ reply: finalReply, sources, latency_ms: latencyMs, fallback });
  } catch (err) {
    const latencyMs = Date.now() - t0;
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { reply: "Response took too long. Please try again.", sources: [], latency_ms: latencyMs, fallback: true },
        { status: 200 }
      );
    }
    console.error("[chat] Unexpected error:", err);
    return NextResponse.json(
      { reply: "Something went wrong. Please try again.", sources: [], latency_ms: latencyMs, fallback: true },
      { status: 200 }
    );
  } finally {
    clearTimeout(masterTimeout);
  }
}

// ---------------------------------------------------------------------------
// Async persistence (fire-and-forget)
// ---------------------------------------------------------------------------

function persistAsync(
  sessionId: string,
  scenarioType: string,
  scenarioId: string,
  userMessage: string,
  assistantReply: string,
  sources: string[],
  latencyMs: number,
  queryType: string,
  modelUsed: string,
  userId: string | null = null,
  advisorSessionId: string | null = null
) {
  if (!isSupabaseConfigured()) return;

  const baseRow = {
    session_id: sessionId,
    scenario_type: scenarioType,
    scenario_id: scenarioId,
    ...(userId ? { user_id: userId } : {}),
    ...(advisorSessionId ? { advisor_session_id: advisorSessionId } : {}),
  };

  Promise.all([
    supabase.from("chat_messages").insert([
      { ...baseRow, role: "user", content: userMessage, sources_used: [] },
      { ...baseRow, role: "assistant", content: assistantReply, sources_used: sources, latency_ms: latencyMs },
    ]),
    supabase.from("chat_analytics").insert({
      session_id: sessionId,
      scenario_type: scenarioType,
      query_type: queryType,
      model_used: modelUsed,
      latency_ms: latencyMs,
      user_engaged_with_tool: true,
    }),
  ]).catch((err) => console.error("[chat] Persist error:", err));
}
