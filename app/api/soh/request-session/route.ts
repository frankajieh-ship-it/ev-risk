/**
 * POST /api/soh/request-session
 *
 * Dealer calls this before scanning a vehicle.  Returns a session token
 * that the mobile PWA uses to POST raw PID readings to /api/soh/submit.
 *
 * Also returns the correct PID profile for the VIN's make/model so the
 * PWA knows which OBD commands to send.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getUserFromRequest } from "@/lib/api-auth";

interface RequestBody {
  vin: string;
  dealer_id: string;
  vehicle_year?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_trim?: string;
  odometer_miles?: number;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // Auth: must be a signed-in dealer member
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { vin, dealer_id, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, odometer_miles } = body;

  if (!vin || !dealer_id) {
    return NextResponse.json({ error: "vin and dealer_id are required" }, { status: 400 });
  }

  const cleanVin = vin.toUpperCase().trim();
  if (cleanVin.length !== 17) {
    return NextResponse.json({ error: "VIN must be 17 characters" }, { status: 400 });
  }

  // Verify caller is a member of the claimed dealership
  const { data: membership } = await supabase
    .from("dealer_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("dealership_id", dealer_id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this dealership" }, { status: 403 });
  }

  // Resolve PID profile from make/model/year if we have it
  let pidProfile: string | null = null;
  if (vehicle_make && vehicle_model && vehicle_year) {
    const { data: pidMap } = await supabase
      .from("soh_pid_maps")
      .select("pid_profile, pids, soh_field, soh_formula, protocol")
      .ilike("make", vehicle_make)
      .ilike("model", vehicle_model)
      .lte("year_min", vehicle_year)
      .gte("year_max", vehicle_year)
      .single();

    if (pidMap) {
      pidProfile = pidMap.pid_profile;
    }
  }

  // Create the scan session
  const { data: session, error } = await supabase
    .from("soh_scan_sessions")
    .insert({
      dealer_id,
      scanned_by: user.id,
      vin: cleanVin,
      vehicle_year: vehicle_year ?? null,
      vehicle_make: vehicle_make ?? null,
      vehicle_model: vehicle_model ?? null,
      vehicle_trim: vehicle_trim ?? null,
      odometer_miles: odometer_miles ?? null,
      pid_profile: pidProfile,
      status: "pending",
    })
    .select("id, session_token, pid_profile, expires_at")
    .single();

  if (error || !session) {
    console.error("[soh/request-session] Insert error:", error);
    return NextResponse.json({ error: "Failed to create scan session" }, { status: 500 });
  }

  // Fetch the full PID map to return to the PWA
  let pidMap = null;
  if (session.pid_profile) {
    const { data } = await supabase
      .from("soh_pid_maps")
      .select("pid_profile, pids, soh_field, soh_formula, protocol")
      .eq("pid_profile", session.pid_profile)
      .single();
    pidMap = data;
  }

  return NextResponse.json({
    session_id: session.id,
    session_token: session.session_token,
    expires_at: session.expires_at,
    pid_profile: session.pid_profile,
    pid_map: pidMap,
    vin: cleanVin,
  });
}
