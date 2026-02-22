/**
 * OpenAI Latency Diagnostic
 *
 * GET /api/debug-openai
 * Makes a minimal OpenAI gpt-4o-mini call and reports timing.
 * Protected by ADMIN_API_KEY header.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const t0 = Date.now();

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 20_000,
      maxRetries: 0,
    });

    // Minimal call — ~50 input tokens, ~20 output tokens
    const resp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Reply with a single JSON object." },
        { role: "user", content: 'Return {"status":"ok","model":"' + model + '"}' },
      ],
      temperature: 0,
      max_tokens: 50,
      response_format: { type: "json_object" },
    });

    const latency = Date.now() - t0;
    const content = resp.choices[0]?.message?.content || "{}";
    const usage = resp.usage;

    return NextResponse.json({
      ok: true,
      latency_ms: latency,
      model_used: resp.model,
      model_requested: model,
      content,
      usage: {
        prompt_tokens: usage?.prompt_tokens,
        completion_tokens: usage?.completion_tokens,
        total_tokens: usage?.total_tokens,
      },
      openai_key_prefix: process.env.OPENAI_API_KEY?.slice(0, 8) + "...",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const latency = Date.now() - t0;
    const error = err instanceof Error ? err : new Error(String(err));

    return NextResponse.json({
      ok: false,
      latency_ms: latency,
      error_name: error.name,
      error_message: error.message,
      model_requested: model,
      openai_key_prefix: process.env.OPENAI_API_KEY?.slice(0, 8) + "...",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
