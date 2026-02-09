/**
 * Visitor Tracking API
 * Logs unique visitors to offolab.com and tracks page views
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Helper to generate visitor fingerprint from browser data
function generateVisitorId(req: NextRequest, clientData: any): string {
  // Use client-provided fingerprint if available, otherwise generate from IP + User-Agent
  if (clientData.fingerprint) {
    return clientData.fingerprint;
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Simple hash (in production, use a proper fingerprinting library)
  return `${ip}-${userAgent}`.replace(/[^a-zA-Z0-9-]/g, "").substring(0, 64);
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { pagePath, referrer, fingerprint, sessionDuration } = body;

    // Get visitor metadata
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;
    const visitorId = generateVisitorId(req, { fingerprint });

    // Check if visitor exists
    const { data: existingVisitor, error: lookupError } = await supabase
      .from("visitors")
      .select("visit_count, referrer")
      .eq("visitor_id", visitorId)
      .single();

    if (lookupError && lookupError.code !== "PGRST116") {
      // PGRST116 = "not found" which is expected for new visitors
      console.error("Visitor lookup error:", lookupError.message, lookupError.code);
    }

    if (existingVisitor) {
      // Update existing visitor
      const { error: updateError } = await supabase
        .from("visitors")
        .update({
          last_visit: new Date().toISOString(),
          visit_count: (existingVisitor.visit_count || 0) + 1,
          referrer: referrer || existingVisitor.referrer,
          page_path: pagePath,
        })
        .eq("visitor_id", visitorId);
      if (updateError) console.error("Visitor update error:", updateError.message);
    } else {
      // Insert new visitor
      const { error: insertError } = await supabase.from("visitors").insert({
        visitor_id: visitorId,
        ip_address: ip,
        user_agent: userAgent,
        referrer: referrer || null,
        page_path: pagePath,
        first_visit: new Date().toISOString(),
        last_visit: new Date().toISOString(),
        visit_count: 1,
        session_count: 1,
      });
      if (insertError) console.error("Visitor insert error:", insertError.message);
    }

    // Log page view
    const { error: pvError } = await supabase.from("page_views").insert({
      visitor_id: visitorId,
      page_path: pagePath,
      referrer: referrer || null,
      timestamp: new Date().toISOString(),
      session_duration: sessionDuration || null,
    });
    if (pvError) console.error("Page view insert error:", pvError.message);

    return NextResponse.json({
      success: true,
      visitorId,
      message: "Visit tracked successfully",
    });
  } catch (error: any) {
    console.error("Visitor tracking error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for admin to fetch visitor stats
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "30d"; // 24h, 7d, 30d, all

    // Calculate cutoff date
    const now = new Date();
    let cutoff: string | null = null;
    if (timeframe === "24h") {
      cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    } else if (timeframe === "7d") {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (timeframe === "30d") {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Fetch visitors
    let visitorsQuery = supabase.from("visitors").select("*");
    if (cutoff) {
      visitorsQuery = visitorsQuery.gte("first_visit", cutoff);
    }
    const { data: visitors } = await visitorsQuery;
    const allVisitors = visitors || [];

    // Fetch page views
    let pageViewsQuery = supabase.from("page_views").select("*");
    if (cutoff) {
      pageViewsQuery = pageViewsQuery.gte("timestamp", cutoff);
    }
    const { data: pageViews } = await pageViewsQuery;
    const allPageViews = pageViews || [];

    // Aggregate: unique visitors
    const uniqueVisitorIds = new Set(allVisitors.map(v => v.visitor_id));
    const uniqueVisitorsCount = uniqueVisitorIds.size;

    // Aggregate: total visits
    const totalVisits = allVisitors.reduce((sum, v) => sum + (v.visit_count || 0), 0);

    // Aggregate: total page views
    const totalPageViewsCount = allPageViews.length;

    // Aggregate: top pages
    const pageCountMap = new Map<string, { views: number; visitors: Set<string> }>();
    for (const pv of allPageViews) {
      const path = pv.page_path || "unknown";
      if (!pageCountMap.has(path)) {
        pageCountMap.set(path, { views: 0, visitors: new Set() });
      }
      const entry = pageCountMap.get(path)!;
      entry.views++;
      if (pv.visitor_id) entry.visitors.add(pv.visitor_id);
    }
    const topPages = Array.from(pageCountMap.entries())
      .map(([page_path, { views, visitors: vis }]) => ({
        page_path,
        view_count: views,
        unique_visitors: vis.size,
      }))
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, 10);

    // Recent visitors (last 50, sorted by last_visit desc)
    const { data: recentVisitorsRaw } = await supabase
      .from("visitors")
      .select("visitor_id, referrer, first_visit, last_visit, visit_count, country, city")
      .order("last_visit", { ascending: false })
      .limit(50);

    // For each recent visitor, get their latest page path
    const recentVisitors = await Promise.all(
      (recentVisitorsRaw || []).map(async (v) => {
        const { data: latestPage } = await supabase
          .from("page_views")
          .select("page_path")
          .eq("visitor_id", v.visitor_id)
          .order("timestamp", { ascending: false })
          .limit(1)
          .single();
        return { ...v, page_path: latestPage?.page_path || null };
      })
    );

    // Visitors by day (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: last30Visitors } = await supabase
      .from("visitors")
      .select("visitor_id, first_visit")
      .gte("first_visit", thirtyDaysAgo);

    const dayMap = new Map<string, { visitors: Set<string>; total: number }>();
    for (const v of last30Visitors || []) {
      const date = v.first_visit?.split("T")[0] || "unknown";
      if (!dayMap.has(date)) {
        dayMap.set(date, { visitors: new Set(), total: 0 });
      }
      const entry = dayMap.get(date)!;
      entry.visitors.add(v.visitor_id);
      entry.total++;
    }
    const visitorsByDay = Array.from(dayMap.entries())
      .map(([date, { visitors: vis, total }]) => ({
        date,
        unique_visitors: vis.size,
        total_visits: total,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      success: true,
      timeframe,
      stats: {
        uniqueVisitors: uniqueVisitorsCount,
        totalVisits,
        totalPageViews: totalPageViewsCount,
        topPages,
        recentVisitors,
        visitorsByDay,
      },
    });
  } catch (error: any) {
    console.error("Visitor stats error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
