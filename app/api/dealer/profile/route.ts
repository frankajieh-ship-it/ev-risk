/**
 * Dealer Profile API
 * GET   /api/dealer/profile — Get dealership profile
 * PATCH /api/dealer/profile — Update dealership profile
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
    .from("dealerships")
    .select("*")
    .eq("id", dealershipId)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  return NextResponse.json({ dealership: data });
}

export async function PATCH(req: NextRequest) {
  const user = await requireRole(req, "dealer_admin");
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

  // Only allow updating specific fields (not slug, id, etc.)
  const allowed = ["name", "phone", "website", "description", "address_line1", "city", "state", "zip", "country", "ev_specialties", "logo_url"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
  }

  // Validate name if being updated
  if (updates.name !== undefined && !(updates.name as string)?.trim()) {
    return NextResponse.json({ success: false, error: "Dealership name cannot be empty" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = getSupabaseAdmin()!;
  const { data, error } = await supabase
    .from("dealerships")
    .update(updates)
    .eq("id", dealershipId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, dealership: data });
}
