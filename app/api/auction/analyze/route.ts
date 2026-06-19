/**
 * POST /api/auction/analyze
 *
 * Unified auction evaluation endpoint.
 * Accepts any supported auction source URL or lot number + source identifier.
 *
 * Calls AuctionEvaluationService which:
 * - Routes to the correct source adapter
 * - Checks 24h persistence cache
 * - Runs deterministic + AI evaluation
 * - Persists result + optionally upserts garage vehicle
 *
 * Returns AuctionEvalReport.
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import { auctionEvaluationService } from "@/lib/auction/auction-evaluation-service";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { enrichVehicleProfileFromVin } from "@/lib/enrich-vehicle-profile";
import {
  AuctionSourceNotSupportedError,
  AuctionLotNotFoundError,
  type AuctionSource,
} from "@/lib/auction/types";

export const maxDuration = 60;

const VALID_SOURCES: AuctionSource[] = ["copart", "iaai", "manheim"];

const rateLimiter = new RateLimiter(60 * 1000, 10); // 10/min per IP

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const url = (body.url as string) || undefined;
  const lotNumber = (body.lot_number as string) || undefined;
  const rawSource = body.auction_source as string;
  const receiptToken = (body.receipt_token as string) || "";
  const userId = (body.user_id as string) || null;

  // Validate source
  if (!rawSource || !VALID_SOURCES.includes(rawSource as AuctionSource)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid auction_source",
        valid_sources: VALID_SOURCES,
      },
      { status: 400 }
    );
  }

  // Must have url or lot_number
  if (!url && !lotNumber) {
    return NextResponse.json(
      { success: false, error: "Either url or lot_number is required" },
      { status: 400 }
    );
  }

  if (!receiptToken) {
    return NextResponse.json(
      { success: false, error: "receipt_token is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const startedAt = Date.now();

  // Track analysis started
  try {
    await supabase?.from("user_events").insert({
      event_name: "copart_analyze_started",
      event_data: {
        auction_source: rawSource,
        input_type: url ? "url" : "lot_number",
      },
      anon_id: receiptToken,
      ip_address: ip,
      page_path: "/api/auction/analyze",
      timestamp: new Date().toISOString(),
    });
  } catch { /* non-critical */ }

  // Hard 55s guard — Netlify kills the function at 60s with no response, which
  // surfaces as a raw TCP reset ("Connection error") on the client. This ensures
  // we always return a proper JSON error before the function is killed.
  const PIPELINE_TIMEOUT_MS = 55_000;
  let pipelineTimeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    pipelineTimeout = setTimeout(() => reject(new Error("pipeline_timeout")), PIPELINE_TIMEOUT_MS);
  });

  try {
    const report = await Promise.race([
      auctionEvaluationService.evaluate({
        url,
        lot_number: lotNumber,
        auction_source: rawSource as AuctionSource,
        receipt_token: receiptToken,
        user_id: userId,
        routine_profile: null,
      }),
      timeoutPromise,
    ]);
    if (pipelineTimeout) clearTimeout(pipelineTimeout);

    // Track analysis completed
    try {
      await supabase?.from("user_events").insert({
        event_name: "copart_analyze_completed",
        event_data: {
          result_id: report.report_id,
          auction_source: rawSource,
          lot_number: report.lot?.lot_number ?? null,
          cached: report.cached ?? false,
          salvage_grade: report.salvage_risk?.grade ?? null,
          salvage_score: report.salvage_risk?.score ?? null,
          recall_count: Array.isArray(report.recalls) ? report.recalls.length : 0,
          provider: report.lot?.provider_name ?? null,
          latency_ms: Date.now() - startedAt,
        },
        anon_id: receiptToken,
        ip_address: ip,
        page_path: "/api/auction/analyze",
        timestamp: new Date().toISOString(),
      });
    } catch { /* non-critical */ }

    // Fire-and-forget: enrich vehicle_profiles from this VIN (non-blocking)
    const lot = report.lot;
    if (lot?.vin && lot.make && lot.model && lot.year) {
      enrichVehicleProfileFromVin(lot.vin, lot.make, lot.model, lot.year);
    }

    return NextResponse.json({ success: true, report });
  } catch (err) {
    if (pipelineTimeout) clearTimeout(pipelineTimeout);

    // Track analysis failed
    try {
      await supabase?.from("user_events").insert({
        event_name: "copart_analyze_failed",
        event_data: {
          auction_source: rawSource,
          error: err instanceof Error ? err.message : "unknown",
          latency_ms: Date.now() - startedAt,
        },
        anon_id: receiptToken,
        ip_address: ip,
        page_path: "/api/auction/analyze",
        timestamp: new Date().toISOString(),
      });
    } catch { /* non-critical */ }

    if (err instanceof Error && err.message === "pipeline_timeout") {
      return NextResponse.json(
        { success: false, error: "timeout", message: "Analysis took too long — please try again. Results may be cached on the next attempt." },
        { status: 504 }
      );
    }

    if (err instanceof AuctionSourceNotSupportedError) {
      return NextResponse.json(
        {
          success: false,
          error: "auction_source_not_supported",
          source: err.source,
          message: `${err.source} integration is not yet available.`,
        },
        { status: 422 }
      );
    }

    if (err instanceof AuctionLotNotFoundError) {
      return NextResponse.json(
        { success: false, error: "lot_not_found", message: err.message },
        { status: 404 }
      );
    }

    console.error("[/api/auction/analyze] Error:", err);
    return NextResponse.json(
      { success: false, error: "Evaluation failed" },
      { status: 500 }
    );
  }
}
