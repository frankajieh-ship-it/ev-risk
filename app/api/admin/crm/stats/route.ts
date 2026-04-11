/**
 * Admin CRM Stats
 *
 * GET /api/admin/crm/stats
 *
 * Returns aggregate CRM performance metrics for ops monitoring.
 * Protected by ADMIN_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Run all queries in parallel
  const [
    sendsLast7d,
    bySequence,
    suppressed,
    winBackActive,
    conversionPending,
  ] = await Promise.all([
    // Total sends last 7 days
    supabase
      .from("crm_email_sends")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("created_at", sevenDaysAgo),

    // Sends per sequence (last 7 days)
    supabase
      .from("crm_email_sends")
      .select("sequence_type")
      .eq("status", "sent")
      .gte("created_at", sevenDaysAgo),

    // Suppressed addresses (hard bounce or opted out)
    supabase
      .from("crm_email_preferences")
      .select("id", { count: "exact", head: true })
      .or("all_marketing.eq.false,bounced.eq.true"),

    // Win-back active (enrolled, not exited)
    supabase
      .from("crm_win_back_state")
      .select("id", { count: "exact", head: true })
      .is("exited_at", null),

    // Open conversion window: paywall_dismissed events in last 48h not yet followed up
    supabase
      .from("user_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "paywall_dismissed")
      .gte("timestamp", fortyEightHoursAgo),
  ]);

  // Aggregate by sequence type
  const bySeqMap: Record<string, number> = {
    activation: 0,
    win_back: 0,
    conversion: 0,
    weekly_digest: 0,
    deal_watch: 0,
    recall: 0,
  };
  for (const row of bySequence.data || []) {
    const seq = row.sequence_type as string;
    bySeqMap[seq] = (bySeqMap[seq] ?? 0) + 1;
  }

  return NextResponse.json({
    sends_last_7_days: sendsLast7d.count ?? 0,
    by_sequence: bySeqMap,
    suppressed_emails: suppressed.count ?? 0,
    win_back_active: winBackActive.count ?? 0,
    open_conversion_window_48h: conversionPending.count ?? 0,
    generated_at: new Date().toISOString(),
  });
}
