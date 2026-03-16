/**
 * Garage API
 *
 * GET  /api/workspace/garage — list user's garage vehicles
 * POST /api/workspace/garage — add a vehicle (optionally by VIN)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { validateVin, decodeVin } from "@/lib/vin-service";
import { classifyVehicle } from "@/lib/vehicle-classifier";
import { trackServerEvent } from "@/lib/track-server-event";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("garage_vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, vehicles: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const body = await req.json();
  let { vin, make, model, year, trim, nickname, notes, receipt_id } = body;

  // If VIN provided, decode it to populate fields
  if (vin) {
    const cleanVin = validateVin(vin);
    if (!cleanVin) {
      return NextResponse.json(
        { success: false, error: "Invalid VIN format" },
        { status: 400 }
      );
    }
    vin = cleanVin;

    const decoded = await decodeVin(cleanVin);
    if (decoded.success) {
      // Use decoded values, user-provided values take precedence
      make = make || decoded.decoded.make;
      model = model || decoded.decoded.model;
      year = year || decoded.decoded.year;
      trim = trim || decoded.decoded.trim;
    }
  }

  if (!make || !model) {
    return NextResponse.json(
      { success: false, error: "make and model are required" },
      { status: 400 }
    );
  }

  // Classify the vehicle
  const classification = classifyVehicle(make, model, trim);

  const { data, error } = await supabase
    .from("garage_vehicles")
    .insert({
      user_id: user.id,
      vin: vin || null,
      make,
      model,
      year: year || null,
      trim: trim || null,
      nickname: nickname || null,
      classification,
      receipt_id: receipt_id || null,
      notes: notes || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Emit garage_created on first vehicle, shortlist_saved on every add
  const { count: vehicleCount } = await supabase
    .from("garage_vehicles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((vehicleCount ?? 0) === 1) {
    trackServerEvent({
      event_name: "garage_created",
      source: "garage",
      user_id: user.id,
      entity_type: "garage_item_id",
      entity_id: data.id,
      page_path: "/api/workspace/garage",
      payload: { identity_type: "user", make, model, year: year || null },
    });
  }

  trackServerEvent({
    event_name: "shortlist_saved",
    source: "garage",
    user_id: user.id,
    entity_type: "garage_item_id",
    entity_id: data.id,
    page_path: "/api/workspace/garage",
    payload: { make, model, year: year || null, via: "garage_add" },
  });

  return NextResponse.json({ success: true, vehicle: data }, { status: 201 });
}
