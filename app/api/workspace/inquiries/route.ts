/**
 * Buyer Inquiries API
 *
 * GET  /api/workspace/inquiries — list buyer's inquiries
 * POST /api/workspace/inquiries — create a new inquiry to a dealer
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

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

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("inquiries")
    .select("*, dealerships:dealership_id(name, slug)")
    .eq("buyer_user_id", user.id)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, inquiries: data || [] });
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
  const {
    dealership_id,
    inventory_item_id,
    garage_vehicle_id,
    subject,
    message,
    inquiry_type = "general",
    offo_context,
  } = body;

  if (!dealership_id || !subject || !message) {
    return NextResponse.json(
      { success: false, error: "dealership_id, subject, and message are required" },
      { status: 400 }
    );
  }

  // Verify dealership exists
  const { data: dealer } = await supabase
    .from("dealerships")
    .select("id")
    .eq("id", dealership_id)
    .single();

  if (!dealer) {
    return NextResponse.json(
      { success: false, error: "Dealership not found" },
      { status: 404 }
    );
  }

  // Create inquiry
  const { data: inquiry, error: inquiryError } = await supabase
    .from("inquiries")
    .insert({
      buyer_user_id: user.id,
      dealership_id,
      inventory_item_id: inventory_item_id || null,
      garage_vehicle_id: garage_vehicle_id || null,
      subject,
      message,
      inquiry_type,
      offo_context: offo_context || null,
    })
    .select("*")
    .single();

  if (inquiryError || !inquiry) {
    return NextResponse.json(
      { success: false, error: inquiryError?.message || "Failed to create inquiry" },
      { status: 500 }
    );
  }

  // Create the initial message in the thread
  await supabase.from("inquiry_messages").insert({
    inquiry_id: inquiry.id,
    sender_user_id: user.id,
    sender_role: "buyer",
    message,
  });

  return NextResponse.json(
    { success: true, inquiry },
    { status: 201 }
  );
}
