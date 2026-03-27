/**
 * POST /api/internal/pricing/refresh/[vehicleId]
 *
 * Forces a fresh pricing insight computation for a specific vehicle,
 * bypassing the 24h cache. Idempotent — upserts result.
 *
 * Internal server-to-server only (INTERNAL_API_SECRET required).
 * Used by the nightly Netlify refresh function and manual admin triggers.
 *
 * Returns the updated PricingInsight.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import {
  computePriceRange,
  buildPriceSensitivityCurve,
  runPricingStage2,
  computeConfidence,
  type PricingInsight,
} from "@/lib/pricing-engine";

export const maxDuration = 30;

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;
  if (expected && secret === expected) return true;
  const serviceKey = req.headers.get("x-service-role-key");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vehicleId } = await params;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  // Fetch the vehicle (need dealership_id from pricing_insights or inventory)
  const { data: existing } = await supabase
    .from("pricing_insights")
    .select("dealership_id, comp_count, market_avg_price_usd")
    .eq("vehicle_id", vehicleId)
    .single();

  // If no existing row, we still need to find which dealership owns this vehicle
  const { data: vehicle, error: vErr } = await supabase
    .from("dealer_inventory")
    .select("id, make, model, year, trim, price_cents, mileage, dealership_id")
    .eq("id", vehicleId)
    .single();

  if (vErr || !vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const dealershipId = existing?.dealership_id ?? vehicle.dealership_id;
  const askingPriceUsd = vehicle.price_cents ? Math.round(vehicle.price_cents / 100) : null;

  if (!askingPriceUsd) {
    return NextResponse.json({ error: "Vehicle has no price set" }, { status: 400 });
  }

  const stage1StartMs = Date.now();
  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { count: buyerCount } = await supabase
    .from("garage_vehicles")
    .select("id", { count: "exact", head: true })
    .ilike("make", vehicle.make)
    .ilike("model", `%${vehicle.model}%`)
    .gte("created_at", since60d);

  const marketAvg = existing?.market_avg_price_usd ?? askingPriceUsd;
  const compCount = existing?.comp_count ?? 0;

  const stage1 = computePriceRange(askingPriceUsd, marketAvg, compCount);
  const priceSensitivity = buildPriceSensitivityCurve(askingPriceUsd, buyerCount ?? 0);
  const stage1Ms = Date.now() - stage1StartMs;

  const { explanation, model_used, latency_ms: stage2Ms } = await runPricingStage2(
    vehicle,
    askingPriceUsd,
    stage1,
    buyerCount ?? 0,
    compCount,
  );

  const confidence = computeConfidence(compCount, buyerCount ?? 0, explanation !== null);
  const now = new Date().toISOString();

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
