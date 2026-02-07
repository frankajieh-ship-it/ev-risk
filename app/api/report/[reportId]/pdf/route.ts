/**
 * EV-Risk™ PDF Download API
 *
 * GET /api/report/[reportId]/pdf
 * Generates and downloads PDF report for paid reports only
 *
 * PDF rendering is delegated to a standalone Netlify Function
 * (netlify/functions/render-pdf.mts) to keep @react-pdf/renderer
 * out of the main server handler and under Netlify's 250 MB limit.
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { securityLogger } from "@/lib/security-logger";
import { calculateRoutineFitClient } from "@/lib/routine-fit-client";
import type { RenderPdfRequest, ReportPayload, ReportPdfV2Data, BreakPoint } from "@/lib/pdf/shared-types";

/**
 * Call the isolated render-pdf Netlify Function via HTTP.
 * In local dev, use `netlify dev` to run both Next.js and the function.
 */
async function renderPdf(payload: RenderPdfRequest): Promise<Buffer> {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8888";
  const functionUrl = `${baseUrl}/.netlify/functions/render-pdf`;

  const secret = process.env.PDF_RENDER_SECRET;
  if (!secret) {
    throw new Error("PDF_RENDER_SECRET not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pdf-render-secret": secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`PDF render function failed (${response.status}): ${errorBody}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

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
    const { data: report, error } = await supabase
      .from("reports")
      .select("status, payload_json, vehicle_year, vehicle_model, schema_version")
      .eq("id", reportId)
      .single();

    if (error || !report) {
      securityLogger.logReportAccessDenied(reportId, clientIP, "Report not found");
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

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

    // Detect schema version
    const schemaVersion = report.schema_version || report.payload_json?.schema_version || "v1";

    // Build the render request
    let renderRequest: RenderPdfRequest;

    if (schemaVersion === "v2") {
      const payload = report.payload_json;
      let routineFit = payload.primary?.routine_fit;

      // Backwards compat: convert old WhatBreaksFirst to breakpoints_ranked
      if (routineFit?.what_breaks_first && !routineFit?.breakpoints_ranked) {
        routineFit = {
          ...routineFit,
          breakpoints_ranked: convertLegacyBreakpoints(routineFit.what_breaks_first),
        };
        delete routineFit.what_breaks_first;
      }
      // Backwards compat: old "Conditional Fit" label
      if (routineFit?.label === "Conditional Fit") {
        routineFit.label = "Mixed Fit";
      }

      const v2Data: ReportPdfV2Data = {
        reportId,
        routineFit,
        ownershipRisk: payload.secondary?.ownership_risk,
        vehicle: payload.vehicle,
        routine: payload.routine,
        dealerQuestions: payload.dealer_questions || {
          top_3: [],
          full_list: [],
          walk_away_triggers: [],
        },
        generatedAt: payload.generated_at_iso,
      };
      renderRequest = { version: "v2", v2Data };
    } else {
      const v1Data = transformReportForPDF(
        report.payload_json,
        reportId,
        report.vehicle_year,
        report.vehicle_model
      );
      renderRequest = { version: "v1", v1Data };
    }

    // Render PDF via isolated function
    const pdfBuffer = await renderPdf(renderRequest);

    // Create filename
    const year = report.vehicle_year || "Unknown";
    const model = (report.vehicle_model || "Unknown").replace(/\s+/g, "-");
    const shortId = reportId.slice(0, 8);
    const filename = `EV-Risk-${year}-${model}-${shortId}.pdf`;

    // Track report download event
    const userAgent = req.headers.get("user-agent") || "unknown";
    try {
      await supabase.from("user_events").insert({
        event_name: "report_downloaded",
        event_data: {
          report_id: reportId,
          vehicle_year: report.vehicle_year,
          vehicle_model: report.vehicle_model,
          report_status: report.status,
        },
        ip_address: clientIP,
        user_agent: userAgent,
        page_path: `/api/report/${reportId}/pdf`,
        timestamp: new Date().toISOString(),
      });
    } catch (trackingError) {
      // Don't fail the download if tracking fails
      console.error("Failed to track report download:", trackingError);
    }

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

  // Calculate routine fit for FREE VERSION components
  let routineFit = undefined;
  if (reportData.input) {
    try {
      routineFit = calculateRoutineFitClient({
        dailyMiles: reportData.input.dailyMiles || 30,
        homeCharging: reportData.input.homeCharging || false,
        chargerDensity: reportData.confidence?.ownership_fit?.charger_density || "unknown",
        realWorldRange: 250,
        overall_score: score
      });
    } catch (error) {
      console.error("Failed to calculate routine fit for PDF:", error);
    }
  }

  return {
    reportId,
    level,
    score,
    vehicleYear,
    vehicleModel,
    summaryVerdict:
      reportData.confidence?.recommendation ||
      "Unable to generate recommendation",

    // FREE VERSION: Routine Fit Assessment
    routineFit,

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

/**
 * Convert old WhatBreaksFirst (primary/secondary strings) to BreakPoint[]
 * for backwards compatibility with stored V2 reports.
 */
function convertLegacyBreakpoints(
  old: { primary: string; primary_citation: string; secondary: string; secondary_citation: string }
): BreakPoint[] {
  return [
    {
      id: "legacy_primary",
      title: old.primary,
      break_point: old.primary,
      trigger: old.primary_citation,
      evidence: [{ label: "Source", value: "Legacy report" }],
      impact: "High",
      fallback_plan_b: {
        anchor: "Review your charging routine",
        backup: "Identify backup charging options",
        buffer_rule: "Maintain buffer above 30%",
      },
    },
    {
      id: "legacy_secondary",
      title: old.secondary,
      break_point: old.secondary,
      trigger: old.secondary_citation,
      evidence: [{ label: "Source", value: "Legacy report" }],
      impact: "Medium",
      fallback_plan_b: {
        anchor: "Monitor this factor",
        backup: "Plan alternatives in advance",
        buffer_rule: "Stay flexible with your schedule",
      },
    },
  ];
}
