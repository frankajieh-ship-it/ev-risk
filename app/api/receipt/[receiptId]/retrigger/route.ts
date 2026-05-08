/**
 * POST /api/receipt/[receiptId]/retrigger
 *
 * Admin endpoint to manually re-run the AI upgrade for a stuck 'lite' receipt.
 * Fetches the stored input_json from DB and calls runReceiptUpgrade() directly.
 *
 * Requires x-internal-secret header.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { runReceiptUpgrade } from "@/lib/receipt-upgrade";
import { extractSignalsFromText } from "@/lib/receipt-signal-extractor";
import { classifyVehicle } from "@/lib/vehicle-classifier";
import { scoreReceipt } from "@/lib/receipt-scoring";
import { getFeatureFlags } from "@/lib/feature-flags";
import type { ReceiptGenerateRequest } from "@/types/receipt";

export const maxDuration = 90;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { receiptId } = await params;
  if (!receiptId) {
    return NextResponse.json({ error: "receiptId required" }, { status: 400 });
  }

  // Fetch the stored receipt row
  const { data: row, error: fetchErr } = await supabase
    .from("receipts")
    .select("id, session_id, input_json, generation_status, is_pro")
    .eq("id", receiptId)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  if (row.generation_status === "full") {
    return NextResponse.json({ ok: true, skipped: true, reason: "already full" });
  }

  const input = row.input_json as ReceiptGenerateRequest;
  if (!input) {
    return NextResponse.json({ error: "No input_json stored on receipt" }, { status: 422 });
  }

  // Reconstruct rule signals + scoring from stored input (same as route.ts does on receipt create)
  const ruleClassification = classifyVehicle(
    input.make || "", input.model || "", input.trim, input.listing_text
  );
  const ruleSignals = extractSignalsFromText(
    input.listing_text || null,
    {
      title_status: input.title_status,
      service_history: input.service_history,
      accidents_reported: input.accidents_reported,
      owners: input.owners,
      vin: input.vin,
      carfax_available: input.carfax_available,
      mileage: input.mileage,
      year: input.year,
    },
    ruleClassification
  );
  const ruleScoring = scoreReceipt(ruleSignals);
  const features = await getFeatureFlags(null);

  try {
    await runReceiptUpgrade({
      receipt_id: row.id,
      receipt_token: row.session_id ?? row.id,
      input,
      rule_signals: ruleSignals,
      rule_scoring: ruleScoring,
      features,
      client_ip: "retrigger",
      ip_hash: null,
      is_pro: row.is_pro ?? false,
      t0: Date.now(),
    });
    return NextResponse.json({ ok: true, receipt_id: receiptId });
  } catch (err) {
    console.error("[retrigger] upgrade failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upgrade failed" },
      { status: 500 }
    );
  }
}
