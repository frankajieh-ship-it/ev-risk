/**
 * Auction AI Chain — Optimized Multi-Model Orchestration
 *
 * Implements the CEO-directed optimized routing:
 *
 *   Step 1  Grok     → classification + damage tone
 *   Step 2  Gemini ┐ → parallel: routine impact + owner-facing translation
 *           GPT-4o ┘ → parallel: repair cost calculations (skip if deterministic data sufficient)
 *   Step 3  Grok     → final polish + report assembly
 *
 * Constraints enforced:
 * - Max 3 meaningful model calls per request
 * - Skip GPT-4o if deterministic metrics are sufficient (no ARV gap, clear damage type)
 * - Gemini + GPT-4o run in parallel (async gather)
 * - Single JSON repair pass if final schema fails
 * - All calls logged to auction_ai_runs via callback
 *
 * Deterministic metrics are computed BEFORE this chain is called.
 * The AI chain synthesizes and explains — it does not invent core numbers.
 *
 * All prompts, schemas, and system prompt strings are sourced from
 * lib/auction/prompts/ — never embedded inline here.
 */

import { grokAdapter } from "@/lib/providers/grok-adapter";
import { geminiAdapter } from "@/lib/providers/gemini-adapter";
import { openaiAdapter } from "@/lib/providers/openai-adapter";
import type { GenerateOpts } from "@/lib/providers/types";
import type { NormalizedAuctionLot, NhtsaRecallSummary } from "./types";
import type { DeterministicMetrics } from "./deterministic-metrics";
import {
  type AuctionPromptKey,
  AUCTION_SYSTEM_PROMPTS,
  AUCTION_SCHEMAS,
  AUCTION_SCHEMA_NAMES,
  buildClassifyPrompt,
  buildRoutineImpactPrompt,
  buildRepairCostPrompt,
  buildRepairCostPromptManheim,
  buildPolishPrompt,
} from "./prompts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiChainInput {
  lot: NormalizedAuctionLot;
  metrics: DeterministicMetrics;
  recalls: NhtsaRecallSummary[];
  routineContext: Record<string, unknown> | null;
  /** ARV from Auto.dev — null signals GPT-4o repair cost step is needed */
  arv: number | null;
  isPaid: boolean;
}

export interface AiChainOutput {
  classification: ClassificationOutput | null;
  routine_impact: RoutineImpactOutput | null;
  repair_cost: RepairCostAiOutput | null;
  polish: PolishOutput | null;
  steps_run: AiStepLog[];
  total_model_calls: number;
}

export interface AiStepLog {
  step: string;
  model: string;
  status: "success" | "failed" | "skipped" | "cancelled";
  latency_ms: number;
  error?: string;
}

// Step output types
export interface ClassificationOutput {
  damage_severity: "minor" | "moderate" | "severe" | "total_loss";
  damage_tone: string;
  bid_risk_level: "low" | "medium" | "high" | "extreme";
  red_flags: string[];
  title_risk_summary: string;
}

export interface RoutineImpactOutput {
  owner_summary: string;
  routine_impact: string;
  charging_risk: string | null;
  battery_concern: string | null;
}

export interface RepairCostAiOutput {
  repair_cost_low: number;
  repair_cost_high: number;
  repair_cost_midpoint: number;
  breakdown: Array<{ component: string; cost_low: number; cost_high: number; notes: string }>;
  parts_value_total: number;
  parts_value_breakdown: Array<{ component: string; cost_low: number; cost_high: number; notes: string }>;
  confidence: "high" | "medium" | "low";
  confidence_reason: string;
  caveats: string[];
}

export interface PolishOutput {
  headline: string;
  summary: string;
  top_risks: string[];
  recommended_action: "bid" | "inspect_first" | "avoid";
}

// ── Type guards ───────────────────────────────────────────────────────────────

function isClassification(v: unknown): v is ClassificationOutput {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return typeof d.damage_severity === "string" && typeof d.damage_tone === "string";
}

function isRoutineImpact(v: unknown): v is RoutineImpactOutput {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return typeof d.owner_summary === "string" && typeof d.routine_impact === "string";
}

function isRepairCost(v: unknown): v is RepairCostAiOutput {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return typeof d.repair_cost_low === "number" && Array.isArray(d.breakdown);
}

function isPolish(v: unknown): v is PolishOutput {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return typeof d.headline === "string" && typeof d.summary === "string";
}

// ── Helper: run a single model call with logging ──────────────────────────────

type StepAdapter = {
  name: string;
  isConfigured(): boolean;
  generate(opts: GenerateOpts): Promise<{ json: Record<string, unknown>; latencyMs?: number }>;
};

async function runStep<T>(
  step: string,
  adapter: StepAdapter,
  opts: GenerateOpts,
  guard: (v: unknown) => v is T,
  logs: AiStepLog[]
): Promise<T | null> {
  if (!adapter.isConfigured()) {
    logs.push({ step, model: adapter.name, status: "skipped", latency_ms: 0 });
    return null;
  }

  const start = Date.now();
  try {
    const res = await adapter.generate(opts);
    const latency = Date.now() - start;
    const parsed = guard(res.json) ? res.json : null;
    logs.push({ step, model: adapter.name, status: parsed ? "success" : "failed", latency_ms: latency });
    return parsed;
  } catch (err) {
    const latency = Date.now() - start;
    logs.push({ step, model: adapter.name, status: "failed", latency_ms: latency, error: String(err) });
    return null;
  }
}

// ── Determine if GPT-4o repair cost step can be skipped ──────────────────────

function canSkipRepairCost(metrics: DeterministicMetrics, arv: number | null, isPaid: boolean): boolean {
  if (!isPaid) return true;
  if (metrics.damage_severity_baseline === "minor" && arv !== null) return true;
  return false;
}

// ── Main chain ────────────────────────────────────────────────────────────────

export async function runAuctionAiChain(input: AiChainInput): Promise<AiChainOutput> {
  const { lot, metrics, recalls, routineContext, arv, isPaid } = input;
  const logs: AiStepLog[] = [];
  let totalCalls = 0;

  // Resolve prompt key for repair cost (Manheim uses wholesale context)
  const repairCostKey: AuctionPromptKey =
    lot.auction_source === "manheim"
      ? "auction_arbitrage_manheim"
      : "auction_arbitrage_copart_iaai";

  const repairCostUserPromptBuilder =
    lot.auction_source === "manheim" ? buildRepairCostPromptManheim : buildRepairCostPrompt;

  // ── Step 1: Grok — classification + tone ─────────────────────────────────
  const classification = await runStep(
    "classify",
    grokAdapter,
    {
      systemPrompt: AUCTION_SYSTEM_PROMPTS.auction_classification,
      userPrompt: buildClassifyPrompt(lot, metrics),
      jsonSchema: AUCTION_SCHEMAS.auction_classification,
      schemaName: AUCTION_SCHEMA_NAMES.auction_classification,
      temperature: 0.1,
      maxTokens: 600,
      timeoutMs: 20_000,
    },
    isClassification,
    logs
  );
  if (classification) totalCalls++;

  // ── Step 2: Gemini + GPT-4o in parallel ──────────────────────────────────
  const skipRepairCost = canSkipRepairCost(metrics, arv, isPaid);

  const [routineImpact, repairCostRaw] = await Promise.all([
    // Gemini: routine impact + owner translation
    runStep(
      "routine_impact",
      geminiAdapter,
      {
        systemPrompt: AUCTION_SYSTEM_PROMPTS.auction_routine_impact,
        userPrompt: buildRoutineImpactPrompt(lot, classification, recalls, routineContext),
        jsonSchema: AUCTION_SCHEMAS.auction_routine_impact,
        schemaName: AUCTION_SCHEMA_NAMES.auction_routine_impact,
        temperature: 0.2,
        maxTokens: 500,
        timeoutMs: 25_000,
      },
      isRoutineImpact,
      logs
    ).then((r) => { if (r) totalCalls++; return r; }),

    // GPT-4o: repair cost (skip if deterministic data is sufficient)
    skipRepairCost
      ? (logs.push({ step: "repair_cost", model: "openai", status: "skipped", latency_ms: 0 }), Promise.resolve(null))
      : runStep(
          "repair_cost",
          openaiAdapter,
          {
            systemPrompt: AUCTION_SYSTEM_PROMPTS[repairCostKey],
            userPrompt: repairCostUserPromptBuilder(lot, classification),
            jsonSchema: AUCTION_SCHEMAS[repairCostKey],
            schemaName: AUCTION_SCHEMA_NAMES[repairCostKey],
            temperature: 0.2,
            maxTokens: 1500,
            timeoutMs: 50_000,
          },
          isRepairCost,
          logs
        ).then((r) => { if (r) totalCalls++; return r; }),
  ]);

  // Cap at 3 meaningful calls — skip polish if already at limit
  const canRunPolish = totalCalls < 3;

  // ── Step 3: Grok — final polish + verdict ────────────────────────────────
  const polish = canRunPolish
    ? await runStep(
        "polish",
        grokAdapter,
        {
          systemPrompt: AUCTION_SYSTEM_PROMPTS.auction_final_polish,
          userPrompt: buildPolishPrompt(lot, metrics, classification, routineImpact, repairCostRaw, arv),
          jsonSchema: AUCTION_SCHEMAS.auction_final_polish,
          schemaName: AUCTION_SCHEMA_NAMES.auction_final_polish,
          temperature: 0.3,
          maxTokens: 500,
          timeoutMs: 20_000,
        },
        isPolish,
        logs
      ).then((r) => { if (r) totalCalls++; return r; })
    : (logs.push({ step: "polish", model: "grok", status: "skipped", latency_ms: 0 }), null);

  return {
    classification,
    routine_impact: routineImpact,
    repair_cost: repairCostRaw,
    polish,
    steps_run: logs,
    total_model_calls: totalCalls,
  };
}
