/**
 * Dealer Inventory API
 * GET  /api/dealer/inventory — List dealership inventory
 * POST /api/dealer/inventory — Add a vehicle to inventory
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  const supabase = getSupabaseAdmin()!;
  const { data, error } = await supabase
    .from("dealer_inventory")
    .select("*")
    .eq("dealership_id", dealershipId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { make, model, year, trim, vin, price_cents, mileage, exterior_color } = body as {
    make?: string; model?: string; year?: number; trim?: string;
    vin?: string; price_cents?: number; mileage?: number; exterior_color?: string;
  };

  if (!make || !model) {
    return NextResponse.json({ success: false, error: "Make and model are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin()!;
  const { data, error } = await supabase
    .from("dealer_inventory")
    .insert({
      dealership_id: dealershipId,
      make, model,
      year: year || null,
      trim: trim || null,
      vin: vin || null,
      price_cents: price_cents || null,
      mileage: mileage || null,
      exterior_color: exterior_color || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, item: data }, { status: 201 });
}
