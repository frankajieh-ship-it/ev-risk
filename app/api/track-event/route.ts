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
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logApi } from "@/lib/api-logger";

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
  "report_generated_success",
  "report_generated_failed",
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
  "feedback_shown",
  "feedback_submitted",
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
  // Receipt Events
  "receipt_generate",
  "receipt_copy",
  "receipt_paid_clicked",
  "receipt_fetch_success",
  "receipt_fetch_fail",
  "receipt_lint_fail",
  "receipt_regen",
  "receipt_history_viewed",
  // Receipt Extraction Events
  "receipt_extract_clicked",
  "receipt_extract_succeeded",
  "receipt_extract_failed",
  "receipt_extract_fallback_used",
  "lint_failed_fallback_served",
  "receipt_generate_clicked",
  "receipt_result_viewed",
  "buyer_pass_teaser_shown",
  // Routine Fit Mini-step Events
  "routine_check_started",
  "routine_check_completed",
  "routine_score_viewed",
  "routine_field_completed",
  // Copy Granular Events
  "copy_reddit_draft",
  "copy_seller_message",
  "copy_checklist",
  // SEO Page Events
  "listing_paste_submitted",
  // Email Capture Events
  "email_checklist_submit",
  // Funnel Instrumentation Events
  "landing_view",
  "cta_start_click",
  "intake_started",
  "intake_step_completed",
  "report_generate_click",
  "entry_mode_selected",
  "save_click",
  "save_success",
  "copy_click",
  // Events fired from components (previously unlisted)
  "v2_score_submit",
  "routine_step_viewed",
  "clicked_listing_receipt",
  "manual_entry_submit",
  // Decision Pack / Payment Events
  "deep_dive_offer_viewed",
  "deep_dive_offer_clicked",
  "deep_dive_purchase_succeeded",
  "download_pdf_clicked",
  "download_pdf_succeeded",
  "compare_started",
  "compare_bound",
  // Save Receipt Events
  "save_receipt_clicked",
  "save_receipt_succeeded",
  // Saved Dashboard Events
  "saved_dashboard_viewed",
  "saved_scenario_resumed",
  // Email Checklist Delivery Events
  "email_checklist_modal_viewed",
  "email_checklist_sent",
  "email_checklist_failed",
  // Canonical funnel aliases (Unified Plan naming)
  "paywall_shown",
  "paywall_dismissed",
  "checkout_started",
  "checkout_completed",
  // Human Signal Events
  "page_visible_10s",
  "scroll_depth_25",
  "first_interaction",
  // VIN Check Events
  "vin_entered",
  "vin_decode_started",
  "vin_decode_succeeded",
  "vin_decode_failed",
  "vin_mismatch_flagged",
  "recall_check_clicked",
  // Email Gate Events
  "email_gate_shown",
  "email_gate_submitted",
  "email_gate_skipped",
  // Schema Repair Events
  "schema_repair_attempted",
  "schema_repair_succeeded",
  "schema_repair_failed",
  // Pack Tier / Upgrade Events
  "pack_download",
  "upgrade_shown",
  "upgrade_started",
  // Buyer Pass Events
  "buyer_pass_activated",
  "receipt_credit_used",
  // Email Capture Card Events
  "email_capture_shown",
  "email_capture_submitted",
  // Save Failure Events
  "save_receipt_failed",
  // Negotiator Events
  "negotiator_shown",
  "negotiator_copy_clicked",
  "negotiator_upsell_clicked",
  // Share / QR Events
  "share_qr_clicked",
  "share_link_created",
  "share_link_copied",
  "share_qr_downloaded",
  "share_card_downloaded",
  "share_modal_opened",
  "share_link_opened",
  "share_link_landing_view",
  "share_link_to_receipt_start_click",
  // Turnstile Bot Protection Events
  "turnstile_verified",
  "turnstile_blocked",
  // Identity Attach Events
  "attach_anon",
  "attach_anon_failed",
  // EVRoutine V2 Events
  "routine_profile_started",
  "routine_profile_completed",
  "routine_result_viewed",
  "break_first_viewed",
  "plan_b_viewed",
  "routine_saved",
  "charger_api_success",
  "charger_api_empty",
  "weather_api_success",
  "weather_api_fallback",
  "routine_step_blocked",
  "toggle_weekly_vs_commute",
  // Legacy event names (for backward compatibility)
  "page_view",
  // New Analytics Tracking Events (March 2026)
  "routine_form_completed",
  "routine_form_partial_abandon",
  "vehicle_list_generated",
  "vehicle_full_report_clicked",
  "external_link_clicked",
  "offo_dealer_viewed",
  "offo_dealer_message_sent",
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
  // New analytics events (March 2026)
  "routine_form_completed",
  "routine_form_partial_abandon",
  "vehicle_list_generated",
  "vehicle_full_report_clicked",
  "external_link_clicked",
  "offo_dealer_viewed",
  "offo_dealer_message_sent",
];

// Events that are enterprise-ready
const ENTERPRISE_READY_EVENTS = [
  "scenario_save_success",
  "email_confirmed",
  "report_generated",
  "report_generated_success",
  "email_checklist_submit",
  // New analytics events (March 2026)
  "routine_form_completed",
  "vehicle_list_generated",
  "vehicle_full_report_clicked",
  "offo_dealer_viewed",
  "offo_dealer_message_sent",
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
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

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
      dedupe_key,
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
        const { data: existing } = await supabase
          .from("user_events")
          .select("id")
          .eq("event_name", eventName)
          .filter("event_data->>report_id", "eq", reportId)
          .limit(1);

        if (existing && existing.length > 0) {
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

    // Merge tags + identifiers into event data for queryability
    const enrichedEventData = {
      ...eventData,
      _tags: tags,
      _user_id: userId || null,
      _visitor_id: visitorId || null,
      _session_id: sessionId || null,
    };

    const insertRow: Record<string, unknown> = {
      event_name: eventName,
      event_data: enrichedEventData,
      visitor_id: visitorId || null,
      session_id: sessionId || null,
      user_id: userId || null,
      page_path: pagePath || null,
      ip_address: ip,
      user_agent: userAgent,
      timestamp: eventTimestamp,
    };

    // Include dedupe_key if provided (unique partial index enforces dedup)
    if (dedupe_key && typeof dedupe_key === "string") {
      insertRow.dedupe_key = dedupe_key;
    }

    const { error } = await supabase.from("user_events").insert(insertRow);

    if (error) {
      // Unique constraint violation on dedupe_key = event already exists
      if (error.code === "23505" && dedupe_key) {
        return NextResponse.json({
          success: true,
          message: "Event deduplicated",
          deduplicated: true,
        });
      }
      logApi("error", "Event insert failed", { endpoint: "/api/track-event", error_code: "db_insert", event_name: eventName });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Event tracked successfully",
    });
  } catch (error: any) {
    logApi("error", "Event tracking error", { endpoint: "/api/track-event", error_code: "unhandled" });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for analytics
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "30d";
    const filterEventName = searchParams.get("event");

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

    // Fetch all events in timeframe
    let eventsQuery = supabase
      .from("user_events")
      .select("event_name, event_data, visitor_id, page_path, timestamp");
    if (cutoff) {
      eventsQuery = eventsQuery.gte("timestamp", cutoff);
    }
    const { data: allEvents } = await eventsQuery;
    const events = allEvents || [];

    // Total events (optionally filtered by event name)
    const totalEventsCount = filterEventName
      ? events.filter(e => e.event_name === filterEventName).length
      : events.length;

    // Events by name with unique users
    const eventNameMap = new Map<string, { count: number; visitors: Set<string> }>();
    for (const e of events) {
      const name = e.event_name || "unknown";
      if (!eventNameMap.has(name)) {
        eventNameMap.set(name, { count: 0, visitors: new Set() });
      }
      const entry = eventNameMap.get(name)!;
      entry.count++;
      if (e.visitor_id) entry.visitors.add(e.visitor_id);
    }
    const eventsByName = Array.from(eventNameMap.entries())
      .map(([event_name, { count, visitors }]) => ({
        event_name,
        count,
        unique_users: visitors.size,
      }))
      .sort((a, b) => b.count - a.count);

    // Form submissions
    const formEvents = events.filter(e => e.event_name === "form_submit");
    const formVisitors = new Set(formEvents.filter(e => e.visitor_id).map(e => e.visitor_id));
    const formSuccessful = formEvents.filter(e => {
      const s = String(e.event_data?.success || "").toLowerCase();
      return s === "true" || s === "1";
    }).length;
    const formFailed = formEvents.filter(e => {
      const s = String(e.event_data?.success || "").toLowerCase();
      return s === "false" || s === "0";
    }).length;

    // URL autofill
    const autofillEvents = events.filter(e => e.event_name === "url_autofill_attempt");
    const autofillVisitors = new Set(autofillEvents.filter(e => e.visitor_id).map(e => e.visitor_id));
    const autofillSuccessful = autofillEvents.filter(e => {
      const s = String(e.event_data?.success || "").toLowerCase();
      return s === "true" || s === "1";
    }).length;
    const autofillFailed = autofillEvents.filter(e => {
      const s = String(e.event_data?.success || "").toLowerCase();
      return s === "false" || s === "0";
    }).length;
    const uniqueUrls = new Set(autofillEvents.filter(e => e.event_data?.url).map(e => e.event_data.url));

    // Blog clicks by source
    const blogEvents = events.filter(e => e.event_name === "blog_link_click");
    const blogSourceMap = new Map<string, { clicks: number; visitors: Set<string> }>();
    for (const e of blogEvents) {
      const source = e.event_data?.source || "unknown";
      if (!blogSourceMap.has(source)) {
        blogSourceMap.set(source, { clicks: 0, visitors: new Set() });
      }
      const entry = blogSourceMap.get(source)!;
      entry.clicks++;
      if (e.visitor_id) entry.visitors.add(e.visitor_id);
    }
    const blogClicks = Array.from(blogSourceMap.entries()).map(([source, { clicks, visitors }]) => ({
      source,
      total_clicks: clicks,
      unique_users: visitors.size,
    }));

    // Funnel data: group events by visitor
    const visitorEvents = new Map<string, Set<string>>();
    for (const e of events) {
      if (!e.visitor_id) continue;
      if (!visitorEvents.has(e.visitor_id)) {
        visitorEvents.set(e.visitor_id, new Set());
      }
      const key = e.event_name === "page_view" && e.page_path === "/" ? "page_view_home" : e.event_name;
      visitorEvents.get(e.visitor_id)!.add(key);
    }
    const totalVisitors = visitorEvents.size;
    let triedAutofill = 0, submittedForm = 0, generatedReport = 0, clickedBlog = 0;
    for (const eventSet of visitorEvents.values()) {
      if (eventSet.has("url_autofill_attempt")) triedAutofill++;
      if (eventSet.has("form_submit")) submittedForm++;
      if (eventSet.has("report_generated")) generatedReport++;
      if (eventSet.has("blog_link_click")) clickedBlog++;
    }

    // Recent events (last 50)
    const { data: recentEventsRaw } = await supabase
      .from("user_events")
      .select("event_name, event_data, visitor_id, page_path, timestamp")
      .order("timestamp", { ascending: false })
      .limit(50);

    // Extracted data summary (successful URL autofills)
    const successfulAutofills = (cutoff
      ? autofillEvents
      : events.filter(e => e.event_name === "url_autofill_attempt")
    ).filter(e => {
      const s = String(e.event_data?.success || "").toLowerCase();
      return (s === "true" || s === "1") && e.event_data?.extractedData?.make;
    });
    const extractedMap = new Map<string, number>();
    for (const e of successfulAutofills) {
      const make = e.event_data.extractedData.make;
      const model = e.event_data.extractedData.model || "Unknown";
      const key = `${make}|${model}`;
      extractedMap.set(key, (extractedMap.get(key) || 0) + 1);
    }
    const extractedDataSummary = Array.from(extractedMap.entries())
      .map(([key, count]) => {
        const [make, model] = key.split("|");
        return { make, model, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      timeframe,
      stats: {
        totalEvents: totalEventsCount,
        eventsByName,
        formSubmissions: {
          total_attempts: formEvents.length,
          unique_users: formVisitors.size,
          successful: formSuccessful,
          failed: formFailed,
        },
        urlAutofill: {
          total_attempts: autofillEvents.length,
          unique_users: autofillVisitors.size,
          successful: autofillSuccessful,
          failed: autofillFailed,
          unique_urls: uniqueUrls.size,
        },
        blogClicks,
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
        recentEvents: recentEventsRaw || [],
        extractedDataSummary,
      },
    });
  } catch (error: any) {
    logApi("error", "Event stats query failed", { endpoint: "/api/track-event", error_code: "stats_query" });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
