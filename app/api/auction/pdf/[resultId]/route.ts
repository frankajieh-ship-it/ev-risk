/**
 * GET /api/auction/pdf/[resultId]
 *
 * Generate and return a PDF report for a completed auction analysis.
 * Requires is_paid = true on the record (paid tier only).
 *
 * Delegates rendering to the Netlify render-pdf function using the
 * sellers_report PDF template (re-used for auction verdicts).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import type { NormalizedAuctionLot } from "@/lib/auction/types";

export const maxDuration = 30;

const rateLimiter = new RateLimiter(60 * 1000, 5); // 5/min per IP — PDF is expensive

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
  const ip = getClientIP(request);
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const { resultId } = await params;
  if (!resultId || !resultId.startsWith("auc_")) {
    return NextResponse.json({ success: false, error: "Invalid result ID" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Service unavailable" }, { status: 503 });
  }

  const { data: row } = await supabase
    .from("auction_analyses")
    .select("result_id, is_paid, raw_data, final_report, created_at, auction_source")
    .eq("result_id", resultId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ success: false, error: "Result not found" }, { status: 404 });
  }

  // Check entitlement: paid flag on record OR a row in auction_entitlements
  let isPaidUnlocked = row.is_paid;
  if (!isPaidUnlocked) {
    const { data: entitlement } = await supabase
      .from("auction_entitlements")
      .select("id")
      .eq("result_id", resultId)
      .maybeSingle();
    isPaidUnlocked = Boolean(entitlement);
  }

  if (!isPaidUnlocked) {
    return NextResponse.json(
      { success: false, error: "Payment required to download PDF", payment_required: true },
      { status: 402 }
    );
  }

  const lot = row.raw_data as NormalizedAuctionLot;
  const report = row.final_report as Record<string, unknown>;
  const verdict = report.verdict as Record<string, unknown> | null;
  const arbitrage = report.arbitrage as Record<string, unknown> | null;
  const salvageRisk = report.salvage_risk as Record<string, unknown> | null;

  // Build PDF payload using sellers_report template
  const pdfPayload = {
    version: "sellers_report" as const,
    sellersReportData: {
      vehicle: {
        year: lot.year,
        make: lot.make ?? "Unknown",
        model: lot.model ?? "Unknown",
        trim: lot.trim ?? null,
        vin: lot.vin ?? null,
        mileage: lot.odometer ?? null,
        title_status: lot.title_status ?? null,
        damage_type: lot.damage_type ?? null,
        auction_source: lot.auction_source,
        lot_number: lot.lot_number,
      },
      headline: (verdict?.headline as string) ?? `${lot.year ?? ""} ${lot.make ?? ""} ${lot.model ?? ""} — Auction Report`,
      summary: (verdict?.summary as string) ?? null,
      recommended_action: (verdict?.recommended_action as string) ?? null,
      top_risks: (verdict?.top_risks as string[]) ?? [],
      arbitrage: arbitrage ?? null,
      salvage_score: (salvageRisk?.salvage_risk_score as number) ?? null,
      salvage_grade: (salvageRisk?.salvage_risk_grade as string) ?? null,
      result_id: row.result_id,
      generated_at: new Date().toISOString(),
    },
  };

  // Call Netlify render-pdf function
  const renderUrl = process.env.PDF_RENDER_URL || `${process.env.URL}/.netlify/functions/render-pdf`;
  const renderSecret = process.env.PDF_RENDER_SECRET;

  if (!renderSecret || !renderUrl) {
    return NextResponse.json({ success: false, error: "PDF service not configured" }, { status: 503 });
  }

  const renderRes = await fetch(renderUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pdf-render-secret": renderSecret,
    },
    body: JSON.stringify(pdfPayload),
    signal: AbortSignal.timeout(25_000),
  });

  if (!renderRes.ok) {
    console.error("[/api/auction/pdf] render-pdf returned", renderRes.status);
    return NextResponse.json({ success: false, error: "PDF generation failed" }, { status: 502 });
  }

  const pdfBuffer = await renderRes.arrayBuffer();
  const filename = `auction-report-${lot.make ?? "vehicle"}-${lot.year ?? ""}-${resultId.slice(-8)}.pdf`
    .toLowerCase()
    .replace(/\s+/g, "-");

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
