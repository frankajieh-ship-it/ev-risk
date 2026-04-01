/**
 * Pipeline Trace Persistence
 *
 * Fire-and-forget writes to pipeline_traces table.
 * Same pattern as lib/audit-logger.ts — never blocks the request path.
 */

import type { PipelineTrace } from "@/lib/debug-trace";

function getClient() {
  // Dynamic import to avoid loading Supabase on every cold start
  return import("@/lib/api-auth").then((m) => m.getSupabaseAdmin());
}

export function persistTrace(trace: PipelineTrace): void {
  getClient()
    .then((supabase) => {
      if (!supabase) return;
      return supabase.from("pipeline_traces").insert({
        id: trace.trace_id,
        pipeline: trace.pipeline,
        steps: trace.steps,
        timings: trace.timings,
        meta: trace.meta,
        total_latency_ms: trace.total_latency_ms,
        created_at: trace.created_at,
      });
    })
    .catch((err) => {
      console.warn("[debug-trace-store] persist failed:", err);
    });
}

export async function fetchTrace(traceId: string): Promise<PipelineTrace | null> {
  const supabase = await getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("pipeline_traces")
    .select("*")
    .eq("id", traceId)
    .single();

  if (error || !data) return null;

  return {
    trace_id: data.id,
    pipeline: data.pipeline,
    created_at: data.created_at,
    total_latency_ms: data.total_latency_ms ?? 0,
    steps: data.steps ?? [],
    timings: data.timings ?? {},
    meta: data.meta ?? {},
  };
}
