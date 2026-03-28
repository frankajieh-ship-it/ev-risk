/**
 * POST /api/auction/save/[resultId]
 *
 * Save an auction analysis result to the authenticated user's garage.
 * Requires Supabase auth JWT in the Authorization header.
 *
 * Body: {}  (no body required — result_id carries the record)
 *
 * Creates or updates a garage_vehicles row linked to the auction_analyses record.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuth } from "@/lib/api-auth";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import type { NormalizedAuctionLot } from "@/lib/auction/types";

export const maxDuration = 15;

const rateLimiter = new RateLimiter(60 * 1000, 20); // 20/min per IP

export async function POST(
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

  // Require authenticated user
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.id;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Service unavailable" }, { status: 503 });
  }

  // Fetch the analysis record
  const { data: row } = await supabase
    .from("auction_analyses")
    .select("id, raw_data, auction_source, lot_number")
    .eq("result_id", resultId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ success: false, error: "Result not found" }, { status: 404 });
  }

  const lot = row.raw_data as NormalizedAuctionLot;

  if (!lot.make || !lot.model) {
    return NextResponse.json(
      { success: false, error: "Vehicle make/model unavailable — cannot save to garage" },
      { status: 422 }
    );
  }

  // Upsert garage_vehicles
  const { error: upsertError } = await supabase.from("garage_vehicles").upsert(
    {
      user_id: userId,
      vin: lot.vin,
      make: lot.make,
      model: lot.model,
      year: lot.year,
      trim: lot.trim,
      source: "auction",
      auction_source: lot.auction_source,
      lot_number: lot.lot_number,
      damage_type: lot.damage_type,
      title_status: lot.title_status,
      auction_analysis_id: row.id,
      auction_result_id: resultId,
    },
    { onConflict: "user_id,vin", ignoreDuplicates: false }
  );

  if (upsertError) {
    console.error("[/api/auction/save] Garage upsert error:", upsertError);
    return NextResponse.json({ success: false, error: "Failed to save to garage" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    saved: true,
    result_id: resultId,
    vehicle: { make: lot.make, model: lot.model, year: lot.year, vin: lot.vin },
  });
}
