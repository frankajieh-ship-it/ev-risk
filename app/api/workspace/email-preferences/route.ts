/**
 * GET  /api/workspace/email-preferences — returns user's email preference toggles
 * PATCH /api/workspace/email-preferences — updates toggles
 *
 * Exposed preferences: deal_watch, weekly_digest, recall
 * Internal (not exposed): activation, win_back, conversion
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

interface EmailPrefs {
  deal_watch: boolean;
  weekly_digest: boolean;
  recall: boolean;
}

const DEFAULTS: EmailPrefs = { deal_watch: true, weekly_digest: true, recall: true };

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error } = await supabase
    .from("crm_email_preferences")
    .select("deal_watch, weekly_digest, recall")
    .eq("user_id", auth.id)
    .maybeSingle();

  if (error) {
    console.error("[email-preferences] GET failed:", error.message);
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    preferences: data ?? DEFAULTS,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: Partial<EmailPrefs>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Partial<EmailPrefs> = {};
  if (typeof body.deal_watch === "boolean") patch.deal_watch = body.deal_watch;
  if (typeof body.weekly_digest === "boolean") patch.weekly_digest = body.weekly_digest;
  if (typeof body.recall === "boolean") patch.recall = body.recall;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crm_email_preferences")
    .upsert(
      { user_id: auth.id, email: auth.email ?? "", ...patch },
      { onConflict: "user_id", ignoreDuplicates: false }
    )
    .select("deal_watch, weekly_digest, recall")
    .single();

  if (error) {
    console.error("[email-preferences] PATCH failed:", error.message);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }

  return NextResponse.json({ success: true, preferences: data });
}
