/**
 * User Retention & Repeat User Analytics Endpoint
 *
 * GET /api/admin/user-retention?window=last_30_days
 *
 * Returns metrics on repeated users, active users, cohort retention,
 * and user engagement patterns.
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "your-secret-admin-key";

const BOT_UA_PATTERNS = /bot|crawler|spider|headless|scraper|wget|curl|python-requests/i;

// Human signal events — presence of any means real user interaction
const HUMAN_SIGNAL_EVENTS = new Set([
  "page_visible_10s",
  "first_interaction",
  "scroll_depth_25",
  "scroll_depth_50",
]);

// Time window helper
function getWindowBoundaries(window: string): { start: string; end: string } {
  const now = new Date();

  switch (window) {
    case "today": {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: today.toISOString(), end: now.toISOString() };
    }
    case "week":
      return {
        start: new Date(now.getTime() - 7 * 86400000).toISOString(),
        end: now.toISOString(),
      };
    case "last_30_days":
      return {
        start: new Date(now.getTime() - 30 * 86400000).toISOString(),
        end: now.toISOString(),
      };
    case "month": {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: firstOfMonth.toISOString(), end: now.toISOString() };
    }
    default:
      return {
        start: new Date(now.getTime() - 30 * 86400000).toISOString(),
        end: now.toISOString(),
      };
  }
}

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const window = searchParams.get("window") || "last_30_days";
  const { start, end } = getWindowBoundaries(window);

  try {
    // Run all queries in parallel
    const [
      visitorsData,
      allVisitorsUnfilteredData,
      pageViewsData,
      userEventsData,
      dauData,
      wauData,
      mauData,
    ] = await Promise.all([
      // 1. Window-scoped visitors (for repeat/segment metrics)
      supabase
        .from("visitors")
        .select("visitor_id, visit_count, session_count, first_visit, last_visit, user_agent")
        .gte("last_visit", start)
        .lte("last_visit", end),

      // 2. ALL known visitors (no time filter) — used to build the full human ID set
      //    so DAU/WAU/MAU filtering works correctly across all time windows
      supabase
        .from("visitors")
        .select("visitor_id, user_agent")
        .limit(10000),

      // 3. Get page views for window-scoped visit count calc
      supabase
        .from("page_views")
        .select("visitor_id, timestamp")
        .gte("timestamp", start)
        .lte("timestamp", end),

      // 4. Get user events (for human signal detection)
      supabase
        .from("user_events")
        .select("session_id, visitor_id, event_name, timestamp")
        .gte("timestamp", start)
        .lte("timestamp", end),

      // 5. Daily Active Users (last 24h)
      supabase
        .from("page_views")
        .select("visitor_id")
        .gte("timestamp", new Date(Date.now() - 86400000).toISOString()),

      // 6. Weekly Active Users (last 7d)
      supabase
        .from("page_views")
        .select("visitor_id")
        .gte("timestamp", new Date(Date.now() - 7 * 86400000).toISOString()),

      // 7. Monthly Active Users (last 30d)
      supabase
        .from("page_views")
        .select("visitor_id")
        .gte("timestamp", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);

    const allVisitors = visitorsData.data || [];
    const allKnownVisitors = allVisitorsUnfilteredData.data || [];
    const allPageViews = pageViewsData.data || [];
    const allEvents = userEventsData.data || [];

    // -----------------------------------------------------------------------
    // Build human visitor ID set from ALL known visitors (not window-scoped)
    // This ensures DAU/WAU/MAU are filtered correctly regardless of time window
    // -----------------------------------------------------------------------

    const humanVisitorIds = new Set<string>();

    // Add all visitors with a valid non-bot UA
    for (const v of allKnownVisitors) {
      if (!v.user_agent || v.user_agent.length <= 10) continue;
      if (BOT_UA_PATTERNS.test(v.user_agent)) continue;
      humanVisitorIds.add(v.visitor_id);
    }

    // Also add any visitor with human-signal events (in case their visitors row is missing)
    for (const ev of allEvents) {
      if (ev.visitor_id && HUMAN_SIGNAL_EVENTS.has(ev.event_name)) {
        humanVisitorIds.add(ev.visitor_id);
      }
    }

    // -----------------------------------------------------------------------
    // Filter window-scoped visitors to humans only
    // -----------------------------------------------------------------------

    const humanVisitors = allVisitors.filter(v => humanVisitorIds.has(v.visitor_id));

    // -----------------------------------------------------------------------
    // Window-scoped visit counts (from page_views, not all-time visit_count)
    // -----------------------------------------------------------------------

    const pvCountByVisitor = new Map<string, number>();
    for (const pv of allPageViews) {
      if (humanVisitorIds.has(pv.visitor_id)) {
        pvCountByVisitor.set(pv.visitor_id, (pvCountByVisitor.get(pv.visitor_id) || 0) + 1);
      }
    }

    // -----------------------------------------------------------------------
    // Calculate metrics
    // -----------------------------------------------------------------------

    const totalUniqueVisitors = humanVisitors.length;
    const totalSessions = humanVisitors.reduce((sum, v) => sum + (v.session_count || 0), 0);
    const totalEvents = allEvents.filter(e => humanVisitorIds.has(e.visitor_id)).length;

    // Repeat users: visited more than once in this window
    const repeatVisitors = humanVisitors.filter(v => (pvCountByVisitor.get(v.visitor_id) || 1) > 1);
    const repeatUsersTotal = repeatVisitors.length;
    const repeatUsersPercentage = totalUniqueVisitors > 0
      ? Math.round((repeatUsersTotal / totalUniqueVisitors) * 100)
      : 0;

    // Segment by window-scoped page view count
    const twoVisits = humanVisitors.filter(v => pvCountByVisitor.get(v.visitor_id) === 2).length;
    const threeToFive = humanVisitors.filter(v => {
      const c = pvCountByVisitor.get(v.visitor_id) || 1;
      return c >= 3 && c <= 5;
    }).length;
    const sixToTen = humanVisitors.filter(v => {
      const c = pvCountByVisitor.get(v.visitor_id) || 1;
      return c >= 6 && c <= 10;
    }).length;
    const elevenPlus = humanVisitors.filter(v => (pvCountByVisitor.get(v.visitor_id) || 1) > 10).length;

    // Top power users (by window-scoped page views)
    const topPowerUsers = humanVisitors
      .map(v => ({ ...v, window_pv_count: pvCountByVisitor.get(v.visitor_id) || 1 }))
      .sort((a, b) => b.window_pv_count - a.window_pv_count)
      .slice(0, 20)
      .map(v => {
        const firstVisit = new Date(v.first_visit);
        const lastVisit = new Date(v.last_visit);
        const daysActive = Math.ceil((lastVisit.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24));
        return {
          visitor_id: v.visitor_id,
          visit_count: v.window_pv_count,
          session_count: v.session_count,
          first_visit: v.first_visit,
          last_visit: v.last_visit,
          days_active: daysActive,
        };
      });

    // Active users — filtered through full human set (DAU ≤ WAU ≤ MAU always holds)
    const dauSet = new Set(
      (dauData.data || [])
        .filter(pv => humanVisitorIds.has(pv.visitor_id))
        .map(pv => pv.visitor_id)
    );
    const wauSet = new Set(
      (wauData.data || [])
        .filter(pv => humanVisitorIds.has(pv.visitor_id))
        .map(pv => pv.visitor_id)
    );
    const mauSet = new Set(
      (mauData.data || [])
        .filter(pv => humanVisitorIds.has(pv.visitor_id))
        .map(pv => pv.visitor_id)
    );

    const dau = dauSet.size;
    const wau = wauSet.size;
    const mau = mauSet.size;

    const dauWauRatio = wau > 0 ? dau / wau : 0;
    const dauMauRatio = mau > 0 ? dau / mau : 0;

    // User segmentation (window-scoped)
    const oneTimeUsers = humanVisitors.filter(v => (pvCountByVisitor.get(v.visitor_id) || 1) === 1).length;
    const occasionalUsers = humanVisitors.filter(v => {
      const c = pvCountByVisitor.get(v.visitor_id) || 1;
      return c >= 2 && c <= 5;
    }).length;
    const frequentUsers = humanVisitors.filter(v => {
      const c = pvCountByVisitor.get(v.visitor_id) || 1;
      return c >= 6 && c <= 10;
    }).length;
    const powerUsers = humanVisitors.filter(v => (pvCountByVisitor.get(v.visitor_id) || 1) > 10).length;

    // Session patterns
    const avgSessionsPerUser = totalUniqueVisitors > 0
      ? Math.round(totalSessions / totalUniqueVisitors * 10) / 10
      : 0;

    const sessionsWithEvents = new Set(
      allEvents.filter(e => humanVisitorIds.has(e.visitor_id)).map(e => e.session_id)
    );
    const avgEventsPerSession = sessionsWithEvents.size > 0
      ? Math.round(totalEvents / sessionsWithEvents.size * 10) / 10
      : 0;

    return NextResponse.json({
      window,
      start_date: start,
      end_date: end,
      bot_filtered: true,

      // Overview
      total_unique_visitors: totalUniqueVisitors,
      total_sessions: totalSessions,
      total_events: totalEvents,

      // Repeat users
      repeat_users: {
        total: repeatUsersTotal,
        percentage: repeatUsersPercentage,
        by_visit_count: {
          "2_visits": twoVisits,
          "3_5_visits": threeToFive,
          "6_10_visits": sixToTen,
          "11_plus_visits": elevenPlus,
        },
        top_power_users: topPowerUsers,
      },

      // Active users
      active_users: {
        daily_active_users: dau,
        weekly_active_users: wau,
        monthly_active_users: mau,
        dau_wau_ratio: Math.round(dauWauRatio * 100) / 100,
        dau_mau_ratio: Math.round(dauMauRatio * 100) / 100,
      },

      // User segments
      user_segments: {
        one_time_users: oneTimeUsers,
        occasional_users: occasionalUsers,
        frequent_users: frequentUsers,
        power_users: powerUsers,
      },

      // Session patterns
      session_patterns: {
        avg_sessions_per_user: avgSessionsPerUser,
        avg_events_per_session: avgEventsPerSession,
      },
    });

  } catch (error) {
    console.error("[User Retention API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
