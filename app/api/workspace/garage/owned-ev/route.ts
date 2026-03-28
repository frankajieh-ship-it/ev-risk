/**
 * POST /api/workspace/garage/owned-ev
 *
 * Marks an existing garage vehicle as an owned EV, or adds + marks a new one by VIN.
 * Sets is_owned_ev = true, owned_since_date, ownership_source.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { validateVin, decodeVin } from "@/lib/vin-service";
import { classifyVehicle } from "@/lib/vehicle-classifier";
import { trackServerEvent } from "@/lib/track-server-event";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { garage_vehicle_id, vin, owned_since_date, ownership_source = "manual" } = body;

  // --- Path A: mark an existing garage vehicle as owned ---
  if (garage_vehicle_id) {
    const { data, error } = await supabase
      .from("garage_vehicles")
      .update({
        is_owned_ev: true,
        owned_since_date: owned_since_date || null,
        ownership_source,
        updated_at: new Date().toISOString(),
      })
      .eq("id", garage_vehicle_id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "Vehicle not found" }, { status: 404 });
    }

    trackServerEvent({
      event_name: "owned_ev_marked",
      source: "garage",
      user_id: user.id,
      entity_type: "garage_vehicle_id",
      entity_id: data.id,
      page_path: "/api/workspace/garage/owned-ev",
      payload: { make: data.make, model: data.model, year: data.year, source: ownership_source },
    });

    return NextResponse.json({ success: true, vehicle: data });
  }

  // --- Path B: add by VIN + mark as owned ---
  if (!vin) {
    return NextResponse.json({ success: false, error: "garage_vehicle_id or vin is required" }, { status: 400 });
  }

  const cleanVin = validateVin(vin);
  if (!cleanVin) {
    return NextResponse.json({ success: false, error: "Invalid VIN format" }, { status: 400 });
  }

  // Check for duplicate VIN for this user
  const { data: existing } = await supabase
    .from("garage_vehicles")
    .select("id, is_owned_ev")
    .eq("user_id", user.id)
    .eq("vin", cleanVin)
    .maybeSingle();

  if (existing) {
    // Already in garage — just mark as owned
    const { data: updated, error } = await supabase
      .from("garage_vehicles")
      .update({
        is_owned_ev: true,
        owned_since_date: owned_since_date || null,
        ownership_source: ownership_source || "vin_scan",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !updated) {
      return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, vehicle: updated, was_existing: true });
  }

  // Decode VIN to populate fields
  const decoded = await decodeVin(cleanVin);
  if (!decoded.success || !decoded.decoded.make || !decoded.decoded.model) {
    return NextResponse.json(
      { success: false, error: "Could not decode VIN — please enter vehicle details manually." },
      { status: 422 }
    );
  }

  const { make, model, year, trim } = decoded.decoded;
  const classification = classifyVehicle(make!, model!, trim ?? undefined);

  const { data, error } = await supabase
    .from("garage_vehicles")
    .insert({
      user_id: user.id,
      vin: cleanVin,
      make,
      model,
      year: year || null,
      trim: trim || null,
      classification,
      is_owned_ev: true,
      owned_since_date: owned_since_date || null,
      ownership_source: ownership_source || "vin_scan",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  trackServerEvent({
    event_name: "owned_ev_marked",
    source: "garage",
    user_id: user.id,
    entity_type: "garage_vehicle_id",
    entity_id: data.id,
    page_path: "/api/workspace/garage/owned-ev",
    payload: { make, model, year, source: ownership_source || "vin_scan" },
  });

  return NextResponse.json({ success: true, vehicle: data, was_existing: false });
}
