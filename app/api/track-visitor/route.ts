/**
 * Visitor Tracking API
 * Logs unique visitors to offolab.com and tracks page views
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

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
  try {
    const body = await req.json();
    const { pagePath, referrer, fingerprint, sessionDuration } = body;

    // Get visitor metadata
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;
    const visitorId = generateVisitorId(req, { fingerprint });

    // Check if visitor exists
    const existingVisitor = await sql`
      SELECT * FROM visitors WHERE visitor_id = ${visitorId}
    `;

    if (existingVisitor.rows.length > 0) {
      // Update existing visitor
      await sql`
        UPDATE visitors
        SET
          last_visit = NOW(),
          visit_count = visit_count + 1,
          referrer = COALESCE(${referrer}, referrer),
          page_path = ${pagePath}
        WHERE visitor_id = ${visitorId}
      `;
    } else {
      // Insert new visitor
      await sql`
        INSERT INTO visitors (
          visitor_id,
          ip_address,
          user_agent,
          referrer,
          page_path,
          first_visit,
          last_visit,
          visit_count,
          session_count
        )
        VALUES (
          ${visitorId},
          ${ip},
          ${userAgent},
          ${referrer},
          ${pagePath},
          NOW(),
          NOW(),
          1,
          1
        )
      `;
    }

    // Log page view
    await sql`
      INSERT INTO page_views (
        visitor_id,
        page_path,
        referrer,
        timestamp,
        session_duration
      )
      VALUES (
        ${visitorId},
        ${pagePath},
        ${referrer},
        NOW(),
        ${sessionDuration}
      )
    `;

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
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "30d"; // 24h, 7d, 30d, all

    // Build time filter queries based on timeframe
    let uniqueVisitors, totalVisits, totalPageViews, topPages;

    if (timeframe === "24h") {
      uniqueVisitors = await sql`
        SELECT COUNT(DISTINCT visitor_id) as count
        FROM visitors
        WHERE first_visit > NOW() - INTERVAL '24 hours'
      `;
      totalVisits = await sql`
        SELECT COALESCE(SUM(visit_count), 0) as count
        FROM visitors
        WHERE first_visit > NOW() - INTERVAL '24 hours'
      `;
      totalPageViews = await sql`
        SELECT COUNT(*) as count
        FROM page_views
        WHERE timestamp > NOW() - INTERVAL '24 hours'
      `;
      topPages = await sql`
        SELECT
          page_path,
          COUNT(*) as view_count,
          COUNT(DISTINCT visitor_id) as unique_visitors
        FROM page_views
        WHERE timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY page_path
        ORDER BY view_count DESC
        LIMIT 10
      `;
    } else if (timeframe === "7d") {
      uniqueVisitors = await sql`
        SELECT COUNT(DISTINCT visitor_id) as count
        FROM visitors
        WHERE first_visit > NOW() - INTERVAL '7 days'
      `;
      totalVisits = await sql`
        SELECT COALESCE(SUM(visit_count), 0) as count
        FROM visitors
        WHERE first_visit > NOW() - INTERVAL '7 days'
      `;
      totalPageViews = await sql`
        SELECT COUNT(*) as count
        FROM page_views
        WHERE timestamp > NOW() - INTERVAL '7 days'
      `;
      topPages = await sql`
        SELECT
          page_path,
          COUNT(*) as view_count,
          COUNT(DISTINCT visitor_id) as unique_visitors
        FROM page_views
        WHERE timestamp > NOW() - INTERVAL '7 days'
        GROUP BY page_path
        ORDER BY view_count DESC
        LIMIT 10
      `;
    } else if (timeframe === "30d") {
      uniqueVisitors = await sql`
        SELECT COUNT(DISTINCT visitor_id) as count
        FROM visitors
        WHERE first_visit > NOW() - INTERVAL '30 days'
      `;
      totalVisits = await sql`
        SELECT COALESCE(SUM(visit_count), 0) as count
        FROM visitors
        WHERE first_visit > NOW() - INTERVAL '30 days'
      `;
      totalPageViews = await sql`
        SELECT COUNT(*) as count
        FROM page_views
        WHERE timestamp > NOW() - INTERVAL '30 days'
      `;
      topPages = await sql`
        SELECT
          page_path,
          COUNT(*) as view_count,
          COUNT(DISTINCT visitor_id) as unique_visitors
        FROM page_views
        WHERE timestamp > NOW() - INTERVAL '30 days'
        GROUP BY page_path
        ORDER BY view_count DESC
        LIMIT 10
      `;
    } else {
      // "all" - no time filter
      uniqueVisitors = await sql`
        SELECT COUNT(DISTINCT visitor_id) as count
        FROM visitors
      `;
      totalVisits = await sql`
        SELECT COALESCE(SUM(visit_count), 0) as count
        FROM visitors
      `;
      totalPageViews = await sql`
        SELECT COUNT(*) as count
        FROM page_views
      `;
      topPages = await sql`
        SELECT
          page_path,
          COUNT(*) as view_count,
          COUNT(DISTINCT visitor_id) as unique_visitors
        FROM page_views
        GROUP BY page_path
        ORDER BY view_count DESC
        LIMIT 10
      `;
    }

    const recentVisitors = await sql`
      SELECT
        v.visitor_id,
        v.referrer,
        v.first_visit,
        v.last_visit,
        v.visit_count,
        v.country,
        v.city,
        (SELECT page_path FROM page_views WHERE visitor_id = v.visitor_id ORDER BY timestamp DESC LIMIT 1) as page_path
      FROM visitors v
      ORDER BY v.last_visit DESC
      LIMIT 50
    `;

    const visitorsByDay = await sql`
      SELECT
        DATE(first_visit) as date,
        COUNT(DISTINCT visitor_id) as unique_visitors,
        COUNT(*) as total_visits
      FROM visitors
      WHERE first_visit > NOW() - INTERVAL '30 days'
      GROUP BY DATE(first_visit)
      ORDER BY date DESC
    `;

    return NextResponse.json({
      success: true,
      timeframe,
      stats: {
        uniqueVisitors: uniqueVisitors.rows[0]?.count || 0,
        totalVisits: parseInt(totalVisits.rows[0]?.count || '0'),
        totalPageViews: totalPageViews.rows[0]?.count || 0,
        topPages: topPages.rows,
        recentVisitors: recentVisitors.rows,
        visitorsByDay: visitorsByDay.rows,
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
