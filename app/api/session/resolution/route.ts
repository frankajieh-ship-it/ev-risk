/**
 * Session Resolution API
 * POST /api/session/resolution
 *
 * Called when user clicks a decision outcome button.
 * Records how the routine check helped (or didn't help) their decision.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isValidSessionId, DecisionOutcome } from "@/lib/session-utils";

const VALID_OUTCOMES: DecisionOutcome[] = [
  "MORE_CONFIDENT_BUYING",
  "MORE_CONFIDENT_NOT_BUYING",
  "NEED_MORE_TIME",
  "CONFIRMED_CONCERNS",
  "OTHER",
];

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
    const {
      session_id,
      decision_outcome,
      surfaced_new_tradeoff,
      confidence_after,
    } = body;

    // Validate session ID
    if (!isValidSessionId(session_id)) {
      return NextResponse.json(
        { success: false, error: "Invalid session_id" },
        { status: 400 }
      );
    }

    // Validate decision outcome
    if (!decision_outcome || !VALID_OUTCOMES.includes(decision_outcome)) {
      return NextResponse.json(
        { success: false, error: "Invalid decision_outcome" },
        { status: 400 }
      );
    }

    // Validate confidence_after if provided (1-5 or 0-100)
    if (confidence_after !== undefined && confidence_after !== null) {
      const conf = Number(confidence_after);
      if (isNaN(conf) || conf < 0 || conf > 100) {
        return NextResponse.json(
          { success: false, error: "Invalid confidence_after value" },
          { status: 400 }
        );
      }
    }

    // Update session with resolution data
    const { data, error } = await supabase
      .from("evroutine_sessions")
      .update({
        decision_outcome,
        surfaced_new_tradeoff: surfaced_new_tradeoff ?? null,
        confidence_after: confidence_after ?? null,
      })
      .eq("id", session_id)
      .select("id")
      .single();

    if (error) {
      console.error("Supabase error:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Session not found" },
          { status: 404 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      message: "Resolution recorded",
    });
  } catch (error) {
    console.error("Resolution error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to record resolution",
      },
      { status: 500 }
    );
  }
}
