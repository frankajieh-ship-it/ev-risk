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

// Time window helper
function getWindowBoundaries(window: string): { start: string; end: string } {
  const now = new Date();

  switch (window) {
    case "today":
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return {
        start: today.toISOString(),
        end: now.toISOString(),
      };
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
    case "month":
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: firstOfMonth.toISOString(),
        end: now.toISOString(),
      };
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
      pageViewsData,
      userEventsData,
      dauData,
      wauData,
      mauData,
    ] = await Promise.all([
      // 1. Get all visitors in window
      supabase
        .from("visitors")
        .select("visitor_id, visit_count, session_count, first_visit, last_visit")
        .gte("last_visit", start)
        .lte("last_visit", end),

      // 2. Get page views for active user calc
      supabase
        .from("page_views")
        .select("visitor_id, timestamp")
        .gte("timestamp", start)
        .lte("timestamp", end),

      // 3. Get user events
      supabase
        .from("user_events")
        .select("session_id, visitor_id, event_name, timestamp")
        .gte("timestamp", start)
        .lte("timestamp", end),

      // 4. Daily Active Users
      supabase
        .from("page_views")
        .select("visitor_id")
        .gte("timestamp", new Date(Date.now() - 86400000).toISOString()),

      // 5. Weekly Active Users
      supabase
        .from("page_views")
        .select("visitor_id")
        .gte("timestamp", new Date(Date.now() - 7 * 86400000).toISOString()),

      // 6. Monthly Active Users
      supabase
        .from("page_views")
        .select("visitor_id")
        .gte("timestamp", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);

    const allVisitors = visitorsData.data || [];
    const allPageViews = pageViewsData.data || [];
    const allEvents = userEventsData.data || [];

    // Calculate metrics
    const totalUniqueVisitors = allVisitors.length;
    const totalSessions = allVisitors.reduce((sum, v) => sum + (v.session_count || 0), 0);
    const totalEvents = allEvents.length;

    // Repeat users (visit_count > 1)
    const repeatVisitors = allVisitors.filter(v => v.visit_count > 1);
    const repeatUsersTotal = repeatVisitors.length;
    const repeatUsersPercentage = totalUniqueVisitors > 0
      ? Math.round((repeatUsersTotal / totalUniqueVisitors) * 100)
      : 0;

    // Segment by visit count
    const twoVisits = repeatVisitors.filter(v => v.visit_count === 2).length;
    const threeToFive = repeatVisitors.filter(v => v.visit_count >= 3 && v.visit_count <= 5).length;
    const sixToTen = repeatVisitors.filter(v => v.visit_count >= 6 && v.visit_count <= 10).length;
    const elevenPlus = repeatVisitors.filter(v => v.visit_count > 10).length;

    // Top power users
    const topPowerUsers = repeatVisitors
      .sort((a, b) => b.visit_count - a.visit_count)
      .slice(0, 20)
      .map(v => {
        const firstVisit = new Date(v.first_visit);
        const lastVisit = new Date(v.last_visit);
        const daysActive = Math.ceil((lastVisit.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24));

        return {
          visitor_id: v.visitor_id,
          visit_count: v.visit_count,
          session_count: v.session_count,
          first_visit: v.first_visit,
          last_visit: v.last_visit,
          days_active: daysActive,
        };
      });

    // Active users
    const dauSet = new Set((dauData.data || []).map(pv => pv.visitor_id));
    const wauSet = new Set((wauData.data || []).map(pv => pv.visitor_id));
    const mauSet = new Set((mauData.data || []).map(pv => pv.visitor_id));

    const dau = dauSet.size;
    const wau = wauSet.size;
    const mau = mauSet.size;

    const dauWauRatio = wau > 0 ? dau / wau : 0;
    const dauMauRatio = mau > 0 ? dau / mau : 0;

    // User segmentation
    const oneTimeUsers = allVisitors.filter(v => v.visit_count === 1).length;
    const occasionalUsers = allVisitors.filter(v => v.visit_count >= 2 && v.visit_count <= 5).length;
    const frequentUsers = allVisitors.filter(v => v.visit_count >= 6 && v.visit_count <= 10).length;
    const powerUsers = allVisitors.filter(v => v.visit_count > 10).length;

    // Session patterns
    const avgSessionsPerUser = totalUniqueVisitors > 0
      ? Math.round(totalSessions / totalUniqueVisitors * 10) / 10
      : 0;

    const sessionsWithEvents = new Set(allEvents.map(e => e.session_id));
    const avgEventsPerSession = sessionsWithEvents.size > 0
      ? Math.round(totalEvents / sessionsWithEvents.size * 10) / 10
      : 0;

    // Return response
    return NextResponse.json({
      window,
      start_date: start,
      end_date: end,

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
