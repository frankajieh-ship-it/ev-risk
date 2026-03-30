/**
 * Provider Adapter Interface
 *
 * Defines the contract for all AI provider implementations.
 * Each provider (OpenAI, Gemini, Grok) implements ProviderAdapter.
 */

export type ProviderName = "openai" | "gemini" | "grok";

export interface GenerateOpts {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  schemaName: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Optional image URLs for vision analysis (max 3). Providers that don't support
   *  vision will silently ignore this field. */
  imageUrls?: string[];
}

export interface GenerateResult {
  json: Record<string, unknown>;
  rawText: string;
  provider: ProviderName;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ProviderAdapter {
  name: ProviderName;
  isConfigured(): boolean;
  generate(opts: GenerateOpts): Promise<GenerateResult>;
}

export interface HedgeResult {
  result: GenerateResult;
  hedgeLevel: 0 | 1 | 2;  // 0=primary won, 1=secondary won, 2=tertiary won
  allAttempts: number;
}

export class AllProvidersFailedError extends Error {
  readonly attempts: number;
  constructor(attempts: number, message?: string) {
    super(message ?? `All ${attempts} provider(s) failed to return a valid response`);
    this.name = "AllProvidersFailedError";
    this.attempts = attempts;
  }
}
