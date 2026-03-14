/**
 * Share Receipt — Create Share Link
 *
 * POST /api/share/receipt
 *
 * Creates (or returns existing) share link for a receipt.
 * Idempotent: same receipt_id → same share link.
 * Stores a safe snapshot of the receipt at creation time.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { createShareSnapshot } from "@/lib/share-snapshot";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

const shareRateLimiter = new RateLimiter(60 * 60 * 1000, 10); // 10/hour per IP

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  // Rate limit
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
    const { receipt_id, receipt_token } = body;

    if (!receipt_id || typeof receipt_id !== "string") {
      return NextResponse.json(
        { success: false, error: "receipt_id required" },
        { status: 400 }
      );
    }

    if (!receipt_token || typeof receipt_token !== "string") {
      return NextResponse.json(
        { success: false, error: "receipt_token required" },
        { status: 400 }
      );
    }

    // Check for existing active share (idempotent)
    const { data: existing } = await supabase
      .from("shared_receipts")
      .select("share_slug")
      .eq("receipt_id", receipt_id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (existing?.share_slug) {
      return NextResponse.json({
        success: true,
        share_slug: existing.share_slug,
        share_url: `/r/${existing.share_slug}`,
      });
    }

    // Fetch receipt and verify ownership
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("id, session_id, output_json")
      .eq("id", receipt_id)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    if (receipt.session_id !== receipt_token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!receipt.output_json) {
      return NextResponse.json(
        { success: false, error: "Receipt has no output data" },
        { status: 400 }
      );
    }

    // Generate slug and snapshot
    const snapshot = createShareSnapshot(receipt.output_json);

    // Try up to 3 slugs in case of collision
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");

      const { error: insertError } = await supabase
        .from("shared_receipts")
        .insert({
          share_slug: slug,
          receipt_id: receipt_id,
          snapshot_summary_json: snapshot,
          creator_receipt_token: receipt_token,
        });

      if (!insertError) {
        // Track event (fire-and-forget)
        supabase
          .from("user_events")
          .insert({
            event_name: "share_link_created",
            event_data: {
              share_slug: slug,
              receipt_id: receipt_id,
              verdict: snapshot.verdict,
            },
            timestamp: new Date().toISOString(),
          })
          .then(() => {});

        return NextResponse.json({
          success: true,
          share_slug: slug,
          share_url: `/r/${slug}`,
        });
      }

      // If unique constraint violation, retry with new slug
      if (insertError.code !== "23505") {
        console.error("[Share] Insert error:", insertError);
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
    console.error("[Share] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
