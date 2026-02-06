/**
 * EV-Risk™ Report Creation API
 *
 * POST /api/report/create
 * Creates a draft report in the database BEFORE payment
 *
 * Flow:
 * 1. User completes form → scoring
 * 2. Frontend calls this endpoint → stores draft report
 * 3. Returns reportId for checkout
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportData } = body;

    // Validate report data
    if (!reportData || !reportData.confidence || !reportData.input) {
      return NextResponse.json(
        { error: "Invalid report data - missing required fields" },
        { status: 400 }
      );
    }

    // Generate UUID for report
    const reportId = uuidv4();

    // Extract vehicle info for easier querying
    const vehicleYear = reportData.input?.year || reportData.vehicle?.year || null;
    const vehicleModel = reportData.input?.model || reportData.vehicle?.model || "Unknown";

    // V2: Extract routine and schema_version
    const schemaVersion = reportData.schema_version || body.schema_version || "v1";
    const routine = reportData.routine || body.routine || null;

    // Store as draft in database
    const { error } = await supabase.from("reports").insert({
      id: reportId,
      status: "draft",
      payload_json: reportData,
      vehicle_year: vehicleYear,
      vehicle_model: vehicleModel,
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
        { error: "Failed to create report", details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Draft report created: ${reportId} (${vehicleYear} ${vehicleModel})`);

    return NextResponse.json({
      reportId,
      status: "draft",
      message: "Report created successfully",
    });
  } catch (error) {
    console.error("Report creation error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: "Failed to create report",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/report/create (healthcheck/info)
 */
export async function GET() {
  return NextResponse.json({
    message: "Report creation endpoint - use POST to create reports",
    requiredFields: ["reportData"],
    example: {
      reportData: {
        success: true,
        input: { year: 2021, model: "Tesla", /* ... */ },
        confidence: { overall_score: 85, /* ... */ },
      },
    },
  });
}
