/**
 * Event Tracking API
 * Logs user interactions and conversion funnel events
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventName,
      eventData,
      visitorId,
      sessionId,
      pagePath,
      timestamp,
    } = body;

    // Get visitor metadata
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ||
               req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    // Log event
    const eventTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    await sql`
      INSERT INTO user_events (
        event_name,
        event_data,
        visitor_id,
        session_id,
        page_path,
        ip_address,
        user_agent,
        timestamp
      )
      VALUES (
        ${eventName},
        ${JSON.stringify(eventData)},
        ${visitorId},
        ${sessionId || null},
        ${pagePath},
        ${ip},
        ${userAgent},
        ${eventTimestamp}
      )
    `;

    return NextResponse.json({
      success: true,
      message: "Event tracked successfully",
    });
  } catch (error: any) {
    console.error("Event tracking error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for analytics
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "30d";
    const eventName = searchParams.get("event");

    // Helper function to build queries based on timeframe
    const buildQuery = (baseQuery: string, includeEventFilter = false) => {
      const eventFilter = eventName ? `AND event_name = '${eventName}'` : '';

      if (timeframe === "24h") {
        return sql.unsafe(`${baseQuery} WHERE timestamp > NOW() - INTERVAL '24 hours' ${includeEventFilter ? eventFilter : ''}`);
      } else if (timeframe === "7d") {
        return sql.unsafe(`${baseQuery} WHERE timestamp > NOW() - INTERVAL '7 days' ${includeEventFilter ? eventFilter : ''}`);
      } else if (timeframe === "30d") {
        return sql.unsafe(`${baseQuery} WHERE timestamp > NOW() - INTERVAL '30 days' ${includeEventFilter ? eventFilter : ''}`);
      } else {
        return sql.unsafe(`${baseQuery} ${includeEventFilter && eventFilter ? `WHERE ${eventFilter.substring(4)}` : ''}`);
      }
    };

    // Build queries based on timeframe (without sql.unsafe)
    let totalEvents, eventsByName, formSubmissions, urlAutofill, blogClicks, funnelData;

    if (timeframe === "24h") {
      totalEvents = eventName
        ? await sql`SELECT COUNT(*) as count FROM user_events WHERE timestamp > NOW() - INTERVAL '24 hours' AND event_name = ${eventName}`
        : await sql`SELECT COUNT(*) as count FROM user_events WHERE timestamp > NOW() - INTERVAL '24 hours'`;

      eventsByName = await sql`
        SELECT event_name, COUNT(*) as count, COUNT(DISTINCT visitor_id) as unique_users
        FROM user_events
        WHERE timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY event_name
        ORDER BY count DESC
      `;

      formSubmissions = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN (event_data->>'success')::boolean = true THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN (event_data->>'success')::boolean = false THEN 1 ELSE 0 END) as failed
        FROM user_events
        WHERE event_name = 'form_submit' AND timestamp > NOW() - INTERVAL '24 hours'
      `;

      urlAutofill = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN (event_data->>'success')::boolean = true THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN (event_data->>'success')::boolean = false THEN 1 ELSE 0 END) as failed,
          COUNT(DISTINCT event_data->>'url') as unique_urls
        FROM user_events
        WHERE event_name = 'url_autofill_attempt' AND timestamp > NOW() - INTERVAL '24 hours'
      `;

      blogClicks = await sql`
        SELECT COUNT(*) as total_clicks, COUNT(DISTINCT visitor_id) as unique_users, event_data->>'source' as source
        FROM user_events
        WHERE event_name = 'blog_link_click' AND timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY event_data->>'source'
      `;

      funnelData = await sql`
        SELECT visitor_id,
          MAX(CASE WHEN event_name = 'page_view' AND page_path = '/' THEN 1 ELSE 0 END) as viewed_homepage,
          MAX(CASE WHEN event_name = 'url_autofill_attempt' THEN 1 ELSE 0 END) as tried_autofill,
          MAX(CASE WHEN event_name = 'form_submit' THEN 1 ELSE 0 END) as submitted_form,
          MAX(CASE WHEN event_name = 'report_generated' THEN 1 ELSE 0 END) as generated_report,
          MAX(CASE WHEN event_name = 'blog_link_click' THEN 1 ELSE 0 END) as clicked_blog
        FROM user_events
        WHERE timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY visitor_id
      `;
    } else if (timeframe === "7d") {
      totalEvents = eventName
        ? await sql`SELECT COUNT(*) as count FROM user_events WHERE timestamp > NOW() - INTERVAL '7 days' AND event_name = ${eventName}`
        : await sql`SELECT COUNT(*) as count FROM user_events WHERE timestamp > NOW() - INTERVAL '7 days'`;

      eventsByName = await sql`
        SELECT event_name, COUNT(*) as count, COUNT(DISTINCT visitor_id) as unique_users
        FROM user_events
        WHERE timestamp > NOW() - INTERVAL '7 days'
        GROUP BY event_name
        ORDER BY count DESC
      `;

      formSubmissions = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN (event_data->>'success')::boolean = true THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN (event_data->>'success')::boolean = false THEN 1 ELSE 0 END) as failed
        FROM user_events
        WHERE event_name = 'form_submit' AND timestamp > NOW() - INTERVAL '7 days'
      `;

      urlAutofill = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN (event_data->>'success')::boolean = true THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN (event_data->>'success')::boolean = false THEN 1 ELSE 0 END) as failed,
          COUNT(DISTINCT event_data->>'url') as unique_urls
        FROM user_events
        WHERE event_name = 'url_autofill_attempt' AND timestamp > NOW() - INTERVAL '7 days'
      `;

      blogClicks = await sql`
        SELECT COUNT(*) as total_clicks, COUNT(DISTINCT visitor_id) as unique_users, event_data->>'source' as source
        FROM user_events
        WHERE event_name = 'blog_link_click' AND timestamp > NOW() - INTERVAL '7 days'
        GROUP BY event_data->>'source'
      `;

      funnelData = await sql`
        SELECT visitor_id,
          MAX(CASE WHEN event_name = 'page_view' AND page_path = '/' THEN 1 ELSE 0 END) as viewed_homepage,
          MAX(CASE WHEN event_name = 'url_autofill_attempt' THEN 1 ELSE 0 END) as tried_autofill,
          MAX(CASE WHEN event_name = 'form_submit' THEN 1 ELSE 0 END) as submitted_form,
          MAX(CASE WHEN event_name = 'report_generated' THEN 1 ELSE 0 END) as generated_report,
          MAX(CASE WHEN event_name = 'blog_link_click' THEN 1 ELSE 0 END) as clicked_blog
        FROM user_events
        WHERE timestamp > NOW() - INTERVAL '7 days'
        GROUP BY visitor_id
      `;
    } else if (timeframe === "30d") {
      totalEvents = eventName
        ? await sql`SELECT COUNT(*) as count FROM user_events WHERE timestamp > NOW() - INTERVAL '30 days' AND event_name = ${eventName}`
        : await sql`SELECT COUNT(*) as count FROM user_events WHERE timestamp > NOW() - INTERVAL '30 days'`;

      eventsByName = await sql`
        SELECT event_name, COUNT(*) as count, COUNT(DISTINCT visitor_id) as unique_users
        FROM user_events
        WHERE timestamp > NOW() - INTERVAL '30 days'
        GROUP BY event_name
        ORDER BY count DESC
      `;

      formSubmissions = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN (event_data->>'success')::boolean = true THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN (event_data->>'success')::boolean = false THEN 1 ELSE 0 END) as failed
        FROM user_events
        WHERE event_name = 'form_submit' AND timestamp > NOW() - INTERVAL '30 days'
      `;

      urlAutofill = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN (event_data->>'success')::boolean = true THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN (event_data->>'success')::boolean = false THEN 1 ELSE 0 END) as failed,
          COUNT(DISTINCT event_data->>'url') as unique_urls
        FROM user_events
        WHERE event_name = 'url_autofill_attempt' AND timestamp > NOW() - INTERVAL '30 days'
      `;

      blogClicks = await sql`
        SELECT COUNT(*) as total_clicks, COUNT(DISTINCT visitor_id) as unique_users, event_data->>'source' as source
        FROM user_events
        WHERE event_name = 'blog_link_click' AND timestamp > NOW() - INTERVAL '30 days'
        GROUP BY event_data->>'source'
      `;

      funnelData = await sql`
        SELECT visitor_id,
          MAX(CASE WHEN event_name = 'page_view' AND page_path = '/' THEN 1 ELSE 0 END) as viewed_homepage,
          MAX(CASE WHEN event_name = 'url_autofill_attempt' THEN 1 ELSE 0 END) as tried_autofill,
          MAX(CASE WHEN event_name = 'form_submit' THEN 1 ELSE 0 END) as submitted_form,
          MAX(CASE WHEN event_name = 'report_generated' THEN 1 ELSE 0 END) as generated_report,
          MAX(CASE WHEN event_name = 'blog_link_click' THEN 1 ELSE 0 END) as clicked_blog
        FROM user_events
        WHERE timestamp > NOW() - INTERVAL '30 days'
        GROUP BY visitor_id
      `;
    } else {
      // "all" - no time filter
      totalEvents = eventName
        ? await sql`SELECT COUNT(*) as count FROM user_events WHERE event_name = ${eventName}`
        : await sql`SELECT COUNT(*) as count FROM user_events`;

      eventsByName = await sql`
        SELECT event_name, COUNT(*) as count, COUNT(DISTINCT visitor_id) as unique_users
        FROM user_events
        GROUP BY event_name
        ORDER BY count DESC
      `;

      formSubmissions = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN (event_data->>'success')::boolean = true THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN (event_data->>'success')::boolean = false THEN 1 ELSE 0 END) as failed
        FROM user_events
        WHERE event_name = 'form_submit'
      `;

      urlAutofill = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN (event_data->>'success')::boolean = true THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN (event_data->>'success')::boolean = false THEN 1 ELSE 0 END) as failed,
          COUNT(DISTINCT event_data->>'url') as unique_urls
        FROM user_events
        WHERE event_name = 'url_autofill_attempt'
      `;

      blogClicks = await sql`
        SELECT COUNT(*) as total_clicks, COUNT(DISTINCT visitor_id) as unique_users, event_data->>'source' as source
        FROM user_events
        WHERE event_name = 'blog_link_click'
        GROUP BY event_data->>'source'
      `;

      funnelData = await sql`
        SELECT visitor_id,
          MAX(CASE WHEN event_name = 'page_view' AND page_path = '/' THEN 1 ELSE 0 END) as viewed_homepage,
          MAX(CASE WHEN event_name = 'url_autofill_attempt' THEN 1 ELSE 0 END) as tried_autofill,
          MAX(CASE WHEN event_name = 'form_submit' THEN 1 ELSE 0 END) as submitted_form,
          MAX(CASE WHEN event_name = 'report_generated' THEN 1 ELSE 0 END) as generated_report,
          MAX(CASE WHEN event_name = 'blog_link_click' THEN 1 ELSE 0 END) as clicked_blog
        FROM user_events
        GROUP BY visitor_id
      `;
    }

    // Calculate funnel metrics
    const totalVisitors = funnelData.rows.length;
    const triedAutofill = funnelData.rows.filter(r => r.tried_autofill).length;
    const submittedForm = funnelData.rows.filter(r => r.submitted_form).length;
    const generatedReport = funnelData.rows.filter(r => r.generated_report).length;
    const clickedBlog = funnelData.rows.filter(r => r.clicked_blog).length;

    // Recent events (last 50)
    const recentEvents = await sql`
      SELECT
        event_name,
        event_data,
        visitor_id,
        page_path,
        timestamp
      FROM user_events
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    // Extracted data summary (from successful URL autofills)
    let extractedDataSummary;
    if (timeframe === "24h") {
      extractedDataSummary = await sql`
        SELECT
          event_data->'extractedData'->>'make' as make,
          event_data->'extractedData'->>'model' as model,
          COUNT(*) as count
        FROM user_events
        WHERE event_name = 'url_autofill_attempt'
          AND (event_data->>'success')::boolean = true
          AND timestamp > NOW() - INTERVAL '24 hours'
          AND event_data->'extractedData'->>'make' IS NOT NULL
        GROUP BY event_data->'extractedData'->>'make', event_data->'extractedData'->>'model'
        ORDER BY count DESC
        LIMIT 10
      `;
    } else if (timeframe === "7d") {
      extractedDataSummary = await sql`
        SELECT
          event_data->'extractedData'->>'make' as make,
          event_data->'extractedData'->>'model' as model,
          COUNT(*) as count
        FROM user_events
        WHERE event_name = 'url_autofill_attempt'
          AND (event_data->>'success')::boolean = true
          AND timestamp > NOW() - INTERVAL '7 days'
          AND event_data->'extractedData'->>'make' IS NOT NULL
        GROUP BY event_data->'extractedData'->>'make', event_data->'extractedData'->>'model'
        ORDER BY count DESC
        LIMIT 10
      `;
    } else if (timeframe === "30d") {
      extractedDataSummary = await sql`
        SELECT
          event_data->'extractedData'->>'make' as make,
          event_data->'extractedData'->>'model' as model,
          COUNT(*) as count
        FROM user_events
        WHERE event_name = 'url_autofill_attempt'
          AND (event_data->>'success')::boolean = true
          AND timestamp > NOW() - INTERVAL '30 days'
          AND event_data->'extractedData'->>'make' IS NOT NULL
        GROUP BY event_data->'extractedData'->>'make', event_data->'extractedData'->>'model'
        ORDER BY count DESC
        LIMIT 10
      `;
    } else {
      extractedDataSummary = await sql`
        SELECT
          event_data->'extractedData'->>'make' as make,
          event_data->'extractedData'->>'model' as model,
          COUNT(*) as count
        FROM user_events
        WHERE event_name = 'url_autofill_attempt'
          AND (event_data->>'success')::boolean = true
          AND event_data->'extractedData'->>'make' IS NOT NULL
        GROUP BY event_data->'extractedData'->>'make', event_data->'extractedData'->>'model'
        ORDER BY count DESC
        LIMIT 10
      `;
    }

    return NextResponse.json({
      success: true,
      timeframe,
      stats: {
        totalEvents: totalEvents.rows[0]?.count || 0,
        eventsByName: eventsByName.rows,
        formSubmissions: formSubmissions.rows[0] || {
          total_attempts: 0,
          unique_users: 0,
          successful: 0,
          failed: 0,
        },
        urlAutofill: urlAutofill.rows[0] || {
          total_attempts: 0,
          unique_users: 0,
          successful: 0,
          failed: 0,
          unique_urls: 0,
        },
        blogClicks: blogClicks.rows,
        conversionFunnel: {
          totalVisitors,
          triedAutofill,
          submittedForm,
          generatedReport,
          clickedBlog,
          autofillConversion: totalVisitors > 0 ? ((triedAutofill / totalVisitors) * 100).toFixed(1) : 0,
          formConversion: totalVisitors > 0 ? ((submittedForm / totalVisitors) * 100).toFixed(1) : 0,
          reportConversion: totalVisitors > 0 ? ((generatedReport / totalVisitors) * 100).toFixed(1) : 0,
          blogConversion: totalVisitors > 0 ? ((clickedBlog / totalVisitors) * 100).toFixed(1) : 0,
        },
        recentEvents: recentEvents.rows,
        extractedDataSummary: extractedDataSummary.rows,
      },
    });
  } catch (error: any) {
    console.error("Event stats error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
