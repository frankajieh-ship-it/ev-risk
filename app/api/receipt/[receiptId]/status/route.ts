/**
 * Receipt Status Polling API
 *
 * GET /api/receipt/{receiptId}/status
 * Returns generation_status and full receipt when ready.
 * Used by client to poll for async AI upgrade completion.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  const { receiptId } = await params;

  if (!receiptId || receiptId.length < 10) {
    return NextResponse.json(
      { success: false, error: "Invalid receipt ID" },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("receipts")
    .select("id, generation_status, output_json, sections")
    .eq("id", receiptId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: "Receipt not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    receipt_id: data.id,
    generation_status: data.generation_status,
    sections: data.sections ?? null,
    // Only send full receipt when upgrade is complete
    receipt: data.generation_status === "full" ? data.output_json : null,
  });
}
