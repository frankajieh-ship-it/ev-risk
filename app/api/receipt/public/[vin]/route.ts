/**
 * GET /api/receipt/public/[vin]
 *
 * No-auth public endpoint returning a public-safe receipt summary for a VIN.
 * Used by the /vin/[vin] ISR landing page.
 *
 * Returns only non-sensitive fields:
 *   vehicle_year, vehicle_make, vehicle_model, verdict, mileage,
 *   title_status, receipt_id, created_at
 *
 * Returns 404 if no receipt exists for this VIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 10;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;

  if (!vin || vin.length !== 17 || !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
    return NextResponse.json({ error: "Invalid VIN" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("receipts")
    .select("id, vin, created_at, output_json")
    .eq("vin", vin.toUpperCase())
    .not("output_json", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const output = data.output_json as Record<string, unknown> | null;
  if (!output) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    receipt_id: data.id as string,
    vin: data.vin as string,
    created_at: data.created_at as string,
    vehicle_year: (output.year as number | null) ?? null,
    vehicle_make: (output.make as string | null) ?? null,
    vehicle_model: (output.model as string | null) ?? null,
    verdict: (output.verdict as string | null) ?? null,
    mileage: (output.mileage as number | null) ?? null,
    title_status: (output.title_status as string | null) ?? null,
  });
}
