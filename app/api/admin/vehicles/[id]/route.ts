/**
 * PATCH /api/admin/vehicles/[id]  — update is_active or other fields
 * DELETE /api/admin/vehicles/[id] — permanently remove a vehicle profile
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only allow patching safe fields — never allow changing the PK or data_source
  const allowed = ["is_active", "trim", "usable_range_mi_estimate", "epa_range_mi",
    "real_world_range_mi", "battery_kwh", "chemistry", "connector_types",
    "usable_range_band", "dc_fast_band", "ac_home_charge_band",
    "winter_sensitivity_band", "efficiency_band"];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vehicle_profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  return NextResponse.json({ success: true, vehicle: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { id } = await params;

  const { error } = await supabase.from("vehicle_profiles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
