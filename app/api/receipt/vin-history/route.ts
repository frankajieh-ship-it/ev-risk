/**
 * POST /api/receipt/vin-history
 *
 * Fetches VIN history for a paid receipt. Returns normalized history data
 * (title status, accident count, theft/salvage flags) via VehicleDatabases.
 *
 * Access gate: receipt must exist and be either:
 *   - generation_status IN ('full', 'paid_full_risk'), OR
 *   - is_pro = true on the receipt row
 *
 * Body: { receipt_id: string, vin: string }
 *
 * Returns: { success, vin_history } | { success: false, error }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getVinHistory } from "@/lib/vin-history-client";

export const maxDuration = 25;

const PAID_STATUSES = new Set(["full", "paid_full_risk"]);

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const receipt_id = (body.receipt_id as string | undefined)?.trim();
  const vin = (body.vin as string | undefined)?.trim().toUpperCase();

  if (!receipt_id) {
    return NextResponse.json({ success: false, error: "receipt_id is required" }, { status: 400 });
  }
  if (!vin || vin.length !== 17) {
    return NextResponse.json({ success: false, error: "A 17-character VIN is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  // Look up receipt and verify paid access
  const { data: receipt, error: dbErr } = await supabase
    .from("receipts")
    .select("id, generation_status, is_pro, session_id")
    .eq("id", receipt_id)
    .maybeSingle();

  if (dbErr || !receipt) {
    return NextResponse.json({ success: false, error: "Receipt not found" }, { status: 404 });
  }

  const isPaid =
    receipt.is_pro === true ||
    PAID_STATUSES.has(receipt.generation_status ?? "");

  if (!isPaid) {
    return NextResponse.json(
      { success: false, error: "VIN history is only available on full reports" },
      { status: 403 }
    );
  }

  const result = await getVinHistory(vin);

  if (!result.success) {
    console.warn(`[vin-history] Failed for receipt ${receipt_id} VIN ${vin}:`, result.error);
    return NextResponse.json({ success: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    vin,
    vin_history: {
      provider: result.provider,
      title_status: result.title_status,
      accident_count: result.accident_count,
      theft_reported: result.theft_reported,
      salvage_reported: result.salvage_reported,
      ownership_count: result.ownership_count,
      open_lien: result.open_lien,
    },
  });
}
