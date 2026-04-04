/**
 * POST /api/auction/batch
 *
 * Batch lot analysis for auction dealers. Evaluates up to 10 lots in parallel
 * and returns results sorted by OFFO score descending so the best buys surface
 * at the top.
 *
 * Body:
 *   { lots: [{ lot_number?: string; url?: string; auction_source: AuctionSource }],
 *     receipt_token: string }
 *
 * Returns:
 *   { success, results: [{ lot_index, lot_number, status, report?, error? }] }
 *   sorted by offo_score.overall_score descending (nulls last)
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import { auctionEvaluationService } from "@/lib/auction/auction-evaluation-service";
import {
  AuctionSourceNotSupportedError,
  AuctionLotNotFoundError,
  type AuctionSource,
  type AuctionEvalReport,
} from "@/lib/auction/types";

export const maxDuration = 60;

const MAX_LOTS = 10;
const VALID_SOURCES: AuctionSource[] = ["copart", "iaai", "manheim"];

// 2 batch requests/min per IP — each batch can trigger up to 10 AI chains
const rateLimiter = new RateLimiter(60 * 1000, 2);

interface LotInput {
  lot_number?: string;
  url?: string;
  auction_source: string;
}

interface BatchResultItem {
  lot_index: number;
  lot_number: string | null;
  status: "ok" | "error";
  report?: AuctionEvalReport;
  error?: string;
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many batch requests. Please wait a minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const receiptToken = (body.receipt_token as string) || "";
  if (!receiptToken) {
    return NextResponse.json({ success: false, error: "receipt_token is required" }, { status: 400 });
  }

  const rawLots = body.lots;
  if (!Array.isArray(rawLots) || rawLots.length === 0) {
    return NextResponse.json({ success: false, error: "lots must be a non-empty array" }, { status: 400 });
  }

  if (rawLots.length > MAX_LOTS) {
    return NextResponse.json(
      { success: false, error: `Maximum ${MAX_LOTS} lots per batch request` },
      { status: 400 }
    );
  }

  // Validate each lot entry
  for (let i = 0; i < rawLots.length; i++) {
    const lot = rawLots[i] as LotInput;
    if (!lot.auction_source || !VALID_SOURCES.includes(lot.auction_source as AuctionSource)) {
      return NextResponse.json(
        { success: false, error: `Lot ${i + 1}: invalid auction_source. Valid: ${VALID_SOURCES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!lot.lot_number && !lot.url) {
      return NextResponse.json(
        { success: false, error: `Lot ${i + 1}: either lot_number or url is required` },
        { status: 400 }
      );
    }
  }

  // Run all evaluations in parallel — failures don't abort other lots
  const settled = await Promise.allSettled(
    (rawLots as LotInput[]).map((lot, index) =>
      auctionEvaluationService
        .evaluate({
          url: lot.url,
          lot_number: lot.lot_number,
          auction_source: lot.auction_source as AuctionSource,
          receipt_token: receiptToken,
          user_id: null,
          routine_profile: null,
        })
        .then((report): BatchResultItem => ({
          lot_index: index,
          lot_number: report.lot?.lot_number ?? lot.lot_number ?? null,
          status: "ok",
          report,
        }))
    )
  );

  const results: BatchResultItem[] = settled.map((outcome, index) => {
    const rawLot = rawLots[index] as LotInput;
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }

    const err = outcome.reason;
    let errorMessage = "Evaluation failed";
    if (err instanceof AuctionLotNotFoundError) errorMessage = "Lot not found";
    else if (err instanceof AuctionSourceNotSupportedError) errorMessage = `${err.source} is not yet supported`;
    else if (err instanceof Error) errorMessage = err.message;

    return {
      lot_index: index,
      lot_number: rawLot.lot_number ?? null,
      status: "error",
      error: errorMessage,
    } satisfies BatchResultItem;
  });

  // Sort by OFFO score descending — errors and nulls go to the bottom
  results.sort((a, b) => {
    const scoreA = a.report?.offo_score?.overall_score ?? -1;
    const scoreB = b.report?.offo_score?.overall_score ?? -1;
    return scoreB - scoreA;
  });

  const successCount = results.filter((r) => r.status === "ok").length;

  return NextResponse.json({
    success: true,
    total: rawLots.length,
    succeeded: successCount,
    failed: rawLots.length - successCount,
    results,
  });
}
