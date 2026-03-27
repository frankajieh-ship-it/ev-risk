/**
 * GET /api/dealer/pricing/[vehicleId]
 *
 * Returns pricing intelligence for a specific inventory vehicle.
 * Two-stage engine: deterministic (Stage 1) + LLM summarization (Stage 2).
 * Results cached 24h per vehicle; stale if asking price changes.
 * Protected by dealer_admin or dealer_user role.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";
import {
  computePriceRange,
  buildPriceSensitivityCurve,
  runPricingStage2,
  computeConfidence,
  PRICING_CACHE_TTL_MS,
  type PricingInsight,
} from "@/lib/pricing-engine";

export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  const { vehicleId } = await params;

  const authResult = await requireRole(req, "dealer_admin", "dealer_user");
  if (authResult instanceof NextResponse) return authResult;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const dealershipId = await getDealershipId(authResult.id);
  if (!dealershipId) {
    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
  }

  const { data: vehicle, error: vErr } = await supabase
    .from("dealer_inventory")
    .select("id, make, model, year, trim, price_cents, mileage, status")
    .eq("id", vehicleId)
    .eq("dealership_id", dealershipId)
    .single();

  if (vErr || !vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const askingPriceUsd = vehicle.price_cents ? Math.round(vehicle.price_cents / 100) : null;

  // Cache check
  const { data: cached } = await supabase
    .from("pricing_insights")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("dealership_id", dealershipId)
    .single();

  const cacheAge = cached?.refreshed_at
    ? Date.now() - new Date(cached.refreshed_at).getTime()
    : Infinity;
  const samePrice =
    cached?.asking_price_usd != null &&
    askingPriceUsd != null &&
    cached.asking_price_usd === askingPriceUsd;

  if (cached && cacheAge < PRICING_CACHE_TTL_MS && samePrice && !cached.is_stale) {
    const insight: PricingInsight = {
      vehicle_id: vehicleId,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year ?? null,
      trim: vehicle.trim ?? null,
      asking_price_usd: askingPriceUsd,
      suggested_price_low_usd: cached.suggested_price_low_usd ?? null,
      suggested_price_target_usd: cached.suggested_price_target_usd ?? null,
      suggested_price_high_usd: cached.suggested_price_high_usd ?? null,
      market_position: cached.market_position ?? null,
      market_avg_price_usd: cached.market_avg_price_usd ?? null,
      price_percentile: cached.price_percentile ?? null,
      comp_count: cached.comp_count ?? 0,
      buyer_count: cached.buyer_count ?? 0,
      confidence: cached.confidence ?? null,
      explanation: cached.explanation ?? null,
      price_sensitivity: cached.price_sensitivity ?? null,
      refreshed_at: cached.refreshed_at ?? null,
      refreshing: false,
      cached: true,
    };
    return NextResponse.json(insight);
  }

  if (!askingPriceUsd) {
    return NextResponse.json({
      vehicle_id: vehicleId,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year ?? null,
      trim: vehicle.trim ?? null,
      asking_price_usd: null,
      error: "Vehicle has no price set",
      refreshing: false,
      cached: false,
    });
  }

  // Stage 1
  const stage1StartMs = Date.now();
  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { count: buyerCount } = await supabase
    .from("garage_vehicles")
    .select("id", { count: "exact", head: true })
    .ilike("make", vehicle.make)
    .ilike("model", `%${vehicle.model}%`)
    .gte("created_at", since60d);

  const marketAvg = cached?.market_avg_price_usd ?? askingPriceUsd;
  const compCount = cached?.comp_count ?? 0;
  const stage1 = computePriceRange(askingPriceUsd, marketAvg, compCount);
  const priceSensitivity = buildPriceSensitivityCurve(askingPriceUsd, buyerCount ?? 0);
  const stage1Ms = Date.now() - stage1StartMs;

  // Stage 2
  const { explanation, model_used, latency_ms: stage2Ms } = await runPricingStage2(
    vehicle,
    askingPriceUsd,
    stage1,
    buyerCount ?? 0,
    compCount,
  );

  const confidence = computeConfidence(compCount, buyerCount ?? 0, explanation !== null);
  const now = new Date().toISOString();

  // QA: suppress market_position and suggested range if insufficient data
  const upsertRow = {
    vehicle_id: vehicleId,
    dealership_id: dealershipId,
    asking_price_usd: askingPriceUsd,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year ?? null,
    trim: vehicle.trim ?? null,
    mileage: vehicle.mileage ?? null,
    comp_count: compCount,
    buyer_count: buyerCount ?? 0,
    price_percentile: stage1.insufficientData ? null : stage1.percentile,
    market_avg_price_usd: marketAvg,
    suggested_price_low_usd: stage1.insufficientData ? null : stage1.low,
    suggested_price_target_usd: stage1.insufficientData ? null : stage1.target,
    suggested_price_high_usd: stage1.insufficientData ? null : stage1.high,
    price_sensitivity: priceSensitivity,
    market_position: stage1.insufficientData ? null : stage1.position,
    confidence,
    explanation,
    model_used,
    stage1_ms: stage1Ms,
    stage2_ms: stage2Ms,
    refreshed_at: now,
    is_stale: false,
  };

  await supabase
    .from("pricing_insights")
    .upsert(upsertRow, { onConflict: "vehicle_id,dealership_id" });

  const result: PricingInsight = {
    vehicle_id: vehicleId,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year ?? null,
    trim: vehicle.trim ?? null,
    asking_price_usd: askingPriceUsd,
    suggested_price_low_usd: stage1.insufficientData ? null : stage1.low,
    suggested_price_target_usd: stage1.insufficientData ? null : stage1.target,
    suggested_price_high_usd: stage1.insufficientData ? null : stage1.high,
    market_position: stage1.insufficientData ? null : stage1.position,
    market_avg_price_usd: marketAvg,
    price_percentile: stage1.insufficientData ? null : stage1.percentile,
    comp_count: compCount,
    buyer_count: buyerCount ?? 0,
    confidence,
    explanation,
    price_sensitivity: priceSensitivity,
    refreshed_at: now,
    refreshing: false,
    cached: false,
  };

  return NextResponse.json(result);
}
