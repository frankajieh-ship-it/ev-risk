/**
 * POST /api/battery-scan/submit
 *
 * Receives a dealer OBD battery scan from the OFFO scanning PWA.
 * Authenticated via dealer session token (Authorization: Bearer <token>)
 * OR via ADMIN_API_KEY for direct/test submissions.
 *
 * Stores in battery_scans table. Any subsequent OFFO report on the same
 * VIN will automatically include the verified SOH badge.
 *
 * Body:
 * {
 *   vin: string                    // 17-char VIN
 *   soh_percent: number            // 0-100
 *   capacity_kwh?: number          // measured full charge capacity
 *   capacity_nominal_kwh?: number  // factory spec
 *   cycle_count?: number
 *   cell_voltages?: number[]       // per-cell voltage array
 *   cell_min_v?: number
 *   cell_max_v?: number
 *   odometer_miles?: number
 *   vehicle_year?: number
 *   vehicle_make?: string
 *   vehicle_model?: string
 *   obd_tool?: string              // 'obdlink_mx' | 'veepeak' | 'carscanner' | 'leafspy' | 'other'
 *   pid_profile?: string           // 'bolt' | 'leaf' | 'ioniq5_ev6' | 'id4' | 'generic'
 *   raw_pids?: Record<string,string>
 *   scan_duration_ms?: number
 *   dongle_serial?: string
 *   notes?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getUserFromRequest } from "@/lib/api-auth";
import { profileForVin, sohLabel } from "@/lib/obd-pid-profiles";

const VALID_OBD_TOOLS = ["obdlink_mx", "veepeak", "carscanner", "leafspy", "other"];
const VALID_PID_PROFILES = ["bolt", "leaf", "ioniq5_ev6", "ioniq6", "id4", "generic"];

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // Auth: dealer session OR admin key
  const adminKey = process.env.ADMIN_API_KEY;
  const authHeader = request.headers.get("authorization") ?? "";
  let dealerId: string | null = null;
  let scannedBy: string | null = null;

  if (adminKey && authHeader === `Bearer ${adminKey}`) {
    // Admin submission — no dealer context required
  } else {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (user.role !== "dealer_admin" && user.role !== "dealer_user") {
      return NextResponse.json({ error: "Dealer account required" }, { status: 403 });
    }
    scannedBy = user.id;
    dealerId = user.dealerId;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Validate VIN ───────────────────────────────────────────────────────────
  const vin = typeof body.vin === "string" ? body.vin.trim().toUpperCase() : "";
  if (!vin || vin.length !== 17 || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return NextResponse.json({ error: "vin must be a valid 17-character VIN" }, { status: 400 });
  }

  // ── Validate SOH ──────────────────────────────────────────────────────────
  const sohPercent = typeof body.soh_percent === "number" ? body.soh_percent : NaN;
  if (isNaN(sohPercent) || sohPercent < 0 || sohPercent > 100) {
    return NextResponse.json({ error: "soh_percent must be a number between 0 and 100" }, { status: 400 });
  }

  // ── Optional fields ───────────────────────────────────────────────────────
  const capacityKwh = typeof body.capacity_kwh === "number" && body.capacity_kwh > 0
    ? body.capacity_kwh : null;
  const capacityNominalKwh = typeof body.capacity_nominal_kwh === "number" && body.capacity_nominal_kwh > 0
    ? body.capacity_nominal_kwh : null;
  const cycleCount = typeof body.cycle_count === "number" && body.cycle_count >= 0
    ? Math.round(body.cycle_count) : null;
  const cellVoltages = Array.isArray(body.cell_voltages) ? body.cell_voltages : null;
  const cellMinV = typeof body.cell_min_v === "number" ? body.cell_min_v : null;
  const cellMaxV = typeof body.cell_max_v === "number" ? body.cell_max_v : null;
  const cellDeltaMv = cellMinV !== null && cellMaxV !== null
    ? Math.round((cellMaxV - cellMinV) * 1000 * 10) / 10 : null;
  const odometerMiles = typeof body.odometer_miles === "number" && body.odometer_miles >= 0
    ? Math.round(body.odometer_miles) : null;
  const vehicleYear = typeof body.vehicle_year === "number"
    && body.vehicle_year >= 2010 && body.vehicle_year <= new Date().getFullYear() + 1
    ? body.vehicle_year : null;
  const vehicleMake = typeof body.vehicle_make === "string" ? body.vehicle_make.trim() : null;
  const vehicleModel = typeof body.vehicle_model === "string" ? body.vehicle_model.trim() : null;
  const obdTool = typeof body.obd_tool === "string" && VALID_OBD_TOOLS.includes(body.obd_tool)
    ? body.obd_tool : null;
  const pidProfile = typeof body.pid_profile === "string" && VALID_PID_PROFILES.includes(body.pid_profile)
    ? body.pid_profile
    : profileForVin(vin).profile;
  const rawPids = body.raw_pids && typeof body.raw_pids === "object" ? body.raw_pids : null;
  const scanDurationMs = typeof body.scan_duration_ms === "number" ? Math.round(body.scan_duration_ms) : null;
  const dongleSerial = typeof body.dongle_serial === "string" ? body.dongle_serial.trim() : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;

  // ── Insert ────────────────────────────────────────────────────────────────
  const { data: scan, error } = await supabase
    .from("battery_scans")
    .insert({
      vin,
      dealer_id: dealerId,
      scanned_by: scannedBy,
      dongle_serial: dongleSerial,
      soh_percent: sohPercent,
      capacity_kwh: capacityKwh,
      capacity_nominal_kwh: capacityNominalKwh,
      cycle_count: cycleCount,
      cell_voltages: cellVoltages,
      cell_min_v: cellMinV,
      cell_max_v: cellMaxV,
      cell_delta_mv: cellDeltaMv,
      odometer_miles: odometerMiles,
      vehicle_year: vehicleYear,
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      obd_tool: obdTool,
      pid_profile: pidProfile,
      raw_pids: rawPids,
      scan_duration_ms: scanDurationMs,
      notes,
      verified: true,
    })
    .select("id, scanned_at")
    .single();

  if (error) {
    console.error("[battery-scan/submit] DB error:", error);
    return NextResponse.json({ error: "Failed to save scan" }, { status: 500 });
  }

  // ── Enrich any existing pending receipts for this VIN ─────────────────────
  // If a buyer already has a receipt for this VIN, update it with the fresh SOH data
  const { data: matchingReceipts } = await supabase
    .from("receipts")
    .select("id")
    .eq("vin", vin)
    .is("battery_scan_id", null)
    .limit(20);

  if (matchingReceipts && matchingReceipts.length > 0) {
    await supabase
      .from("receipts")
      .update({ battery_scan_id: scan.id })
      .in("id", matchingReceipts.map((r: { id: string }) => r.id));

    console.log(`[battery-scan/submit] Linked scan ${scan.id} to ${matchingReceipts.length} existing receipt(s) for VIN ${vin}`);
  }

  const { label: sohQuality, color: sohColor } = sohLabel(sohPercent);

  console.log(`[battery-scan/submit] VIN ${vin} — SOH ${sohPercent}% (${sohQuality}) — scan ${scan.id}`);

  return NextResponse.json({
    ok: true,
    scan_id: scan.id,
    vin,
    soh_percent: sohPercent,
    soh_quality: sohQuality,
    soh_color: sohColor,
    scanned_at: scan.scanned_at,
    receipts_updated: matchingReceipts?.length ?? 0,
  });
}
