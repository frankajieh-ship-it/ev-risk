/**
 * Pipeline Debug Trace
 *
 * Opt-in tracing system for receipt, auction, and routine pipelines.
 * Zero impact on production paths — only active when debug_trace: true
 * is passed in the request body or the token is an internal tester token.
 *
 * Plugs into existing:
 *   - AiStepLog[] from lib/auction/auction-ai-chain.ts
 *   - timings: Record<string, number> already in app/api/receipt/route.ts
 */

import { randomUUID } from "crypto";
import type { AiStepLog } from "@/lib/auction/auction-ai-chain";

export interface PipelineStep {
  name: string;
  model?: string;
  status: "success" | "failed" | "skipped";
  input_summary?: string;
  output_summary?: string;
  latency_ms: number;
}

export interface PipelineTrace {
  trace_id: string;
  pipeline: "receipt" | "auction" | "routine";
  created_at: string;
  total_latency_ms: number;
  steps: PipelineStep[];
  timings: Record<string, number>;
  meta: Record<string, unknown>;
}

export function createTrace(pipeline: PipelineTrace["pipeline"]): PipelineTrace {
  return {
    trace_id: randomUUID(),
    pipeline,
    created_at: new Date().toISOString(),
    total_latency_ms: 0,
    steps: [],
    timings: {},
    meta: {},
  };
}

export function stepsFromAiChain(logs: AiStepLog[]): PipelineStep[] {
  return logs.map((log) => ({
    name: log.step,
    model: log.model,
    status: log.status === "cancelled" ? "failed" : log.status,
    latency_ms: log.latency_ms,
    ...(log.error ? { output_summary: `error: ${log.error}` } : {}),
  }));
}

export function finalizeTrace(
  trace: PipelineTrace,
  meta: Record<string, unknown>
): PipelineTrace {
  trace.total_latency_ms = Date.now() - new Date(trace.created_at).getTime();
  trace.meta = { ...trace.meta, ...meta };
  return trace;
}
