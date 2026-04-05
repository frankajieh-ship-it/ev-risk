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
    const hasImages = (opts.imageUrls?.length ?? 0) > 0;
    // gpt-4o-mini does not support vision — upgrade to gpt-4o when images present
    const model = hasImages
      ? (process.env.OPENAI_VISION_MODEL || "gpt-4o")
      : (process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18");

    type ContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" } };

    const userContent: ContentPart[] = [{ type: "text", text: opts.userPrompt }];
    if (hasImages) {
      for (const url of opts.imageUrls!.slice(0, 3)) {
        userContent.push({ type: "image_url", image_url: { url, detail: "low" } });
      }
    }

    // Enforce per-call timeout via AbortSignal (client-level timeout is 55s — too long)
    const localController = new AbortController();
    const timeoutMs = opts.timeoutMs ?? 45_000;
    const localTimeout = setTimeout(() => localController.abort(), timeoutMs);
    const signal = opts.signal
      ? AbortSignal.any([opts.signal, localController.signal])
      : localController.signal;

    try {
      const response = await getClient().chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: opts.systemPrompt },
            { role: "user", content: hasImages ? userContent : opts.userPrompt },
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
        { signal }
      );
      clearTimeout(localTimeout);

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
    } catch (err) {
      clearTimeout(localTimeout);
      throw err;
    }
  },
};
