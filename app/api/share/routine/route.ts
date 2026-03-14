/**
 * Share Routine — Create Share Link
 *
 * POST /api/share/routine
 *
 * Creates (or returns existing) share link for a routine run.
 * Idempotent: same run_id → same share link.
 * Stores a public-safe snapshot at creation time.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { createRoutineSnapshot } from "@/lib/share-snapshot";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

const shareRateLimiter = new RateLimiter(60 * 60 * 1000, 10); // 10/hour per IP

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const ip = getClientIP(req);
  const rateCheck = shareRateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many share requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const { run_id, anon_session_id } = body;

    if (!run_id || typeof run_id !== "string") {
      return NextResponse.json(
        { success: false, error: "run_id required" },
        { status: 400 }
      );
    }

    if (!anon_session_id || typeof anon_session_id !== "string") {
      return NextResponse.json(
        { success: false, error: "anon_session_id required" },
        { status: 400 }
      );
    }

    // Check for existing active share (idempotent)
    const { data: existing } = await supabase
      .from("shared_routines")
      .select("share_slug")
      .eq("run_id", run_id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (existing?.share_slug) {
      return NextResponse.json({
        success: true,
        share_slug: existing.share_slug,
        share_url: `/r/routine/${existing.share_slug}`,
      });
    }

    // Fetch run and verify ownership
    const { data: run, error: runError } = await supabase
      .from("routine_runs")
      .select("id, profile_id, inputs_json, outputs_json, friction_score, fit_label")
      .eq("id", run_id)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      );
    }

    // Ownership check: anon_session_id must always match
    if (run.profile_id) {
      const { data: profile } = await supabase
        .from("routine_profiles")
        .select("anon_session_id")
        .eq("id", run.profile_id)
        .single();
      if (!profile || profile.anon_session_id !== anon_session_id) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 403 }
        );
      }
    }

    // Build public-safe snapshot
    const snapshot = createRoutineSnapshot(run);

    // Try up to 3 slugs in case of collision
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");

      const { error: insertError } = await supabase
        .from("shared_routines")
        .insert({
          share_slug: slug,
          run_id: run_id,
          snapshot_json: snapshot,
          creator_anon_id: anon_session_id || null,
        });

      if (!insertError) {
        supabase
          .from("user_events")
          .insert({
            event_name: "share_link_created",
            event_data: {
              share_slug: slug,
              run_id,
              fit_label: snapshot.fit_label,
              flow: "evfit",
            },
            page_path: "/api/share/routine",
            timestamp: new Date().toISOString(),
          })
          .then(() => {});

        return NextResponse.json({
          success: true,
          share_slug: slug,
          share_url: `/r/routine/${slug}`,
        });
      }

      if (insertError.code !== "23505") {
        console.error("[Share Routine] Insert error:", insertError);
        return NextResponse.json(
          { success: false, error: "Failed to create share link" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Failed to generate unique share link" },
      { status: 500 }
    );
  } catch (err) {
    console.error("[Share Routine] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
