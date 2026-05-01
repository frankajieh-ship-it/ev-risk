/**
 * Deal Watch Searches API
 *
 * GET  /api/deal-watch/searches  — list user's saved searches
 * POST /api/deal-watch/searches  — create a new saved search
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { trackServerEvent } from "@/lib/track-server-event";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("deal_watch_searches")
    .select("*, deal_watch_results(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, searches: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { label, make, model, year_min, year_max, price_max, verdict_filter, sources, email_alerts, alert_email } = body;

  if (!label || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ success: false, error: "label is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("deal_watch_searches")
    .insert({
      user_id: user.id,
      label: (label as string).trim(),
      make: make || null,
      model: model || null,
      year_min: year_min || null,
      year_max: year_max || null,
      price_max: price_max || null,
      verdict_filter: verdict_filter || null,
      sources: sources || ["listing"],
      email_alerts: email_alerts !== false,
      alert_email: alert_email || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  trackServerEvent({
    event_name: "deal_watch_search_created",
    source: "listing",
    user_id: user.id,
    page_path: "/api/deal-watch/searches",
    entity_type: "deal_watch_search_id",
    entity_id: data.id,
    payload: {
      make: make || null,
      model: model || null,
      year_min: year_min || null,
      year_max: year_max || null,
      price_max: price_max || null,
      email_alerts: email_alerts !== false,
      sources: sources || ["listing"],
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, search: data }, { status: 201 });
}
