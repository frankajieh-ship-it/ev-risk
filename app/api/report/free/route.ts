/**
 * Free Report API
 *
 * POST /api/report/free
 * Creates a free report (first one is on us!)
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { v4 as uuidv4 } from "uuid";

const sql = neon(process.env.POSTGRES_URL!);

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

    // Extract vehicle info
    const vehicleYear = reportData.input.year || null;
    const vehicleModel = reportData.input.model || "Unknown";

    // Store as free report in database
    await sql`
      INSERT INTO reports (
        id,
        status,
        payload_json,
        vehicle_year,
        vehicle_model,
        is_free
      )
      VALUES (
        ${reportId},
        'free',
        ${JSON.stringify(reportData)}::jsonb,
        ${vehicleYear},
        ${vehicleModel},
        true
      )
    `;

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
