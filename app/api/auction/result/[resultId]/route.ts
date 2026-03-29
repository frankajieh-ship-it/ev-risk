/**
 * GET /api/auction/result/[resultId]
 *
 * Fetch a previously computed auction analysis by its stable result_id.
 * Returns the full AuctionEvalReport from auction_analyses.
 *
 * Access rules:
 * - Anyone with the result_id can fetch the free-tier report
 * - Paid fields (arbitrage) are included if is_paid = true on the record
 *   OR if the caller provides a valid receipt_token that unlocks it
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import type {
  NormalizedAuctionLot,
  NhtsaRecallSummary,
  ChargingProfileSummary,
  RangeProjection,
  IncentiveStatus,
  ElectricityContext,
} from "@/lib/auction/types";
import type { OffoScore } from "@/types/v2";
import type { ClassificationOutput, RoutineImpactOutput } from "@/lib/auction/auction-ai-chain";


export const maxDuration = 15;

const rateLimiter = new RateLimiter(60 * 1000, 30); // 30/min per IP

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

  const { data: row, error } = await supabase
    .from("auction_analyses")
    .select(
      "result_id, auction_source, lot_number, vin, raw_data, final_report, ai_output, cache_expires_at, created_at"
    )
    .eq("result_id", resultId)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ success: false, error: "Result not found" }, { status: 404 });
  }

  const report = row.final_report as Record<string, unknown>;
  const lot = row.raw_data as NormalizedAuctionLot;
  const aiOutput = row.ai_output as {
    classification?: ClassificationOutput | null;
    routine_impact?: RoutineImpactOutput | null;
  } | null;

  // Track result view (fire-and-forget)
  const salvageRisk = report.salvage_risk as Record<string, unknown> | null;
  try {
    const anonId = request.nextUrl.searchParams.get("anon_id") ?? undefined;
    await supabase.from("user_events").insert({
      event_name: "auction_result_viewed",
      event_data: {
        result_id: resultId,
        auction_source: row.auction_source,
        lot_number: lot?.lot_number ?? null,
        salvage_grade: (salvageRisk?.grade as string) ?? null,
        salvage_score: (salvageRisk?.score as number) ?? null,
        recall_count: Array.isArray(report.recalls) ? (report.recalls as unknown[]).length : 0,
      },
      anon_id: anonId ?? null,
      ip_address: ip,
      page_path: `/auction/${resultId}`,
      timestamp: new Date().toISOString(),
    });
  } catch { /* non-critical */ }

  // All features are free — always unlocked
  const isPaidUnlocked = true;

  // Strip arbitrage from free-tier response
  const arbitrage = isPaidUnlocked ? (report.arbitrage ?? null) : null;

  return NextResponse.json({
    success: true,
    result_id: row.result_id,
    auction_source: row.auction_source,
    cache_hit: true,
    paid_unlocked: isPaidUnlocked,
    report: {
      report_id: row.result_id,
      lot,
      salvage_risk: report.salvage_risk,
      arbitrage,
      recalls: (report.recalls as NhtsaRecallSummary[]) ?? [],
      routine_fit: report.routine_fit ?? null,
      charging_profile: (report.charging_profile as ChargingProfileSummary) ?? null,
      range_projection: (report.range_projection as RangeProjection) ?? null,
      incentive_status: (report.incentive_status as IncentiveStatus) ?? null,
      electricity_context: (report.electricity_context as ElectricityContext) ?? null,
      offo_score: (report.offo_score as OffoScore) ?? null,
      verdict: report.verdict ?? null,
      classification: aiOutput?.classification ?? null,
      routine_impact: aiOutput?.routine_impact ?? null,
      cached: true,
      created_at: row.created_at,
      expires_at: row.cache_expires_at,
    },
  });
}
