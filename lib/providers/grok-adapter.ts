/**
 * Grok (xAI) Provider Adapter
 *
 * xAI's API is OpenAI-compatible — reuses the openai npm package
 * with a custom baseURL. No additional SDK required.
 * Tertiary provider in the hedged generation pipeline.
 */

import OpenAI from "openai";
import type { ProviderAdapter, GenerateOpts, GenerateResult } from "./types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.GROK_API_KEY,
      baseURL: "https://api.x.ai/v1",
      timeout: 55_000,
      maxRetries: 0,
    });
  }
  return _client;
}

export const grokAdapter: ProviderAdapter = {
  name: "grok",

  isConfigured(): boolean {
    return Boolean(process.env.GROK_API_KEY);
  },

  async generate(opts: GenerateOpts): Promise<GenerateResult> {
    const t0 = Date.now();
    const model = process.env.GROK_MODEL || "grok-3-mini";

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
      { signal: opts.signal }
    );

    const rawText = response.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(rawText) as Record<string, unknown>;

    return {
      json,
      rawText,
      provider: "grok",
      latencyMs: Date.now() - t0,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  },
};
