/**
 * Co-Shopper Invite — Create Invite
 *
 * POST /api/invite/create
 *
 * Creates a co-shopper invite linked to a shared routine.
 * Returns { invite_token, invite_url }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { share_slug, inviter_anon_id, invitee_email } = body;

    if (!share_slug || typeof share_slug !== "string") {
      return NextResponse.json(
        { success: false, error: "share_slug required" },
        { status: 400 }
      );
    }

    // Verify share exists and is active
    const { data: share, error: shareError } = await supabase
      .from("shared_routines")
      .select("share_slug")
      .eq("share_slug", share_slug)
      .eq("is_active", true)
      .single();

    if (shareError || !share) {
      return NextResponse.json(
        { success: false, error: "Share link not found" },
        { status: 404 }
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Try up to 3 tokens in case of collision
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

      const { error: insertError } = await supabase
        .from("invites")
        .insert({
          token,
          inviter_anon_id: inviter_anon_id || null,
          share_slug,
          invitee_email: invitee_email || null,
          status: "sent",
          expires_at: expiresAt.toISOString(),
        });

      if (!insertError) {
        supabase
          .from("user_events")
          .insert({
            event_name: "invite_created",
            event_data: {
              invite_token: token,
              share_slug,
              has_email: !!invitee_email,
            },
            page_path: "/api/invite/create",
            timestamp: new Date().toISOString(),
          })
          .then(() => {});

        return NextResponse.json({
          success: true,
          invite_token: token,
          invite_url: `/i/${token}`,
        });
      }

      if (insertError.code !== "23505") {
        console.error("[Invite Create] Insert error:", insertError);
        return NextResponse.json(
          { success: false, error: "Failed to create invite" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Failed to generate unique invite token" },
      { status: 500 }
    );
  } catch (err) {
    console.error("[Invite Create] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
