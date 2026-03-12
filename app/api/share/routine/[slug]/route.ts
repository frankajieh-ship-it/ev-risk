/**
 * Share Routine — Public Share Data
 *
 * GET /api/share/routine/:slug
 *
 * Returns the public share snapshot for a given slug.
 * Increments view count. No authentication required.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const { slug } = await params;

  if (!slug || slug.length < 4) {
    return NextResponse.json(
      { success: false, error: "Invalid share link" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("shared_routines")
      .select("id, share_slug, snapshot_json, view_count, created_at")
      .eq("share_slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "Share link not found" },
        { status: 404 }
      );
    }

    // Increment view count (fire-and-forget)
    supabase
      .from("shared_routines")
      .update({
        view_count: (data.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .then(() => {});

    supabase
      .from("user_events")
      .insert({
        event_name: "share_page_viewed",
        event_data: {
          share_slug: slug,
          flow: "evfit",
        },
        page_path: `/r/routine/${slug}`,
        timestamp: new Date().toISOString(),
      })
      .then(() => {});

    return NextResponse.json({
      success: true,
      snapshot: data.snapshot_json,
      created_at: data.created_at,
      view_count: (data.view_count || 0) + 1,
    });
  } catch (err) {
    console.error("[Share Routine View] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
