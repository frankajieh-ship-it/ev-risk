/**
 * Dealer Inquiry Detail API
 * GET   /api/dealer/inquiries/[inquiryId] — Get single inquiry
 * PATCH /api/dealer/inquiries/[inquiryId] — Update status
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ inquiryId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  const { inquiryId } = await context.params;
  const supabase = getSupabaseAdmin()!;

  const { data, error } = await supabase
    .from("inquiries")
    .select("*, inventory_item:dealer_inventory!inventory_item_id(make, model, year)")
    .eq("id", inquiryId)
    .eq("dealership_id", dealershipId)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: "Inquiry not found" }, { status: 404 });
  }

  return NextResponse.json({ inquiry: data });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  const { inquiryId } = await context.params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { status } = body;
  if (!status || !["open", "read", "replied", "closed"].includes(status)) {
    return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin()!;
  const { data, error } = await supabase
    .from("inquiries")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", inquiryId)
    .eq("dealership_id", dealershipId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: error?.message || "Inquiry not found" }, { status: error ? 500 : 404 });
  }

  return NextResponse.json({ success: true, inquiry: data });
}
