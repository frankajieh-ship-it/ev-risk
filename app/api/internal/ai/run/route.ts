/**
 * POST /api/internal/ai/run
 *
 * Generic AI task runner — Next.js equivalent of the Python chain_runner.run_task().
 * Looks up a registered task by task_id, calls the appropriate provider,
 * returns validated output with timing.
 *
 * Internal server-to-server only (INTERNAL_API_SECRET required).
 *
 * Body:
 *   {
 *     task_id: string,
 *     messages: Array<{role: "system"|"user"|"assistant", content: string}>,
 *     inputs?: Record<string, unknown>   // optional context merged into first user message
 *   }
 *
 * Returns:
 *   { status, task_id, output, model_used, duration_ms }
 */

import { NextRequest, NextResponse } from "next/server";
import { openaiAdapter } from "@/lib/providers/openai-adapter";
import { grokAdapter } from "@/lib/providers/grok-adapter";

export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Inline task registry (no separate file needed — tasks are few and stable)
// ---------------------------------------------------------------------------

interface TaskDef {
  model: "openai" | "grok" | "gemini";
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
  jsonSchema: Record<string, unknown>;
  schemaName: string;
  systemPrompt: string;
}

const TASKS: Record<string, TaskDef> = {
  garage_news_relevance: {
    model: "grok",
    temperature: 0.1,
    maxTokens: 400,
    jsonSchema: {
      type: "object",
      required: ["relevant", "relevance_score", "reason"],
      properties: {
        relevant: { type: "boolean" },
        relevance_score: { type: "integer", minimum: 0, maximum: 100 },
        reason: { type: "string", maxLength: 120 },
      },
    },
    schemaName: "news_relevance",
    systemPrompt:
      "You assess whether a news article is relevant to a specific EV owner's routine and garage vehicle. Respond ONLY with valid JSON.",
  },
  buyer_profile_summary: {
    model: "openai",
    temperature: 0.2,
    maxTokens: 600,
    jsonSchema: {
      type: "object",
      required: ["profile_type", "priorities", "best_vehicles", "talking_points"],
      properties: {
        profile_type: { type: "string", maxLength: 40 },
        priorities: { type: "array", items: { type: "string" }, maxItems: 5 },
        best_vehicles: { type: "array", items: { type: "string" }, maxItems: 5 },
        talking_points: { type: "array", items: { type: "string" }, maxItems: 4 },
      },
    },
    schemaName: "buyer_profile_summary",
    systemPrompt:
      "You generate anonymized buyer profile summaries for EV dealers. No PII. Respond ONLY with valid JSON.",
  },
  pricing_explanation: {
    model: "openai",
    temperature: 0.3,
    maxTokens: 400,
    jsonSchema: {
      type: "object",
      required: ["headline", "why", "action", "caveats"],
      properties: {
        headline: { type: "string", maxLength: 80 },
        why: { type: "string", maxLength: 200 },
        action: { type: "string", maxLength: 120 },
        caveats: { type: "array", items: { type: "string", maxLength: 80 }, maxItems: 3 },
      },
    },
    schemaName: "pricing_explanation",
    systemPrompt:
      "You are a concise EV market pricing advisor for car dealerships. Be direct and actionable. Respond ONLY with valid JSON.",
  },
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;
  if (expected && secret === expected) return true;
  const serviceKey = req.headers.get("x-service-role-key");
  if (
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return true;
  return false;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    task_id?: string;
    messages?: Array<{ role: string; content: string }>;
    inputs?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { task_id, messages = [], inputs } = body;

  if (!task_id) {
    return NextResponse.json({ error: "task_id is required" }, { status: 400 });
  }

  const task = TASKS[task_id];
  if (!task) {
    return NextResponse.json(
      { error: `Unknown task_id: ${task_id}. Valid: ${Object.keys(TASKS).join(", ")}` },
      { status: 400 }
    );
  }

  if (!messages.length) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  // Select provider adapter
  const adapter = task.model === "grok" ? grokAdapter : openaiAdapter;

  if (!adapter.isConfigured()) {
    return NextResponse.json(
      { error: `Provider "${task.model}" is not configured` },
      { status: 503 }
    );
  }

  // Build prompts from messages array
  const systemMsg = messages.find((m) => m.role === "system");
  const userMsgs = messages.filter((m) => m.role === "user");
  const systemPrompt = systemMsg?.content || task.systemPrompt;
  let userPrompt = userMsgs.map((m) => m.content).join("\n\n");

  // Append inputs as context if provided
  if (inputs && Object.keys(inputs).length > 0) {
    const inputLines = Object.entries(inputs)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n");
    userPrompt = `${userPrompt}\n\nContext:\n${inputLines}`;
  }

  const startMs = Date.now();
  try {
    const result = await adapter.generate({
      systemPrompt,
      userPrompt,
      jsonSchema: task.jsonSchema,
      schemaName: task.schemaName,
      temperature: task.temperature,
      maxTokens: task.maxTokens,
      timeoutMs: task.timeoutMs ?? 15000,
    });

    return NextResponse.json({
      status: "ok",
      task_id,
      output: result.json,
      model_used: result.provider,
      duration_ms: Date.now() - startMs,
    });
  } catch (err) {
    console.error(`[ai/run] Task ${task_id} failed:`, err);
    return NextResponse.json(
      {
        status: "error",
        task_id,
        error: err instanceof Error ? err.message : "AI task failed",
        duration_ms: Date.now() - startMs,
      },
      { status: 502 }
    );
  }
}
