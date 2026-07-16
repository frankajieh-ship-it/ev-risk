/**
 * GET /api/battery-scan/[vin]
 *
 * Returns the most recent verified battery scan for a VIN.
 * Used by the receipt page to show the verified SOH badge.
 * Public endpoint — no auth required (SOH data is not sensitive).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { profileForVin, sohLabel } from "@/lib/obd-pid-profiles";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin: rawVin } = await params;
  const vin = rawVin?.trim().toUpperCase();

  if (!vin || vin.length !== 17 || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return NextResponse.json({ error: "Invalid VIN" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: scan, error } = await supabase
    .from("battery_scans")
    .select(`
      id,
      soh_percent,
      capacity_kwh,
      capacity_nominal_kwh,
      cycle_count,
      cell_delta_mv,
      odometer_miles,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      obd_tool,
      pid_profile,
      scanned_at,
      dealer_id,
      verified
    `)
    .eq("vin", vin)
    .eq("verified", true)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[battery-scan/vin] DB error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!scan) {
    // Return the PID profile so the scanning app knows which profile to use
    const profile = profileForVin(vin);
    return NextResponse.json({
      vin,
      has_scan: false,
      pid_profile: profile.profile,
      profile_supported: profile.supported,
      unsupported_reason: profile.unsupportedReason ?? null,
    });
  }

  const { label: sohQuality, color: sohColor } = sohLabel(Number(scan.soh_percent));

  // Calculate days since scan
  const daysSinceScan = Math.floor(
    (Date.now() - new Date(scan.scanned_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Capacity retention % (measured vs nominal)
  const capacityRetentionPct =
    scan.capacity_kwh && scan.capacity_nominal_kwh && scan.capacity_nominal_kwh > 0
      ? Math.round((Number(scan.capacity_kwh) / Number(scan.capacity_nominal_kwh)) * 100 * 10) / 10
      : null;

  // Cell balance flag — delta > 50mV is worth noting
  const cellBalanceFlag =
    scan.cell_delta_mv !== null && Number(scan.cell_delta_mv) > 50
      ? { flagged: true, delta_mv: scan.cell_delta_mv, message: "Cell imbalance detected — may indicate degraded cells" }
      : null;

  return NextResponse.json({
    vin,
    has_scan: true,
    scan_id: scan.id,
    soh_percent: scan.soh_percent,
    soh_quality: sohQuality,
    soh_color: sohColor,
    capacity_kwh: scan.capacity_kwh,
    capacity_nominal_kwh: scan.capacity_nominal_kwh,
    capacity_retention_pct: capacityRetentionPct,
    cycle_count: scan.cycle_count,
    cell_balance: cellBalanceFlag,
    odometer_miles: scan.odometer_miles,
    vehicle_year: scan.vehicle_year,
    vehicle_make: scan.vehicle_make,
    vehicle_model: scan.vehicle_model,
    pid_profile: scan.pid_profile,
    scanned_at: scan.scanned_at,
    days_since_scan: daysSinceScan,
    dealer_verified: scan.dealer_id !== null,
  });
}
