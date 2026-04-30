/**
 * Free Report API
 *
 * POST /api/report/free
 * Creates a free report (first one is on us!)
 */

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { v4 as uuidv4 } from "uuid";
import { criticalApiRateLimiter, sessionRateLimiter, getClientIP } from "@/lib/rate-limiter";
import { guardTurnstile } from "@/lib/turnstile";
import { checkUserAgent } from "@/lib/bot-guard";

export async function GET(request: NextRequest) {
  const uaBlocked = checkUserAgent(request);
  if (uaBlocked) return uaBlocked;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const reportId = request.nextUrl.searchParams.get("reportId");
  if (!reportId) {
    return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    const { data, error } = await supabase
      .from("reports")
      .select("payload_json, status")
      .eq("id", reportId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      payload_json: data.payload_json,
      status: data.status,
    });
  } catch (error) {
    console.error("Report GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // 1. UA filter
  const uaBlocked = checkUserAgent(request);
  if (uaBlocked) return uaBlocked;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const clientIP = getClientIP(request);

  // 2. IP rate limit (10 req/min)
  const ipLimit = await criticalApiRateLimiter.checkAsync(clientIP);
  if (!ipLimit.allowed) {
    const retryAfter = Math.max(60, Math.ceil((ipLimit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();

    // 3. Turnstile verification
    const turnstileBlocked = await guardTurnstile(body, clientIP, "/api/report/free");
    if (turnstileBlocked) return turnstileBlocked;

    // 4. Session rate limit (20 req/min per session)
    const sessionId = (body.session_id as string | undefined) || "anonymous";
    const sessionLimit = await sessionRateLimiter.checkAsync(`session:${sessionId}`);
    if (!sessionLimit.allowed) {
      const retryAfter = Math.max(60, Math.ceil((sessionLimit.resetAt - Date.now()) / 1000));
      supabase.from("user_events").insert({
        event_name: "rate_limit_hit",
        event_data: { endpoint: "/api/report/free", session_id: sessionId },
        ip_address: clientIP,
        page_path: "/api/report/free",
        timestamp: new Date().toISOString(),
      }).then(() => {}, () => {});
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    const { reportData } = body;

    // Validate report data (V1 has confidence+input, V2 has primary+routine or _internal+default_view)
    const isV1 = reportData?.confidence && reportData?.input;
    const isV2 = (reportData?.primary && reportData?.routine) || (reportData?._internal && reportData?.default_view);
    if (!reportData || (!isV1 && !isV2)) {
      return NextResponse.json(
        { error: "Invalid report data - missing required fields" },
        { status: 400 }
      );
    }

    // Generate UUID for report
    const reportId = uuidv4();

    // Extract vehicle info (support new contract shape via _internal)
    const vehicleYear = reportData.input?.year || reportData.vehicle?.year || reportData._internal?.vehicle?.year || null;
    const vehicleModel = reportData.input?.model || reportData.vehicle?.model || reportData._internal?.vehicle?.model || "Unknown";

    // V2: Extract routine and schema_version (support new contract shape via _internal)
    const schemaVersion = reportData.schema_version || body.schema_version || "v1";
    const routine = reportData.routine || reportData._internal?.routine || body.routine || null;

    // Extract UA (IP already captured above for rate limiting)
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Store as free report in database
    const { error } = await supabase.from("reports").insert({
      id: reportId,
      status: "free",
      payload_json: reportData,
      vehicle_year: vehicleYear,
      vehicle_model: vehicleModel,
      is_free: true,
      schema_version: schemaVersion,
      routine: routine || null,
      charging_access: routine?.charging_access || null,
      climate: routine?.climate || null,
      longest_day_pattern: routine?.longest_day_pattern || null,
      weekly_miles: routine?.weekly_miles || null,
      commute_miles_roundtrip: routine?.commute_miles_roundtrip || null,
    });

    if (error) {
      console.error("Supabase insert error:", error);
      try {
        await supabase.from("user_events").insert({
          event_name: "report_generated_failed",
          event_data: {
            error_code: "db_insert_failed",
            message_safe: "Database insert failed",
            vehicle_year: vehicleYear,
            vehicle_model: vehicleModel,
          },
          ip_address: clientIP,
          user_agent: userAgent,
          page_path: "/api/report/free",
          timestamp: new Date().toISOString(),
        });
      } catch {
        // swallow
      }
      return NextResponse.json(
        { error: "Failed to create free report", details: error.message },
        { status: 500 }
      );
    }

    // Track report creation events for analytics
    try {
      const eventTimestamp = new Date().toISOString();
      await supabase.from("user_events").insert([
        {
          event_name: "report_created",
          event_data: {
            report_id: reportId,
            vehicle_year: vehicleYear,
            vehicle_model: vehicleModel,
            report_status: "free",
          },
          ip_address: clientIP,
          user_agent: userAgent,
          page_path: "/api/report/free",
          timestamp: eventTimestamp,
        },
        {
          event_name: "report_generated_success",
          event_data: {
            report_id: reportId,
            vehicle_year: vehicleYear,
            vehicle_model: vehicleModel,
            report_status: "free",
          },
          ip_address: clientIP,
          user_agent: userAgent,
          page_path: "/api/report/free",
          timestamp: eventTimestamp,
        },
      ]);
    } catch (trackingError) {
      console.error("Failed to track report creation:", trackingError);
    }

    console.log(`Free report created: ${reportId} (${vehicleYear} ${vehicleModel})`);

    return NextResponse.json({
      reportId,
      status: "free",
      message: "Free report created successfully - this one's on us!",
    });
  } catch (error) {
    console.error("Free report creation error:", error);
    try {
      await supabase.from("user_events").insert({
        event_name: "report_generated_failed",
        event_data: {
          error_code: "unhandled_exception",
          message_safe: error instanceof Error ? error.message : "Unknown error",
        },
        ip_address: clientIP,
        page_path: "/api/report/free",
        timestamp: new Date().toISOString(),
      });
    } catch {
      // swallow
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: "Failed to create free report",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create free report" },
      { status: 500 }
    );
  }
}
