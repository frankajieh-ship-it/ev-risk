/**
 * POST /api/routine/refine
 *
 * Lightweight telemetry endpoint for the Top 3 narrowing step.
 * No computation — just emits refine_started or refine_completed
 * to user_events and returns { ok: true }.
 *
 * Called fire-and-forget from RefineStep.tsx.
 */

import { NextRequest, NextResponse } from "next/server";
import { trackServerEvent } from "@/lib/track-server-event";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // Tracking — never fail the caller
  }

  const event = body.event as string | undefined;
  const fit_session_id = (body.fit_session_id as string | undefined) ?? null;
  const session_id = (body.session_id as string | undefined) ?? null;
  const anon_id = (body.anon_id as string | undefined) ?? null;

  if (event === "started") {
    await trackServerEvent({
      event_name: "refine_started",
      source: "refine",
      anon_id,
      session_id,
      entity_type: "fit_session_id",
      entity_id: fit_session_id ?? "_",
      page_path: "/routine",
      payload: {
        fit_session_id,
        tie_cluster_count: body.tie_cluster_count ?? null,
      },
    });
  } else if (event === "completed") {
    await trackServerEvent({
      event_name: "refine_completed",
      source: "refine",
      anon_id,
      session_id,
      entity_type: "fit_session_id",
      entity_id: fit_session_id ?? "_",
      page_path: "/routine",
      payload: {
        fit_session_id,
        tie_break_mode: body.tie_break_mode ?? "filters",
        winner_declared: body.winner_declared ?? false,
        top3_models: body.top3_models ?? [],
        tie_break_factors_used: body.tie_break_factors_used ?? [],
        latency_ms: body.latency_ms ?? null,
      },
    });
  }
  // Unknown event values are ignored — tracking never fails the caller

  return NextResponse.json({ ok: true });
}
