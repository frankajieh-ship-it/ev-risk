/**
 * GET   /api/admin/vehicles          — list all vehicle profiles
 * POST  /api/admin/vehicles          — add a new vehicle
 * PATCH /api/admin/vehicles          — update fields on an existing vehicle (by id)
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

function checkAuth(request: NextRequest): boolean {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return !!token && token === ADMIN_KEY;
}

function inferBands(realRangeMi: number, batteryKwh: number, chemistry: string) {
  const efficiency = realRangeMi / batteryKwh;
  return {
    usable_range_band:      realRangeMi < 200 ? "low" : realRangeMi < 300 ? "medium" : "high",
    dc_fast_band:           batteryKwh < 70 ? "slow" : batteryKwh < 90 ? "okay" : "strong",
    ac_home_charge_band:    batteryKwh < 60 ? "strong" : batteryKwh < 85 ? "okay" : "slow",
    winter_sensitivity_band: chemistry === "LFP" ? "mild" : chemistry === "NMC811" ? "strong" : "moderate",
    efficiency_band:        efficiency < 3.0 ? "low" : efficiency < 3.5 ? "medium" : "high",
  };
}

// ---------------------------------------------------------------------------
// GET — list all vehicles
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const activeOnly = request.nextUrl.searchParams.get("active") !== "false";

  let query = supabase
    .from("vehicle_profiles")
    .select("*")
    .order("year", { ascending: false })
    .order("make", { ascending: true })
    .order("model", { ascending: true });

  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, count: data?.length ?? 0, vehicles: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST — add a new vehicle profile
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { make, model, year, real_world_range_mi, battery_kwh, chemistry } = body as Record<string, unknown>;
  if (!make || !model || !year || !real_world_range_mi || !battery_kwh || !chemistry) {
    return NextResponse.json(
      { error: "Required: make, model, year, real_world_range_mi, battery_kwh, chemistry" },
      { status: 400 }
    );
  }

  const bands = inferBands(
    Number(real_world_range_mi),
    Number(battery_kwh),
    String(chemistry)
  );
  const connector_types = (body.connector_types as string[]) ??
    (String(make).toLowerCase() === "tesla" ? ["NACS"] : ["CCS"]);

  const record = {
    make, model, year: Number(year),
    trim: body.trim ?? null,
    real_world_range_mi: Number(real_world_range_mi),
    epa_range_mi: body.epa_range_mi ? Number(body.epa_range_mi) : null,
    usable_range_mi_estimate: Number(real_world_range_mi),
    battery_kwh: Number(battery_kwh),
    chemistry,
    connector_types,
    is_active: body.is_active ?? true,
    data_source: "admin_ui",
    ...bands,
    // Phase 2 spec fields (optional on creation)
    drivetrain:           body.drivetrain ?? null,
    cargo_volume_cuft:    body.cargo_volume_cuft ? Number(body.cargo_volume_cuft) : null,
    charge_time_l2_hours: body.charge_time_l2_hours ? Number(body.charge_time_l2_hours) : null,
    front_legroom_in:     body.front_legroom_in ? Number(body.front_legroom_in) : null,
    rear_legroom_in:      body.rear_legroom_in ? Number(body.rear_legroom_in) : null,
    doors:                body.doors ? Number(body.doors) : null,
    has_ac:               body.has_ac ?? null,
    has_power_windows:    body.has_power_windows ?? null,
    has_power_locks:      body.has_power_locks ?? null,
    has_power_steering:   body.has_power_steering ?? null,
    has_keyless_entry:    body.has_keyless_entry ?? null,
    has_alarm:            body.has_alarm ?? null,
    has_satellite_radio:  body.has_satellite_radio ?? null,
    has_dual_airbags:     body.has_dual_airbags ?? null,
    has_side_airbags:     body.has_side_airbags ?? null,
    has_abs:              body.has_abs ?? null,
    has_tilt_wheel:       body.has_tilt_wheel ?? null,
    has_am_fm_radio:      body.has_am_fm_radio ?? null,
    has_immobilizer:      body.has_immobilizer ?? null,
    has_active_seatbelts: body.has_active_seatbelts ?? null,
    has_passenger_airbag: body.has_passenger_airbag ?? null,
    has_carplay:          body.has_carplay ?? null,
    has_android_auto:     body.has_android_auto ?? null,
    exterior_colors:      body.exterior_colors ?? null,
    interior_colors:      body.interior_colors ?? null,
  };

  const { data, error } = await supabase
    .from("vehicle_profiles")
    .insert(record)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Vehicle already exists: ${year} ${make} ${model}` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, vehicle: data }, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH — update fields on an existing vehicle (partial update)
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // If range/battery/chemistry changed, re-infer bands
  if (fields.real_world_range_mi || fields.battery_kwh || fields.chemistry) {
    const { data: current } = await supabase
      .from("vehicle_profiles")
      .select("real_world_range_mi, battery_kwh, chemistry")
      .eq("id", id)
      .single();

    if (current) {
      const rangeVal = Number(fields.real_world_range_mi ?? current.real_world_range_mi);
      const battVal  = Number(fields.battery_kwh ?? current.battery_kwh);
      const chemVal  = String(fields.chemistry ?? current.chemistry);
      Object.assign(fields, inferBands(rangeVal, battVal, chemVal));
    }
  }

  const { data, error } = await supabase
    .from("vehicle_profiles")
    .update(fields)
    .eq("id", String(id))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, vehicle: data });
}
