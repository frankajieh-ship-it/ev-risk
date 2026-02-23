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

const VALID_SCENARIO_TYPES = ["receipt", "evroutine"];

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
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

  const status = await checkPurchaseStatus(scenarioType, scenarioId, anonId);

  const freeMode = isFreeMode();

  return NextResponse.json({
    ...status,
    payments_enabled: freeMode ? false : isPaymentsEnabledFor(anonId),
    free_mode: freeMode,
  });
}
