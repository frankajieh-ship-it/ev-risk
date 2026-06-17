/**
 * Anthropic Provider Adapter
 *
 * Wraps the Anthropic Messages API with tool_use for structured JSON output.
 * Used as a provider in the hedged generation pipeline.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ProviderAdapter, GenerateOpts, GenerateResult } from "./types";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 55_000,
      maxRetries: 0,
    });
  }
  return _client;
}

export const anthropicAdapter: ProviderAdapter = {
  name: "anthropic",

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  async generate(opts: GenerateOpts): Promise<GenerateResult> {
    const t0 = Date.now();
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

    // Use tool_use for guaranteed JSON output matching the schema
    const tool: Anthropic.Tool = {
      name: opts.schemaName,
      description: `Return structured ${opts.schemaName} JSON`,
      input_schema: opts.jsonSchema as Anthropic.Tool["input_schema"],
    };

    // Combine external abort + local timeout into one AbortController
    const localController = new AbortController();
    const timeoutMs = opts.timeoutMs ?? 45_000;
    const localTimeout = setTimeout(() => localController.abort(), timeoutMs);

    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(localTimeout);
        throw Object.assign(new Error("Aborted"), { name: "AbortError" });
      }
      opts.signal.addEventListener("abort", () => localController.abort(), { once: true });
    }

    try {
      const hasImages = (opts.imageUrls?.length ?? 0) > 0;
      type ContentBlock =
        | Anthropic.TextBlockParam
        | Anthropic.ImageBlockParam;

      const userContent: ContentBlock[] = [{ type: "text", text: opts.userPrompt }];
      if (hasImages) {
        for (const url of opts.imageUrls!.slice(0, 3)) {
          userContent.push({
            type: "image",
            source: { type: "url", url },
          });
        }
      }

      const response = await getClient().messages.create(
        {
          model,
          max_tokens: opts.maxTokens ?? 1800,
          system: opts.systemPrompt,
          messages: [
            {
              role: "user",
              content: hasImages ? userContent : opts.userPrompt,
            },
          ],
          tools: [tool],
          tool_choice: { type: "tool", name: opts.schemaName },
          temperature: opts.temperature ?? 0.3,
        },
        { signal: localController.signal }
      );

      clearTimeout(localTimeout);

      // Extract tool_use block
      const toolBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      if (!toolBlock) {
        throw new Error("Anthropic returned no tool_use block");
      }

      const json = toolBlock.input as Record<string, unknown>;
      const rawText = JSON.stringify(json);

      return {
        json,
        rawText,
        provider: "anthropic",
        latencyMs: Date.now() - t0,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (err) {
      clearTimeout(localTimeout);
      throw err;
    }
  },
};
