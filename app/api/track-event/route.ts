/**
 * Event Tracking API
 * Logs user interactions and conversion funnel events
 *
 * Features:
 * - Event validation (allowed event names, schema validation)
 * - IP/Enterprise tagging for investor-ready analytics
 * - Consistent event schema enforcement
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

// Valid event names for validation
const VALID_EVENT_NAMES = [
  // Form & Input Events
  "form_submit",
  "url_autofill_attempt",
  "intake_submitted", // NEW: Form intake submitted (before report generation)
  // Navigation Events
  "blog_link_click",
  "button_click",
  // Report Events
  "report_generated",
  "report_view",
  "report_generation_started", // NEW: Report generation started
  "report_generation_succeeded", // NEW: Report generation succeeded
  "report_generation_failed", // NEW: Report generation failed
  // Scenario Save Events
  "scenario_save_clicked",
  "scenario_save_success",
  // Authentication Events
  "email_entry_start",
  "email_entry_submitted",
  "email_confirmed",
  // Feedback Events
  "feedback_helpful",
  "feedback_accuracy",
  "why_checkpoint_shown",
  "why_checkpoint_submitted",
  "why_checkpoint_skipped",
  "why_checkpoint_error",
  // Constraint Events
  "constraint_detected",
  "constraint_signal_viewed",
  // Micro Feedback Events
  "micro_feedback_shown",
  "micro_feedback_submitted",
  "micro_feedback_skipped",
  // Scroll & Engagement Events
  "scroll_depth",
  "time_on_page",
  // Failure Tracking Events (NEW)
  "form_validation_failed",
  "api_error",
  "form_abandoned",
  // Legacy event names (for backward compatibility)
  "page_view",
] as const;

// Events that should be deduplicated by report_id (to prevent double-counting)
const DEDUPE_BY_REPORT_ID_EVENTS = [
  "why_checkpoint_shown",
  "why_checkpoint_submitted",
];

// Events that are IP-relevant (defensible insights)
const IP_RELEVANT_EVENTS = [
  "constraint_detected",
  "scenario_save_success",
  "report_generated",
];

// Events that are enterprise-ready
const ENTERPRISE_READY_EVENTS = [
  "scenario_save_success",
  "email_confirmed",
  "report_generated",
];

// Validate event payload
function validateEventPayload(eventName: string, eventData: any, sessionId: string | null): { valid: boolean; error?: string } {
  // Check event name
  if (!eventName) {
    return { valid: false, error: "event_name is required" };
  }

  // Allow any event name for flexibility, but log warning for unknown events
  if (!VALID_EVENT_NAMES.includes(eventName as any)) {
    console.warn(`[EventTracking] Unknown event name: ${eventName}`);
  }

  // Check session ID (warn but don't reject)
  if (!sessionId) {
    console.warn(`[EventTracking] Event ${eventName} missing session_id`);
  }

  // Check event data size (max 10KB)
  if (eventData) {
    const dataSize = JSON.stringify(eventData).length;
    if (dataSize > 10240) {
      return { valid: false, error: "event_data exceeds 10KB limit" };
    }
  }

  return { valid: true };
}

// Determine IP relevance and enterprise readiness
function getEventTags(eventName: string, eventData: any, userId?: string): { ip_relevance: boolean; enterprise_ready: boolean } {
  const ipRelevance = IP_RELEVANT_EVENTS.includes(eventName) || eventData?.is_novel_scenario === true;
  const enterpriseReady = ENTERPRISE_READY_EVENTS.includes(eventName) || !!userId;

  return {
    ip_relevance: ipRelevance,
    enterprise_ready: enterpriseReady,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventName,
      eventData,
      visitorId,
      sessionId,
      userId,
      pagePath,
      timestamp,
    } = body;

    // Validate event payload
    const validation = validateEventPayload(eventName, eventData, sessionId);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Get visitor metadata
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ||
               req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    // Validate and normalize timestamp
    let eventTimestamp: string;
    if (timestamp) {
      const parsedDate = new Date(timestamp);
      if (isNaN(parsedDate.getTime())) {
        eventTimestamp = new Date().toISOString();
        console.warn(`[EventTracking] Invalid timestamp for ${eventName}, using current time`);
      } else {
        eventTimestamp = parsedDate.toISOString();
      }
    } else {
      eventTimestamp = new Date().toISOString();
    }

    // Get event tags
    const tags = getEventTags(eventName, eventData, userId);

    // Check for deduplication (why_checkpoint events by report_id)
    if (DEDUPE_BY_REPORT_ID_EVENTS.includes(eventName) && eventData?.report_id) {
      const reportId = eventData.report_id;
      try {
        const existing = await sql`
          SELECT 1 FROM user_events
          WHERE event_name = ${eventName}
          AND event_data->>'report_id' = ${reportId}
          LIMIT 1
        `;
        if (existing.rows.length > 0) {
          // Already have this event for this report_id, skip
          return NextResponse.json({
            success: true,
            message: "Event deduplicated (already exists for this report_id)",
            deduplicated: true,
          });
        }
      } catch (dedupeError) {
        // If dedup check fails, continue to insert (fail open)
        console.warn(`[EventTracking] Dedup check failed for ${eventName}:`, dedupeError);
      }
    }

    // Merge tags into event data
    const enrichedEventData = {
      ...eventData,
      _tags: tags,
      _user_id: userId || null,
    };

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
        ${JSON.stringify(enrichedEventData)},
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

    // Build queries based on timeframe
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
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('true', '1') THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('false', '0') THEN 1 ELSE 0 END) as failed
        FROM user_events
        WHERE event_name = 'form_submit' AND timestamp > NOW() - INTERVAL '24 hours'
      `;

      urlAutofill = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('true', '1') THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('false', '0') THEN 1 ELSE 0 END) as failed,
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
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('true', '1') THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('false', '0') THEN 1 ELSE 0 END) as failed
        FROM user_events
        WHERE event_name = 'form_submit' AND timestamp > NOW() - INTERVAL '7 days'
      `;

      urlAutofill = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('true', '1') THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('false', '0') THEN 1 ELSE 0 END) as failed,
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
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('true', '1') THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('false', '0') THEN 1 ELSE 0 END) as failed
        FROM user_events
        WHERE event_name = 'form_submit' AND timestamp > NOW() - INTERVAL '30 days'
      `;

      urlAutofill = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('true', '1') THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('false', '0') THEN 1 ELSE 0 END) as failed,
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
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('true', '1') THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('false', '0') THEN 1 ELSE 0 END) as failed
        FROM user_events
        WHERE event_name = 'form_submit'
      `;

      urlAutofill = await sql`
        SELECT COUNT(*) as total_attempts, COUNT(DISTINCT visitor_id) as unique_users,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('true', '1') THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN LOWER(event_data->>'success') IN ('false', '0') THEN 1 ELSE 0 END) as failed,
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
          AND LOWER(event_data->>'success') IN ('true', '1')
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
          AND LOWER(event_data->>'success') IN ('true', '1')
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
          AND LOWER(event_data->>'success') IN ('true', '1')
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
          AND LOWER(event_data->>'success') IN ('true', '1')
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
