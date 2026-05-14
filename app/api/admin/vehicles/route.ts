/**
 * GET  /api/admin/vehicles       — list all vehicle profiles (including inactive)
 * POST /api/admin/vehicles       — add a new vehicle (band inference runs server-side)
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

// ---------------------------------------------------------------------------
// Band inference (mirrors scripts/seed-vehicle-profiles.ts logic)
// ---------------------------------------------------------------------------

function inferBands(realRangeMi: number, batteryKwh: number, chemistry: string) {
  const efficiency = realRangeMi / batteryKwh;

  const usable_range_band = realRangeMi < 200 ? "low" : realRangeMi < 300 ? "medium" : "high";
  const dc_fast_band = batteryKwh < 70 ? "slow" : batteryKwh < 90 ? "okay" : "strong";
  const ac_home_charge_band = batteryKwh < 60 ? "strong" : batteryKwh < 85 ? "okay" : "slow";
  const winter_sensitivity_band =
    chemistry === "LFP" ? "mild" : chemistry === "NMC811" ? "strong" : "moderate";
  const efficiency_band = efficiency < 3.0 ? "low" : efficiency < 3.5 ? "medium" : "high";

  return { usable_range_band, dc_fast_band, ac_home_charge_band, winter_sensitivity_band, efficiency_band };
}

// ---------------------------------------------------------------------------
// GET — list all vehicles (admin sees inactive too)
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
// POST — add a single vehicle
// ---------------------------------------------------------------------------

interface AddVehicleBody {
  make: string;
  model: string;
  year: number;
  real_world_range_mi: number;
  epa_range_mi?: number;
  battery_kwh: number;
  chemistry: string;          // LFP | NMC | NMC811
  trim?: string;
  dc_fast_kw?: number;
  connector_types?: string[]; // override; defaults to NACS for Tesla, CCS for others
  is_active?: boolean;
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: AddVehicleBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { make, model, year, real_world_range_mi, battery_kwh, chemistry } = body;
  if (!make || !model || !year || !real_world_range_mi || !battery_kwh || !chemistry) {
    return NextResponse.json(
      { error: "Required: make, model, year, real_world_range_mi, battery_kwh, chemistry" },
      { status: 400 }
    );
  }

  const bands = inferBands(real_world_range_mi, battery_kwh, chemistry);
  const connector_types = body.connector_types ?? (make.toLowerCase() === "tesla" ? ["NACS"] : ["CCS"]);

  const record = {
    make,
    model,
    year,
    trim: body.trim ?? null,
    real_world_range_mi,
    epa_range_mi: body.epa_range_mi ?? null,
    usable_range_mi_estimate: real_world_range_mi,
    battery_kwh,
    chemistry,
    connector_types,
    is_active: body.is_active ?? true,
    data_source: "admin_api",
    ...bands,
  };

  const { data, error } = await supabase
    .from("vehicle_profiles")
    .insert(record)
    .select()
    .single();

  if (error) {
    // Duplicate key — return conflict
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Vehicle already exists: ${year} ${make} ${model}${body.trim ? " " + body.trim : ""}` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, vehicle: data }, { status: 201 });
}
