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
    const hasImages = (opts.imageUrls?.length ?? 0) > 0;
    // grok-3-mini-fast is lower latency than grok-3-mini — use it unless overridden
    // grok-3-mini-fast does not support vision — upgrade to grok-2-vision when images present
    const model = hasImages
      ? (process.env.GROK_VISION_MODEL || "grok-2-vision-1212")
      : (process.env.GROK_MODEL || "grok-3-mini-fast");

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
    const timeoutMs = opts.timeoutMs ?? 15_000;
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
        provider: "grok",
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
