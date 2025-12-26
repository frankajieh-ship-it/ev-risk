/**
 * EV-Risk™ PDF Download API
 *
 * GET /api/report/[reportId]/pdf
 * Generates and downloads PDF report for paid reports only
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReportPdf, type ReportPayload } from "@/lib/pdf/ReportPdf";
import { securityLogger } from "@/lib/security-logger";

export const runtime = "nodejs"; // Required for @react-pdf/renderer

const sql = neon(process.env.POSTGRES_URL!);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;

  // Get client IP for logging
  const forwarded = req.headers.get("x-forwarded-for");
  const realIP = req.headers.get("x-real-ip");
  const clientIP = forwarded?.split(",")[0] || realIP || "unknown";

  try {
    // Load report from database
    const result = await sql`
      SELECT status, payload_json, vehicle_year, vehicle_model
      FROM reports
      WHERE id = ${reportId}
    `;

    if (result.length === 0) {
      securityLogger.logReportAccessDenied(reportId, clientIP, "Report not found");
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const report = result[0];

    // Verify payment or free status
    if (report.status !== "paid" && report.status !== "free") {
      securityLogger.logReportAccessDenied(
        reportId,
        clientIP,
        `Unpaid report access attempt (status: ${report.status})`
      );
      return NextResponse.json(
        { error: "Payment required - report not paid" },
        { status: 402 }
      );
    }

    // Transform data for PDF
    const pdfData = transformReportForPDF(
      report.payload_json,
      reportId,
      report.vehicle_year,
      report.vehicle_model
    );

    // Generate PDF
    const pdfDoc = React.createElement(ReportPdf, { data: pdfData }) as any;
    const pdfBuffer = await renderToBuffer(pdfDoc);

    // Create filename
    const year = report.vehicle_year || "Unknown";
    const model = (report.vehicle_model || "Unknown").replace(/\s+/g, "-");
    const shortId = reportId.slice(0, 8);
    const filename = `EV-Risk-${year}-${model}-${shortId}.pdf`;

    // Return PDF with strong cache prevention
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Transform report data to PDF payload format
 */
function transformReportForPDF(
  reportData: any,
  reportId: string,
  vehicleYear?: number,
  vehicleModel?: string
): ReportPayload {
  // Determine risk level from score
  const score = reportData.confidence?.overall_score || 0;
  const level: "green" | "yellow" | "red" =
    score >= 70 ? "green" : score >= 40 ? "yellow" : "red";

  return {
    reportId,
    level,
    score,
    vehicleYear,
    vehicleModel,
    summaryVerdict:
      reportData.confidence?.recommendation ||
      "Unable to generate recommendation",

    // Battery risk section
    batteryRiskExplanation: [
      reportData.confidence?.battery_risk?.details ||
        "Battery risk data unavailable",
      `Estimated degradation: ${reportData.confidence?.battery_risk?.degradation_percent || "N/A"}%`,
      `Replacement cost estimate: $${(reportData.confidence?.battery_risk?.estimated_replacement_cost || 0).toLocaleString()}`,
      `Battery health score: ${reportData.confidence?.battery_risk?.score || "N/A"}/100`,
    ],

    // Platform/recall risk section
    platformRecallRisk: [
      reportData.confidence?.platform_risk?.details ||
        "Platform risk data unavailable",
      `Total recalls: ${reportData.confidence?.platform_risk?.total_recalls || 0}`,
      `Critical recalls: ${reportData.confidence?.platform_risk?.critical_recalls || 0}`,
      `Platform reliability score: ${reportData.confidence?.platform_risk?.score || "N/A"}/100`,
    ],

    // Ownership fit section
    ownershipFit: [
      reportData.confidence?.ownership_fit?.details ||
        "Ownership fit data unavailable",
      `Climate impact: ${reportData.confidence?.ownership_fit?.climate_impact || "Unknown"}`,
      `Charger density: ${reportData.confidence?.ownership_fit?.charger_density || "Unknown"}`,
      `Range adequacy: ${reportData.confidence?.ownership_fit?.range_adequacy || "Unknown"}`,
    ],

    // Dealer questions
    dealerQuestions: [
      "Has the battery been replaced or serviced under warranty?",
      "Can you provide the current State of Health (SoH) percentage?",
      "Are all manufacturer recalls completed? Which ones remain?",
      "What is the remaining manufacturer warranty coverage?",
      "Has this vehicle been in any accidents or had flood damage?",
      "Can I get a pre-purchase inspection by a certified EV technician?",
      "What is the complete service history for this vehicle?",
    ],

    // Walk-away triggers
    walkAwayTriggers: [
      "Battery State of Health (SoH) below 80%",
      "Any uncompleted safety recalls",
      "No documented service history available",
      "Seller refuses independent pre-purchase inspection",
      "Price significantly above market value",
      "Evidence of previous accident or flood damage",
      "Unusual battery degradation for vehicle age/mileage",
    ],
  };
}
