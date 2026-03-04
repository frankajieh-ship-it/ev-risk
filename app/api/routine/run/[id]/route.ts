/**
 * Single Routine Run Fetch API
 * GET /api/routine/run/{id}?anon_session_id=psess_xxx
 *
 * Returns a single routine run's full data for the results page DB fallback.
 * Verifies ownership via profile join.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const { id: runId } = await params;
  const anonSessionId = req.nextUrl.searchParams.get("anon_session_id");

  if (!runId) {
    return NextResponse.json(
      { success: false, error: "Missing run ID" },
      { status: 400 }
    );
  }
  if (!anonSessionId || anonSessionId.length < 5) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid anon_session_id" },
      { status: 400 }
    );
  }

  try {
    // Fetch run and verify ownership via profile
    const { data: run, error: runError } = await supabase
      .from("routine_runs")
      .select("id, inputs_json, outputs_json, profile_id, created_at")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    const { data: profile } = await supabase
      .from("routine_profiles")
      .select("anon_session_id")
      .eq("id", run.profile_id)
      .single();

    if (!profile || profile.anon_session_id !== anonSessionId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch associated Plan B card
    const { data: planBCard } = await supabase
      .from("plan_b_cards")
      .select("plan_summary, anchor_charger_name, backup_charger_name, time_penalty_minutes, stress_label, mitigation_steps, buffer_rule, rank_score")
      .eq("run_id", runId)
      .maybeSingle();

    // Build response in same shape as POST /api/routine/run
    const inputs = run.inputs_json as Record<string, unknown>;
    const planB = planBCard || {
      plan_summary: "No Plan B data available.",
      mitigation_steps: [],
      buffer_rule: "",
      time_penalty_minutes: 0,
      stress_label: "moderate",
      rank_score: 50,
    };

    return NextResponse.json({
      success: true,
      run_id: run.id,
      fit_score: run.outputs_json,
      plan_b: planB,
      weather_data: inputs.weather || null,
      nearby_chargers: [],
      inputs_json: inputs,
    });
  } catch (error) {
    console.error("[RoutineRunFetch] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch run" },
      { status: 500 }
    );
  }
}
