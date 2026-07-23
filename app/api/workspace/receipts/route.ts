/**
 * GET /api/workspace/receipts
 *
 * Returns all paid receipt reports for the authenticated user,
 * joined with receipt output data so the UI can show vehicle details.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("purchases")
    .select("purchase_id, created_at, amount, pack_tier, base_scenario_id, anon_id")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .in("scenario_type", ["receipt", "receipt_single", "buyer_pass"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!data?.length) {
    return NextResponse.json({ success: true, reports: [] });
  }

  // Also look up by anon_id for purchases not yet backfilled with user_id
  const receiptIds = data.map((p) => p.base_scenario_id).filter(Boolean);

  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, listing_url, output_json, created_at, vin")
    .in("id", receiptIds);

  const receiptMap = new Map((receipts ?? []).map((r) => [r.id, r]));

  const reports = data.map((purchase) => {
    const receipt = receiptMap.get(purchase.base_scenario_id);
    const out = (receipt?.output_json ?? {}) as {
      listing_summary?: { make?: string; model?: string; year?: number; price?: number; mileage?: number };
      verdict?: string;
    };
    const summary = out.listing_summary ?? {};
    return {
      purchase_id: purchase.purchase_id,
      receipt_id: purchase.base_scenario_id,
      purchased_at: purchase.created_at,
      amount: purchase.amount,
      pack_tier: purchase.pack_tier,
      listing_url: receipt?.listing_url ?? null,
      vin: receipt?.vin ?? null,
      make: summary.make ?? null,
      model: summary.model ?? null,
      year: summary.year ?? null,
      price: summary.price ?? null,
      mileage: summary.mileage ?? null,
      verdict: out.verdict ?? null,
    };
  });

  return NextResponse.json({ success: true, reports });
}
