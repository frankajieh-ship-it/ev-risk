/**
 * K-Factor Metrics API
 *
 * GET /api/admin/k-metrics?period=last_7_days|last_30_days
 *
 * Returns viral loop metrics:
 * - Active users (unique anon_ids with fit completion)
 * - Share links created
 * - Invites created / opened / converted
 * - K_buyer = (invites_created / active_users) × conversion_rate
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

function getWindowStart(period: string): string {
  const now = new Date();
  const days = period === "last_30_days" ? 30 : 7;
  now.setDate(now.getDate() - days);
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${ADMIN_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") === "last_30_days" ? "last_30_days" : "last_7_days";
  const windowStart = getWindowStart(period);

  try {
    // Active users: unique anon_session_ids in evfit_completed_server
    const { data: completedEvents } = await supabase
      .from("user_events")
      .select("event_data")
      .eq("event_name", "evfit_completed_server")
      .gte("timestamp", windowStart);

    const activeAnonIds = new Set<string>();
    const completedWithInvite = new Set<string>(); // anon_ids who had invite_token

    for (const ev of completedEvents || []) {
      const d = ev.event_data as Record<string, unknown>;
      if (d?.anon_session_id) activeAnonIds.add(d.anon_session_id as string);
      if (d?.invite_token) completedWithInvite.add(d.anon_session_id as string);
    }

    const activeUsers = activeAnonIds.size;

    // Share links created in window
    const { count: shareLinksCreated } = await supabase
      .from("shared_routines")
      .select("*", { count: "exact", head: true })
      .gte("created_at", windowStart);

    // Invite stats
    const { data: invites } = await supabase
      .from("invites")
      .select("status, created_at")
      .gte("created_at", windowStart);

    const invitesCreated = invites?.length || 0;
    const invitesOpened = invites?.filter((i) => i.status === "opened" || i.status === "converted").length || 0;
    const invitesConverted = invites?.filter((i) => i.status === "converted").length || 0;

    // Rates
    const openRate = invitesCreated > 0 ? invitesOpened / invitesCreated : 0;
    const conversionRate = invitesOpened > 0 ? invitesConverted / invitesOpened : 0;
    const sharesPerUser = activeUsers > 0 ? (shareLinksCreated || 0) / activeUsers : 0;
    const invitesPerUser = activeUsers > 0 ? invitesCreated / activeUsers : 0;

    // K_buyer = invites created per active user × conversion rate (invite→fit)
    const kBuyer = invitesPerUser * conversionRate;

    // Daily breakdown of share_link_created events
    const { data: shareEvents } = await supabase
      .from("user_events")
      .select("timestamp")
      .eq("event_name", "share_link_created")
      .gte("timestamp", windowStart)
      .order("timestamp", { ascending: true });

    const dailyShares: Record<string, number> = {};
    for (const ev of shareEvents || []) {
      const day = (ev.timestamp as string).slice(0, 10);
      dailyShares[day] = (dailyShares[day] || 0) + 1;
    }

    // Daily breakdown of invite_created events
    const { data: inviteEvents } = await supabase
      .from("user_events")
      .select("timestamp")
      .eq("event_name", "invite_created")
      .gte("timestamp", windowStart)
      .order("timestamp", { ascending: true });

    const dailyInvites: Record<string, number> = {};
    for (const ev of inviteEvents || []) {
      const day = (ev.timestamp as string).slice(0, 10);
      dailyInvites[day] = (dailyInvites[day] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      period,
      window_start: windowStart,
      summary: {
        active_users: activeUsers,
        share_links_created: shareLinksCreated || 0,
        shares_per_user: Math.round(sharesPerUser * 100) / 100,
        invites_created: invitesCreated,
        invites_opened: invitesOpened,
        invites_converted: invitesConverted,
        invites_per_user: Math.round(invitesPerUser * 100) / 100,
        open_rate_pct: Math.round(openRate * 1000) / 10,
        conversion_rate_pct: Math.round(conversionRate * 1000) / 10,
        k_buyer: Math.round(kBuyer * 1000) / 1000,
      },
      daily: {
        shares: dailyShares,
        invites: dailyInvites,
      },
    });
  } catch (err) {
    console.error("[K-Metrics] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
