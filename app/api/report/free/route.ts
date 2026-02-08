/**
 * Free Report API
 *
 * POST /api/report/free
 * Creates a free report (first one is on us!)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
      return NextResponse.json(
        { error: "Failed to create free report", details: error.message },
        { status: 500 }
      );
    }

    // Track report creation event for analytics
    const userAgent = request.headers.get("user-agent") || "unknown";
    const clientIP = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";

    try {
      await supabase.from("user_events").insert({
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
        timestamp: new Date().toISOString(),
      });
    } catch (trackingError) {
      console.error("Failed to track report creation:", trackingError);
    }

    console.log(`✅ Free report created: ${reportId} (${vehicleYear} ${vehicleModel})`);

    return NextResponse.json({
      reportId,
      status: "free",
      message: "Free report created successfully - this one's on us!",
    });
  } catch (error) {
    console.error("Free report creation error:", error);

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
