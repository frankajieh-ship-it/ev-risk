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
import type { NormalizedAuctionLot, NhtsaRecallSummary } from "@/lib/auction/types";
import type { ClassificationOutput, RoutineImpactOutput } from "@/lib/auction/auction-ai-chain";
import { isInternalUserId } from "@/lib/rollout-flags";

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
      "result_id, auction_source, lot_number, vin, raw_data, final_report, ai_output, is_paid, cache_expires_at, created_at, user_id"
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

  // Check entitlement: paid flag, entitlements table, or internal QA user
  let isPaidUnlocked = row.is_paid || isInternalUserId(row.user_id as string | null);
  if (!isPaidUnlocked) {
    const { data: entitlement } = await supabase
      .from("auction_entitlements")
      .select("id")
      .eq("result_id", resultId)
      .maybeSingle();
    isPaidUnlocked = Boolean(entitlement);
  }

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
      verdict: report.verdict ?? null,
      classification: aiOutput?.classification ?? null,
      routine_impact: aiOutput?.routine_impact ?? null,
      cached: true,
      created_at: row.created_at,
      expires_at: row.cache_expires_at,
    },
  });
}
