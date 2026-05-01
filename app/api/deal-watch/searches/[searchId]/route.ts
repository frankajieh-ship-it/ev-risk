/**
 * Deal Watch Single Search API
 *
 * PUT    /api/deal-watch/searches/[searchId]  — update search settings
 * DELETE /api/deal-watch/searches/[searchId]  — delete search + results
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { trackServerEvent } from "@/lib/track-server-event";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { searchId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const allowed = ["label", "make", "model", "year_min", "year_max", "price_max", "verdict_filter", "sources", "email_alerts", "alert_email"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("deal_watch_searches")
    .update(updates)
    .eq("id", searchId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: error?.message ?? "Not found" }, { status: 404 });
  }

  // Emit specific event when email_alerts toggle changes
  if ("email_alerts" in body) {
    trackServerEvent({
      event_name: "deal_watch_alerts_toggled",
      source: "listing",
      user_id: user.id,
      page_path: "/api/deal-watch/searches/[searchId]",
      entity_type: "deal_watch_search_id",
      entity_id: searchId,
      payload: { search_id: searchId, email_alerts: body.email_alerts },
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, search: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { searchId } = await params;

  const { error } = await supabase
    .from("deal_watch_searches")
    .delete()
    .eq("id", searchId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  trackServerEvent({
    event_name: "deal_watch_search_deleted",
    source: "listing",
    user_id: user.id,
    page_path: "/api/deal-watch/searches/[searchId]",
    entity_type: "deal_watch_search_id",
    entity_id: searchId,
    payload: { search_id: searchId },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
