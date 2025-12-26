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

    // Extract vehicle info for easier querying
    const vehicleYear = reportData.input.year || null;
    const vehicleModel = reportData.input.model || "Unknown";

    // Store as draft in database
    await sql`
      INSERT INTO reports (
        id,
        status,
        payload_json,
        vehicle_year,
        vehicle_model
      )
      VALUES (
        ${reportId},
        'draft',
        ${JSON.stringify(reportData)}::jsonb,
        ${vehicleYear},
        ${vehicleModel}
      )
    `;

    console.log(`✅ Draft report created: ${reportId} (${vehicleYear} ${vehicleModel})`);

    return NextResponse.json({
      reportId,
      status: "draft",
      message: "Report created successfully",
    });
  } catch (error) {
    console.error("Report creation error:", error);

    // Handle specific database errors
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
