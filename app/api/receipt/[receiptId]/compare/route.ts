/**
 * OFFO Decision Pack — Compare Data Retrieval
 *
 * GET /api/receipt/[receiptId]/compare?anon_id=...
 *
 * Returns both receipts for a bound comparison.
 * Used as server fallback when localStorage history is cleared.
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { receiptId } = await params;
  const url = new URL(req.url);
  const anonId = url.searchParams.get("anon_id");

  if (!anonId || anonId.length < 5) {
    return NextResponse.json({ error: "Missing or invalid anon_id" }, { status: 400 });
  }

  // Find a purchase for this receipt that has a bound compare credit
  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .select("purchase_id, base_scenario_id, compare_scenario_id")
    .eq("base_scenario_id", receiptId)
    .eq("scenario_type", "receipt")
    .eq("anon_id", anonId)
    .eq("status", "paid")
    .not("compare_scenario_id", "is", null)
    .maybeSingle();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "No bound comparison found" }, { status: 404 });
  }

  // Load both receipts
  const { data: baseReceipt } = await supabase
    .from("receipts")
    .select("output_json")
    .eq("id", purchase.base_scenario_id)
    .maybeSingle();

  const { data: compareReceipt } = await supabase
    .from("receipts")
    .select("output_json")
    .eq("id", purchase.compare_scenario_id)
    .maybeSingle();

  if (!baseReceipt?.output_json || !compareReceipt?.output_json) {
    return NextResponse.json({ error: "Receipt data not found" }, { status: 404 });
  }

  return NextResponse.json({
    base_receipt: baseReceipt.output_json,
    compare_receipt: compareReceipt.output_json,
    purchase_id: purchase.purchase_id,
  });
}
