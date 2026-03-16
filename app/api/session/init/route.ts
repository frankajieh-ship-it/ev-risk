/**
 * POST /api/session/init
 *
 * Called once per browser session from useEventTracking to persist
 * UTM attribution context server-side (sessions table).
 *
 * ON CONFLICT DO NOTHING — first write wins. Subsequent page loads for
 * the same session_id are silently ignored.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true }); // Degrade silently
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const session_id = typeof body.session_id === "string" ? body.session_id : null;
  const anon_id = typeof body.anon_id === "string" ? body.anon_id : null;

  if (!session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    session_id,
    anon_id,
    utm_source:   body.utm_source   ?? null,
    utm_medium:   body.utm_medium   ?? null,
    utm_campaign: body.utm_campaign ?? null,
    utm_term:     body.utm_term     ?? null,
    utm_content:  body.utm_content  ?? null,
    referrer:     body.referrer     ?? null,
    landing_page: body.landing_page ?? null,
  };

  // ON CONFLICT DO NOTHING — idempotent, first write wins
  const { error } = await supabase
    .from("sessions")
    .insert(row)
    .throwOnError()
    .then(
      (r) => r,
      (e) => {
        // Unique constraint (duplicate session_id) is expected — treat as success
        if (e?.code === "23505") return { error: null };
        return { error: e };
      }
    );

  if (error) {
    // Non-critical — degrade silently
    console.warn("[session/init] Insert failed:", error?.code, error?.message);
  }

  return NextResponse.json({ ok: true });
}
