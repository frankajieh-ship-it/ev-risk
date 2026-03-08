/**
 * Dealer Inventory Item API
 * GET    /api/dealer/inventory/[itemId] — Get single item
 * PATCH  /api/dealer/inventory/[itemId] — Update item
 * DELETE /api/dealer/inventory/[itemId] — Remove item
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  const { itemId } = await context.params;
  const supabase = getSupabaseAdmin()!;

  const { data, error } = await supabase
    .from("dealer_inventory")
    .select("*")
    .eq("id", itemId)
    .eq("dealership_id", dealershipId)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  const { itemId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Only allow updating specific fields
  const allowed = ["make", "model", "year", "trim", "vin", "price_cents", "mileage", "exterior_color", "status", "photo_urls"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = getSupabaseAdmin()!;
  const { data, error } = await supabase
    .from("dealer_inventory")
    .update(updates)
    .eq("id", itemId)
    .eq("dealership_id", dealershipId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: error?.message || "Item not found" }, { status: error ? 500 : 404 });
  }

  return NextResponse.json({ success: true, item: data });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  const { itemId } = await context.params;
  const supabase = getSupabaseAdmin()!;

  const { error } = await supabase
    .from("dealer_inventory")
    .delete()
    .eq("id", itemId)
    .eq("dealership_id", dealershipId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
