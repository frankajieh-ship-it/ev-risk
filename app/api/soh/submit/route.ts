/**
 * POST /api/soh/submit
 *
 * The mobile PWA calls this after collecting OBD readings.
 * Accepts raw PID values keyed by pid name, computes SOH,
 * writes to battery_scans, and marks the session complete.
 *
 * Request body:
 * {
 *   session_token: string,
 *   dongle_serial?: string,
 *   obd_tool?: string,         // 'obdlink_mx', 'obdlink_cx', 'veepeak', 'leafspy', 'other'
 *   scan_duration_ms?: number,
 *   raw_pids: Record<string, string | number>  // { SOH: "85.5", PackVoltage: "391.2", ... }
 * }
 *
 * Returns the computed battery_scans row on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

interface SubmitBody {
  session_token: string;
  dongle_serial?: string;
  obd_tool?: string;
  scan_duration_ms?: number;
  raw_pids: Record<string, string | number>;
}

function parseNum(v: string | number | undefined): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? null : n;
}

/**
 * Derive SOH from raw PID map, with vehicle-specific logic per profile.
 * Returns null when we can't confidently compute it.
 */
function computeSoh(
  pidProfile: string | null,
  rawPids: Record<string, string | number>
): {
  soh_percent: number | null;
  capacity_kwh: number | null;
  pack_voltage: number | null;
  cell_min_v: number | null;
  cell_max_v: number | null;
  cell_delta_mv: number | null;
  cycle_count: number | null;
} {
  const soh = parseNum(rawPids.SOH ?? rawPids.BMS_SOH ?? rawPids.PackSOH);
  const packV = parseNum(rawPids.PackVoltage);
  const cellMin = parseNum(rawPids.CellVoltMin ?? rawPids.MinCellVolt);
  const cellMax = parseNum(rawPids.CellVoltMax ?? rawPids.MaxCellVolt);
  const cellDelta = parseNum(rawPids.CellVoltDelta);
  const cycleCount = parseNum(rawPids.CycleCount ?? rawPids.ChargeCount);

  // Cell delta in mV — compute from min/max if not provided directly
  const effectiveDelta =
    cellDelta ??
    (cellMin !== null && cellMax !== null ? Math.round((cellMax - cellMin) * 1000) : null);

  // Capacity in kWh — some profiles report Ah, convert using pack voltage
  let capacity_kwh: number | null = null;
  const maxCapAh = parseNum(rawPids.MaxCapacity ?? rawPids.BMS_MaxCapacity);
  const nominalFull = parseNum(rawPids.NominalFull);

  if (nominalFull !== null) {
    // Tesla reports kWh directly
    capacity_kwh = nominalFull;
  } else if (maxCapAh !== null && packV !== null && packV > 0) {
    capacity_kwh = (maxCapAh * packV) / 1000;
  }

  // For profiles where SOH is reported directly by the BMS
  if (soh !== null && soh >= 0 && soh <= 100) {
    return { soh_percent: Math.round(soh * 10) / 10, capacity_kwh, pack_voltage: packV, cell_min_v: cellMin, cell_max_v: cellMax, cell_delta_mv: effectiveDelta, cycle_count: cycleCount };
  }

  // Tesla: derive SOH from nominal capacity fields
  if (pidProfile === "model3y" && nominalFull !== null) {
    // Nominal capacity varies by trim; use pack voltage to pick the closest nominal
    // SR+: ~57.5kWh, LR: ~75kWh, Perf: ~82kWh — we pick the nearest tier
    const nominals = [57.5, 75, 82];
    const nearest = nominals.reduce((a, b) => Math.abs(b - nominalFull) < Math.abs(a - nominalFull) ? b : a);
    const derivedSoh = (nominalFull / nearest) * 100;
    return { soh_percent: Math.round(derivedSoh * 10) / 10, capacity_kwh: nominalFull, pack_voltage: packV, cell_min_v: cellMin, cell_max_v: cellMax, cell_delta_mv: effectiveDelta, cycle_count: cycleCount };
  }

  return { soh_percent: null, capacity_kwh, pack_voltage: packV, cell_min_v: cellMin, cell_max_v: cellMax, cell_delta_mv: effectiveDelta, cycle_count: cycleCount };
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { session_token, dongle_serial, obd_tool, scan_duration_ms, raw_pids } = body;

  if (!session_token) return NextResponse.json({ error: "session_token is required" }, { status: 400 });
  if (!raw_pids || typeof raw_pids !== "object") return NextResponse.json({ error: "raw_pids is required" }, { status: 400 });

  // Look up the session — must be pending/scanning and not expired
  const { data: session, error: sessionError } = await supabase
    .from("soh_scan_sessions")
    .select("id, dealer_id, scanned_by, vin, vehicle_year, vehicle_make, vehicle_model, odometer_miles, pid_profile, status, expires_at")
    .eq("session_token", session_token)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status === "complete") {
    return NextResponse.json({ error: "Session already submitted" }, { status: 409 });
  }
  if (session.status === "failed") {
    return NextResponse.json({ error: "Session has failed" }, { status: 409 });
  }
  if (new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: "Session expired" }, { status: 410 });
  }

  // Mark as processing
  await supabase
    .from("soh_scan_sessions")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", session.id);

  // Compute SOH from raw PIDs
  const computed = computeSoh(session.pid_profile, raw_pids);

  if (computed.soh_percent === null) {
    await supabase
      .from("soh_scan_sessions")
      .update({ status: "failed", error_message: "Could not derive SOH from provided PID values", updated_at: new Date().toISOString() })
      .eq("id", session.id);
    return NextResponse.json({
      error: "Could not compute SOH from provided PID values. Check that the correct OBD profile was used and all required PIDs were read.",
      raw_pids_received: Object.keys(raw_pids),
    }, { status: 422 });
  }

  // Write to battery_scans
  const { data: scan, error: scanError } = await supabase
    .from("battery_scans")
    .insert({
      vin: session.vin,
      dealer_id: session.dealer_id,
      scanned_by: session.scanned_by,
      dongle_serial: dongle_serial ?? null,
      soh_percent: computed.soh_percent,
      capacity_kwh: computed.capacity_kwh,
      cell_min_v: computed.cell_min_v,
      cell_max_v: computed.cell_max_v,
      cell_delta_mv: computed.cell_delta_mv,
      cycle_count: computed.cycle_count,
      odometer_miles: session.odometer_miles,
      vehicle_year: session.vehicle_year,
      vehicle_make: session.vehicle_make,
      vehicle_model: session.vehicle_model,
      obd_tool: obd_tool ?? null,
      pid_profile: session.pid_profile ?? null,
      raw_pids,
      scan_duration_ms: scan_duration_ms ?? null,
      verified: true,
    })
    .select()
    .single();

  if (scanError || !scan) {
    console.error("[soh/submit] battery_scans insert error:", scanError);
    await supabase
      .from("soh_scan_sessions")
      .update({ status: "failed", error_message: "Database write failed", updated_at: new Date().toISOString() })
      .eq("id", session.id);
    return NextResponse.json({ error: "Failed to save scan result" }, { status: 500 });
  }

  // Mark session complete and link the scan
  await supabase
    .from("soh_scan_sessions")
    .update({ status: "complete", battery_scan_id: scan.id, updated_at: new Date().toISOString() })
    .eq("id", session.id);

  return NextResponse.json({
    success: true,
    scan_id: scan.id,
    vin: session.vin,
    soh_percent: computed.soh_percent,
    capacity_kwh: computed.capacity_kwh,
    cell_delta_mv: computed.cell_delta_mv,
    cycle_count: computed.cycle_count,
    vehicle: [session.vehicle_year, session.vehicle_make, session.vehicle_model].filter(Boolean).join(" ") || null,
    badge_active: true,
    message: `SOH scan recorded: ${computed.soh_percent}% for ${session.vin}`,
  });
}
