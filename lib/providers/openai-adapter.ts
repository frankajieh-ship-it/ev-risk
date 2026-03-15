/**
 * OpenAI Provider Adapter
 *
 * Wraps the OpenAI chat completions API with Structured Outputs (json_schema + strict).
 * Primary provider in the hedged generation pipeline.
 */

import OpenAI from "openai";
import type { ProviderAdapter, GenerateOpts, GenerateResult } from "./types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 55_000,
      maxRetries: 0,
    });
  }
  return _client;
}

export const openaiAdapter: ProviderAdapter = {
  name: "openai",

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  },

  async generate(opts: GenerateOpts): Promise<GenerateResult> {
    const t0 = Date.now();
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

    const response = await getClient().chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: opts.schemaName,
            strict: true,
            schema: opts.jsonSchema,
          },
        },
      },
      // Pass AbortSignal so the hedge orchestrator can cancel in-flight calls
      { signal: opts.signal }
    );

    const rawText = response.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(rawText) as Record<string, unknown>;

    return {
      json,
      rawText,
      provider: "openai",
      latencyMs: Date.now() - t0,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  },
};
