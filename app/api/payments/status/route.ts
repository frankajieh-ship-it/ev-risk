/**
 * OFFO Decision Pack — Payment Status Endpoint
 *
 * GET /api/payments/status?scenario_type=...&scenario_id=...&anon_id=...
 *
 * Returns purchase status, compare credit state, and entitlement info.
 * Only returns data if anon_id matches the purchase owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { checkPurchaseStatus } from "@/lib/payment-status";
import { isPaymentsEnabledFor, isFreeMode } from "@/lib/rollout-flags";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { hashIP } from "@/lib/server-session-utils";

const VALID_SCENARIO_TYPES = ["receipt", "evroutine", "routine", "compare", "chat"];

const statusRateLimiter = new RateLimiter(60 * 1000, 60); // 60/min per IP

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const ip = getClientIP(request);
  if (!statusRateLimiter.check(ip).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  const scenarioType = params.get("scenario_type");
  const scenarioId = params.get("scenario_id");
  const anonId = params.get("anon_id");

  if (!scenarioType || !VALID_SCENARIO_TYPES.includes(scenarioType)) {
    return NextResponse.json({ error: "Invalid scenario_type" }, { status: 400 });
  }
  if (!scenarioId) {
    return NextResponse.json({ error: "Missing scenario_id" }, { status: 400 });
  }
  if (!anonId || anonId.length < 5) {
    return NextResponse.json({ error: "Missing or invalid anon_id" }, { status: 400 });
  }

  // On localhost (NODE_ENV=development) treat every session as fully unlocked
  if (process.env.NODE_ENV === "development") {
    return NextResponse.json({
      purchase_status: "paid",
      unlocked_base: true,
      payments_enabled: false,
      free_mode: true,
      entitlement_level: "buyer_pass",
      seller_pack_unlocked: true,
      compare_remaining: 99,
      compare_bound_to: null,
      purchase_id: null,
      pack_tier: "buyer_pass",
    });
  }

  const ipHash = hashIP(ip) ?? undefined;
  const serverSessionId = request.cookies.get("receipt_session")?.value;
  const status = await checkPurchaseStatus(scenarioType, scenarioId, anonId, ipHash, serverSessionId);

  const freeMode = isFreeMode();

  return NextResponse.json({
    ...status,
    payments_enabled: freeMode ? false : isPaymentsEnabledFor(anonId),
    free_mode: freeMode,
  });
}
