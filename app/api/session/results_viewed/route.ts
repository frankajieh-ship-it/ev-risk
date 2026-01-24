/**
 * Session Results Viewed API
 * POST /api/session/results_viewed
 *
 * Called when the results page renders.
 * Tracks when user actually views their results.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isValidSessionId } from "@/lib/session-utils";

export async function POST(req: NextRequest) {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Session tracking not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { session_id } = body;

    // Validate session ID
    if (!isValidSessionId(session_id)) {
      return NextResponse.json(
        { success: false, error: "Invalid session_id" },
        { status: 400 }
      );
    }

    // Update session with results viewed timestamp (only if not already set)
    const { data, error } = await supabase
      .from("evroutine_sessions")
      .update({
        results_viewed_at: new Date().toISOString(),
      })
      .eq("id", session_id)
      .is("results_viewed_at", null) // Only update if not already set
      .select("id");

    if (error) {
      console.error("Supabase error:", error);
      throw new Error(error.message);
    }

    // Note: We don't error if already viewed - just silently succeed
    return NextResponse.json({
      success: true,
      message: (data?.length ?? 0) > 0 ? "Results viewed recorded" : "Already recorded",
    });
  } catch (error) {
    console.error("Results viewed error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to record results viewed",
      },
      { status: 500 }
    );
  }
}
