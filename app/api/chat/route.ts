/**
 * OFFO Chat — 4-Stage Multi-Model Pipeline
 *
 * POST /api/chat
 *
 * Stage 1: Grok classifier (intent + key concern)
 * Stage 2: Parallel VIN data fetch (Auto.dev / VINaudit, optional)
 * Stage 3: Parallel Gemini (empathy) + GPT-4o (technical)
 * Stage 4: Grok synthesis → OFFO voice
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { grokAdapter } from "@/lib/providers/grok-adapter";
import { openaiAdapter } from "@/lib/providers/openai-adapter";
import { geminiAdapter } from "@/lib/providers/gemini-adapter";
import { checkPurchaseStatus } from "@/lib/payment-status";
import { isFreeMode } from "@/lib/rollout-flags";
import type { GenerateOpts } from "@/lib/providers/types";

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

// Free tier: 5 messages per day
const freeChatLimiter = new RateLimiter(24 * 60 * 60 * 1000, 5);
// Paid tier: 200 per day (effectively unlimited)
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

// ---------------------------------------------------------------------------
// Context summary builder
// ---------------------------------------------------------------------------

function buildContextSummary(
  ctx: ChatContext,
  scenarioType: "receipt" | "compare"
): string {
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

  const sessionId = (body.session_id as string) || "";
  const scenarioType = (body.scenario_type as string) || "";
  const scenarioId = (body.scenario_id as string) || "";
  const message = (body.message as string) || "";
  const ctx = (body.context as ChatContext) || {};

  // Validate required fields
  if (!sessionId || sessionId.length < 5) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }
  if (!["receipt", "compare"].includes(scenarioType)) {
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

  // Check chat unlock status
  const limitKey = sessionId || getClientIP(request);
  let chatUnlocked = isFreeMode();
  if (!chatUnlocked && isSupabaseConfigured()) {
    try {
      const payStatus = await checkPurchaseStatus("chat", sessionId, sessionId);
      chatUnlocked = payStatus.chat_unlocked;
    } catch {
      // Default to free tier on error
    }
  }

  // Rate limiting: free = 5/day, paid = 200/day
  const limiter = chatUnlocked ? paidChatLimiter : freeChatLimiter;
  const rateCheck = limiter.check(limitKey);
  if (!rateCheck.allowed) {
    const retryAfter = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
    if (!chatUnlocked) {
      // Free tier exhausted — prompt upgrade
      return NextResponse.json(
        { error: "daily_limit_reached", messages_used: 5, retry_after: retryAfter },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: "Too many messages. Please wait before sending more.", retry_after: retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // Master timeout: 10s
  const masterController = new AbortController();
  const masterTimeout = setTimeout(() => masterController.abort(), 10_000);

  const sources: string[] = [];
  let fallback = false;

  try {
    const contextSummary = buildContextSummary(ctx, scenarioType as "receipt" | "compare");
    const offoContext = `You are OFFO — an honest, direct EV buying advisor. Be concise, specific, and helpful. Use bullet points when listing multiple items. Never be vague.\n\nCurrent context:\n${contextSummary}`;

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
    // Stage 3: Parallel Gemini (empathy) + GPT-4o (technical)
    // -------------------------------------------------------------------
    const stageSystemPrompt = `${offoContext}\n\nUser intent: ${classify.intent}\nKey concern: ${classify.key_concern}\nSuggested angle: ${classify.suggested_angle}${vinSummary}`;

    const stageUserPrompt = `User asked: "${message}"\n\nProvide your perspective as instructed. Be concise (2-4 sentences max).`;

    let geminiReply = "";
    let openaiReply = "";

    const [geminiResult, openaiResult] = await Promise.allSettled([
      geminiAdapter.isConfigured()
        ? geminiAdapter.generate({
            systemPrompt:
              stageSystemPrompt +
              "\n\nYour angle: Focus on how this decision FEELS for the buyer. Empathetic and human.",
            userPrompt: stageUserPrompt,
            jsonSchema: synthSchema,
            schemaName: "ChatReply",
            temperature: 0.7,
            maxTokens: 300,
            timeoutMs: 6_000,
            signal: masterController.signal,
          })
        : Promise.reject(new Error("Gemini not configured")),
      openaiAdapter.isConfigured()
        ? openaiAdapter.generate({
            systemPrompt:
              stageSystemPrompt +
              "\n\nYour angle: Focus on specific numbers, flags, and technical facts. Data-driven.",
            userPrompt: stageUserPrompt,
            jsonSchema: synthSchema,
            schemaName: "ChatReply",
            temperature: 0.3,
            maxTokens: 300,
            timeoutMs: 6_000,
            signal: masterController.signal,
          })
        : Promise.reject(new Error("OpenAI not configured")),
    ]);

    if (geminiResult.status === "fulfilled") {
      geminiReply = (geminiResult.value.json.reply as string) || "";
      sources.push("gemini");
    }
    if (openaiResult.status === "fulfilled") {
      openaiReply = (openaiResult.value.json.reply as string) || "";
      sources.push("openai");
    }

    if (!geminiReply && !openaiReply) {
      // Both failed — graceful degradation
      fallback = true;
      const latencyMs = Date.now() - t0;
      persistAsync(sessionId, scenarioType, scenarioId, message, "I'm having trouble right now. Try refreshing or ask again.", sources, latencyMs, classify.intent, "fallback");
      return NextResponse.json({
        reply: "I'm having trouble right now. Try refreshing or ask again in a moment.",
        sources: [],
        latency_ms: latencyMs,
        fallback: true,
      });
    }

    // -------------------------------------------------------------------
    // Stage 4: Grok synthesis
    // -------------------------------------------------------------------
    let finalReply = "";
    const draftInputs = [geminiReply, openaiReply].filter(Boolean).join("\n\n---\n\n");

    if (grokAdapter.isConfigured()) {
      try {
        const synthResult = await grokAdapter.generate({
          systemPrompt: `${offoContext}\n\nYou are synthesizing two expert perspectives into a single OFFO voice response. OFFO is direct, honest, and buyer-first. Merge the drafts into one cohesive reply (3-5 sentences max). Don't repeat the same point twice.`,
          userPrompt: `User asked: "${message}"\n\nDraft perspectives:\n${draftInputs}\n\nSynthesize into a single OFFO response:`,
          jsonSchema: synthSchema,
          schemaName: "ChatReply",
          temperature: 0.3,
          maxTokens: 600,
          timeoutMs: 6_000,
          signal: masterController.signal,
        });
        finalReply = (synthResult.json.reply as string) || "";
        sources.push("grok_synth");
      } catch {
        // Fall through to best available
      }
    }

    // If Grok synthesis failed, use best available from Stage 3
    if (!finalReply) {
      finalReply = openaiReply || geminiReply;
      fallback = !finalReply;
    }

    if (!finalReply) {
      finalReply = "I'm having trouble right now. Try refreshing or ask again in a moment.";
      fallback = true;
    }

    const latencyMs = Date.now() - t0;
    const primaryModel = sources.includes("grok_synth")
      ? "grok"
      : sources.includes("openai")
      ? "openai"
      : "gemini";

    // Persist async (non-blocking)
    persistAsync(sessionId, scenarioType, scenarioId, message, finalReply, sources, latencyMs, classify.intent, primaryModel);

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
  modelUsed: string
) {
  if (!isSupabaseConfigured()) return;

  Promise.all([
    supabase.from("chat_messages").insert([
      { session_id: sessionId, scenario_type: scenarioType, scenario_id: scenarioId, role: "user", content: userMessage, sources_used: [] },
      { session_id: sessionId, scenario_type: scenarioType, scenario_id: scenarioId, role: "assistant", content: assistantReply, sources_used: sources, latency_ms: latencyMs },
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
