/**
 * Dealer Inquiry Messages API
 * GET  /api/dealer/inquiries/[inquiryId]/messages — List messages
 * POST /api/dealer/inquiries/[inquiryId]/messages — Send reply
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ inquiryId: string }> };

/** Verify the inquiry belongs to the dealer's dealership */
async function verifyInquiryOwnership(inquiryId: string, dealershipId: string) {
  const supabase = getSupabaseAdmin()!;
  const { data } = await supabase
    .from("inquiries")
    .select("id")
    .eq("id", inquiryId)
    .eq("dealership_id", dealershipId)
    .single();
  return !!data;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  const { inquiryId } = await context.params;

  if (!(await verifyInquiryOwnership(inquiryId, dealershipId))) {
    return NextResponse.json({ success: false, error: "Inquiry not found" }, { status: 404 });
  }

  const supabase = getSupabaseAdmin()!;
  const { data, error } = await supabase
    .from("inquiry_messages")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  const { inquiryId } = await context.params;

  if (!(await verifyInquiryOwnership(inquiryId, dealershipId))) {
    return NextResponse.json({ success: false, error: "Inquiry not found" }, { status: 404 });
  }

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin()!;

  // Insert message
  const { data, error } = await supabase
    .from("inquiry_messages")
    .insert({
      inquiry_id: inquiryId,
      sender_user_id: user.id,
      sender_role: "dealer",
      message: body.message.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Update inquiry status to replied
  await supabase
    .from("inquiries")
    .update({ status: "replied", updated_at: new Date().toISOString() })
    .eq("id", inquiryId);

  return NextResponse.json({ success: true, message: data }, { status: 201 });
}
