/**
 * Auction Prompt Registry
 *
 * Central store for all auction AI step prompts, schemas, and schema names.
 * Keyed by AuctionPromptKey.
 *
 * Rule: No auction prompts may be embedded inline in route handlers or
 * orchestrator files. All AI step configurations are sourced from here.
 *
 * Builder functions are exported directly from their per-step files and
 * called by name in auction-ai-chain.ts — they are not part of the registry
 * lookup to avoid heterogeneous generic constraints.
 */

export type AuctionPromptKey =
  | "auction_classification"
  | "auction_routine_impact"
  | "auction_arbitrage_copart_iaai"
  | "auction_arbitrage_manheim"
  | "auction_final_polish";

// Re-export all builders and schemas from step files
export {
  CLASSIFICATION_SYSTEM_PROMPT,
  CLASSIFICATION_SCHEMA,
  CLASSIFICATION_SCHEMA_NAME,
  buildClassifyPrompt,
} from "./classify";

export {
  ROUTINE_IMPACT_SYSTEM_PROMPT,
  ROUTINE_IMPACT_SCHEMA,
  ROUTINE_IMPACT_SCHEMA_NAME,
  buildRoutineImpactPrompt,
} from "./routine-impact";

export {
  REPAIR_COST_SYSTEM_PROMPT_COPART_IAAI,
  REPAIR_COST_SYSTEM_PROMPT_MANHEIM,
  REPAIR_COST_SCHEMA,
  REPAIR_COST_SCHEMA_NAME,
  buildRepairCostPrompt,
  buildRepairCostPromptManheim,
} from "./repair-cost";

export {
  POLISH_SYSTEM_PROMPT,
  POLISH_SCHEMA,
  POLISH_SCHEMA_NAME,
  buildPolishPrompt,
} from "./polish";

// ── Registry lookups (system prompts, schemas, schema names) ──────────────────

import {
  CLASSIFICATION_SYSTEM_PROMPT,
  CLASSIFICATION_SCHEMA,
  CLASSIFICATION_SCHEMA_NAME,
} from "./classify";
import {
  ROUTINE_IMPACT_SYSTEM_PROMPT,
  ROUTINE_IMPACT_SCHEMA,
  ROUTINE_IMPACT_SCHEMA_NAME,
} from "./routine-impact";
import {
  REPAIR_COST_SYSTEM_PROMPT_COPART_IAAI,
  REPAIR_COST_SYSTEM_PROMPT_MANHEIM,
  REPAIR_COST_SCHEMA,
  REPAIR_COST_SCHEMA_NAME,
} from "./repair-cost";
import {
  POLISH_SYSTEM_PROMPT,
  POLISH_SCHEMA,
  POLISH_SCHEMA_NAME,
} from "./polish";

export const AUCTION_SYSTEM_PROMPTS: Record<AuctionPromptKey, string> = {
  auction_classification: CLASSIFICATION_SYSTEM_PROMPT,
  auction_routine_impact: ROUTINE_IMPACT_SYSTEM_PROMPT,
  auction_arbitrage_copart_iaai: REPAIR_COST_SYSTEM_PROMPT_COPART_IAAI,
  auction_arbitrage_manheim: REPAIR_COST_SYSTEM_PROMPT_MANHEIM,
  auction_final_polish: POLISH_SYSTEM_PROMPT,
};

export const AUCTION_SCHEMAS: Record<AuctionPromptKey, Record<string, unknown>> = {
  auction_classification: CLASSIFICATION_SCHEMA,
  auction_routine_impact: ROUTINE_IMPACT_SCHEMA,
  auction_arbitrage_copart_iaai: REPAIR_COST_SCHEMA,
  auction_arbitrage_manheim: REPAIR_COST_SCHEMA,
  auction_final_polish: POLISH_SCHEMA,
};

export const AUCTION_SCHEMA_NAMES: Record<AuctionPromptKey, string> = {
  auction_classification: CLASSIFICATION_SCHEMA_NAME,
  auction_routine_impact: ROUTINE_IMPACT_SCHEMA_NAME,
  auction_arbitrage_copart_iaai: REPAIR_COST_SCHEMA_NAME,
  auction_arbitrage_manheim: REPAIR_COST_SCHEMA_NAME,
  auction_final_polish: POLISH_SCHEMA_NAME,
};
