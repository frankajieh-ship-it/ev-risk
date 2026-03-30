/**
 * Google Gemini Provider Adapter
 *
 * Uses @google/generative-ai with responseMimeType: "application/json".
 * Secondary provider in the hedged generation pipeline.
 *
 * Schema conversion: OpenAI json_schema format → Gemini responseSchema format.
 * Key differences:
 *   - Gemini uses "nullable: true" instead of anyOf with {type: "null"}
 *   - Gemini doesn't support "additionalProperties: false" (ignored)
 *   - Gemini uses "ARRAY", "OBJECT", "STRING", "NUMBER", "BOOLEAN" (uppercase type enum)
 *     but also accepts lowercase in recent SDK versions — we use lowercase for safety
 */

import { GoogleGenerativeAI, type SchemaType, type Part } from "@google/generative-ai";
import type { ProviderAdapter, GenerateOpts, GenerateResult } from "./types";

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  return _client;
}

/**
 * Convert OpenAI-style JSON schema to Gemini responseSchema format.
 * Handles:
 *   - anyOf with {type: "null"} → nullable: true
 *   - additionalProperties: false → stripped (unsupported)
 *   - const → enum with single value
 */
function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  // Handle anyOf: [{type: X}, {type: "null"}] → nullable field
  if (Array.isArray(schema.anyOf)) {
    const anyOf = schema.anyOf as Record<string, unknown>[];
    const nonNull = anyOf.filter((s) => s.type !== "null");
    const hasNull = anyOf.some((s) => s.type === "null");
    if (nonNull.length === 1) {
      const base = toGeminiSchema(nonNull[0]);
      return hasNull ? { ...base, nullable: true } : base;
    }
    // Multiple non-null types — just use the first
    return toGeminiSchema(nonNull[0]);
  }

  const result: Record<string, unknown> = {};

  if (schema.type) result.type = schema.type as SchemaType;
  if (schema.enum) result.enum = schema.enum;
  if (schema.description) result.description = schema.description;
  if (schema.nullable) result.nullable = schema.nullable;

  // Convert object properties recursively
  if (schema.type === "object" && schema.properties) {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    result.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, toGeminiSchema(v)])
    );
    if (Array.isArray(schema.required)) {
      result.required = schema.required;
    }
  }

  // Convert array items recursively
  if (schema.type === "array" && schema.items) {
    result.items = toGeminiSchema(schema.items as Record<string, unknown>);
  }

  return result;
}

export const geminiAdapter: ProviderAdapter = {
  name: "gemini",

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  },

  async generate(opts: GenerateOpts): Promise<GenerateResult> {
    const t0 = Date.now();
    const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

    const genModel = getClient().getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(opts.jsonSchema) as Parameters<
          typeof getClient extends (...args: unknown[]) => infer R
            ? R extends { getGenerativeModel: (...args: unknown[]) => infer M }
              ? M extends { generateContent: (...args: unknown[]) => unknown }
                ? typeof getClient
                : never
              : never
            : never
        >[0],
      },
    });

    // Build content parts — include image fileData parts when imageUrls provided
    const hasImages = (opts.imageUrls?.length ?? 0) > 0;
    const combinedText = `${opts.systemPrompt}\n\n${opts.userPrompt}`;

    // Build a combined abort from master signal + per-call timeout
    const timeoutMs = opts.timeoutMs ?? 8_000;
    const localController = new AbortController();
    const localTimeout = setTimeout(() => localController.abort(), timeoutMs);

    const abortPromise = new Promise<never>((_, reject) => {
      localController.signal.addEventListener("abort", () => reject(new Error("Aborted")));
      opts.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
    });

    let generatePromise: ReturnType<typeof genModel.generateContent>;
    if (hasImages) {
      const parts: Part[] = [
        { text: combinedText },
        ...opts.imageUrls!.slice(0, 3).map((url): Part => ({
          fileData: { mimeType: "image/jpeg", fileUri: url },
        })),
      ];
      generatePromise = genModel.generateContent({ contents: [{ role: "user", parts }] });
    } else {
      generatePromise = genModel.generateContent(combinedText);
    }

    let response: Awaited<typeof generatePromise>;
    try {
      response = await Promise.race([generatePromise, abortPromise]);
    } finally {
      clearTimeout(localTimeout);
    }

    const rawText = response.response.text();
    const json = JSON.parse(rawText) as Record<string, unknown>;
    const usage = response.response.usageMetadata;

    return {
      json,
      rawText,
      provider: "gemini",
      latencyMs: Date.now() - t0,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
    };
  },
};
