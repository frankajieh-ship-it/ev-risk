/**
 * Email Preferences
 *
 * GET  /api/email/preferences  — get preferences for authenticated user
 * PATCH /api/email/preferences — update one or more sequence opt-ins
 *
 * Auth: JWT (authenticated user's own preferences) or ADMIN_API_KEY (admin lookup by ?email=)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

const PATCHABLE_FIELDS = new Set([
  "activation", "win_back", "conversion", "weekly_digest", "deal_watch", "recall", "all_marketing",
]);

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Admin lookup by email param
  const adminKey = process.env.ADMIN_API_KEY;
  const authHeader = request.headers.get("authorization");
  const emailParam = new URL(request.url).searchParams.get("email");

  if (adminKey && authHeader === `Bearer ${adminKey}` && emailParam) {
    const { data } = await supabase
      .from("crm_email_preferences")
      .select("*")
      .eq("email", emailParam)
      .maybeSingle();
    return NextResponse.json({ preferences: data || null });
  }

  // Authenticated user's own preferences
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { email } = auth;
  const { data } = await supabase
    .from("crm_email_preferences")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  return NextResponse.json({ preferences: data || null });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { email, id: userId } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Only allow patchable boolean fields
  const updates: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body)) {
    if (PATCHABLE_FIELDS.has(key) && typeof val === "boolean") {
      updates[key] = val;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error } = await supabase
    .from("crm_email_preferences")
    .upsert(
      { email, user_id: userId, ...updates, updated_at: new Date().toISOString() },
      { onConflict: "email" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data });
}
