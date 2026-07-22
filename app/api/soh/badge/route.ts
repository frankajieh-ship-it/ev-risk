/**
 * GET /api/soh/badge?vin=1HGBH41JXMN109186
 *
 * Returns the most recent verified dealer SOH scan for a VIN.
 * Used by the receipt page to show the "Dealer SOH Verified" badge.
 *
 * Returns null when no verified scan exists — receipts treat this as unverified.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const vin = searchParams.get("vin")?.toUpperCase().trim();

  if (!vin || vin.length !== 17) {
    return NextResponse.json({ error: "A valid 17-character VIN is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("battery_scans")
    .select(`
      id,
      soh_percent,
      capacity_kwh,
      cell_delta_mv,
      cycle_count,
      odometer_miles,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      obd_tool,
      scanned_at,
      dealer_id,
      dealerships ( name, slug, city, state )
    `)
    .eq("vin", vin)
    .eq("verified", true)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ verified: false, badge: null });
  }

  const dealership = Array.isArray(data.dealerships)
    ? data.dealerships[0]
    : data.dealerships;

  return NextResponse.json({
    verified: true,
    badge: {
      scan_id: data.id,
      soh_percent: data.soh_percent,
      capacity_kwh: data.capacity_kwh,
      cell_delta_mv: data.cell_delta_mv,
      cycle_count: data.cycle_count,
      odometer_miles: data.odometer_miles,
      vehicle: [data.vehicle_year, data.vehicle_make, data.vehicle_model].filter(Boolean).join(" ") || null,
      scanned_at: data.scanned_at,
      dealer: dealership ? {
        name: dealership.name,
        slug: dealership.slug,
        location: [dealership.city, dealership.state].filter(Boolean).join(", ") || null,
      } : null,
    },
  });
}
