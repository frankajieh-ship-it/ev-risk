/**
 * Routine History API
 * GET /api/routine/history?anon_session_id=psess_xxx
 *
 * Returns past routine runs for a session with summary data and total count.
 * Used by /routine page to show scenario history and enforce 3-free limit.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const anonSessionId = req.nextUrl.searchParams.get("anon_session_id");
  if (!anonSessionId || anonSessionId.length < 5) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid anon_session_id" },
      { status: 400 }
    );
  }

  try {
    // Get profile IDs for this session
    const { data: profiles } = await supabase
      .from("routine_profiles")
      .select("id")
      .eq("anon_session_id", anonSessionId);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        success: true,
        runs: [],
        total_count: 0,
      });
    }

    const profileIds = profiles.map((p) => p.id);

    // Fetch runs for all profiles
    const { data: runs, count } = await supabase
      .from("routine_runs")
      .select(
        "id, created_at, fit_label, friction_score, break_first_reason, stress_level, confidence_level, scenario_name, run_type, inputs_json",
        { count: "exact" }
      )
      .in("profile_id", profileIds)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      runs: runs || [],
      total_count: count ?? 0,
    });
  } catch (error) {
    console.error("[RoutineHistory] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
