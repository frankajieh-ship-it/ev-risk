/**
 * POST /api/copart/analyze
 *
 * Source-specific alias for the unified auction evaluation endpoint.
 * Internally calls POST /api/auction/analyze with auction_source: "copart".
 *
 * Accepts the same body shape as /api/auction/analyze but without requiring
 * auction_source (always "copart" from this route).
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import { auctionEvaluationService } from "@/lib/auction/auction-evaluation-service";
import {
  AuctionLotNotFoundError,
  AuctionSourceNotSupportedError,
} from "@/lib/auction/types";

export const maxDuration = 60;

const rateLimiter = new RateLimiter(60 * 1000, 10); // 10/min per IP

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
      }
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
  const receiptToken = (body.receipt_token as string) || "";
  const userId = (body.user_id as string) || null;

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

  try {
    const report = await auctionEvaluationService.evaluate({
      url,
      lot_number: lotNumber,
      auction_source: "copart",
      receipt_token: receiptToken,
      user_id: userId,
      routine_profile: null,
    });

    return NextResponse.json({ success: true, report });
  } catch (err) {
    if (err instanceof AuctionLotNotFoundError) {
      return NextResponse.json(
        { success: false, error: "lot_not_found", message: err.message },
        { status: 404 }
      );
    }

    if (err instanceof AuctionSourceNotSupportedError) {
      // Should not happen for copart, but handle gracefully
      return NextResponse.json(
        { success: false, error: "auction_source_not_supported" },
        { status: 422 }
      );
    }

    console.error("[/api/copart/analyze] Error:", err);
    return NextResponse.json({ success: false, error: "Evaluation failed" }, { status: 500 });
  }
}
