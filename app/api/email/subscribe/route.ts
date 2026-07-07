/**
 * POST /api/email/subscribe
 *
 * Lightweight email capture for anonymous visitors (homepage + blog).
 * Upserts a row in crm_email_preferences with weekly_digest = true.
 * Does NOT require authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  let email: string | undefined;
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Upsert into crm_email_preferences — enable weekly_digest, preserve existing prefs
  const { error } = await supabase
    .from("crm_email_preferences")
    .upsert(
      {
        email,
        all_marketing: true,
        weekly_digest: true,
      },
      { onConflict: "email", ignoreDuplicates: false }
    );

  if (error) {
    console.error("[subscribe] DB upsert error:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
