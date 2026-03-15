/**
 * Provider Layer — Public API
 *
 * Re-exports the hedged generation orchestrator and supporting utilities.
 * Import from here, not from individual adapter files.
 */

export { hedgedGenerate } from "./hedged-generate";
export type { HedgeOpts, HedgeEvent } from "./hedged-generate";

export { getProviderOrder, recordSuccess, recordFailure, getFailureRate } from "./circuit-breaker";

export { estimateCost, logReceiptCost } from "./cost-tracker";

export type {
  ProviderAdapter,
  ProviderName,
  GenerateOpts,
  GenerateResult,
  HedgeResult,
  ValidationResult,
} from "./types";
export { AllProvidersFailedError } from "./types";
