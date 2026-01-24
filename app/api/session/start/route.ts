/**
 * Session Start API
 * POST /api/session/start
 *
 * Creates a new session when user begins the routine check.
 * Returns session_id for tracking through the flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { hashIP, getClientIP } from "@/lib/session-utils";

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
      region = "AUTO",
      source = "direct",
      source_detail,
      thread_type,
      referrer,
      utm = {},
    } = body;

    // Get client metadata
    const ip = getClientIP(req.headers);
    const ipHash = hashIP(ip);
    const userAgent = req.headers.get("user-agent") || null;

    // Create session
    const { data, error } = await supabase
      .from("evroutine_sessions")
      .insert({
        region,
        source,
        source_detail: source_detail || null,
        thread_type: thread_type || null,
        referrer: referrer || null,
        utm: utm,
        started_at: new Date().toISOString(),
        ip_hash: ipHash,
        user_agent: userAgent,
        inputs: {}, // Will be populated on complete
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase error:", error);
      throw new Error(error.message);
    }

    if (!data?.id) {
      throw new Error("Failed to create session");
    }

    return NextResponse.json({
      success: true,
      session_id: data.id,
    });
  } catch (error) {
    console.error("Session start error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start session",
      },
      { status: 500 }
    );
  }
}
