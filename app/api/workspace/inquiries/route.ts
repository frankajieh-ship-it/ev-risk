/**
 * Buyer Inquiries API
 *
 * GET  /api/workspace/inquiries — list buyer's inquiries
 * POST /api/workspace/inquiries — create a new inquiry to a dealer
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { sendLeadNotification } from "@/lib/crm-email";

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
    receipt_id,
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
      receipt_id: receipt_id || null,
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

  // Notify dealer of new inquiry via CRM pipeline (fire-and-forget)
  void (async () => {
    try {
      if (!isResendConfigured()) return;

      // Get buyer display name
      const { data: buyerData } = await supabase.auth.admin.getUserById(user.id);
      const buyerName = buyerData?.user?.user_metadata?.full_name
        || buyerData?.user?.email
        || "A buyer";

      // Get dealer contact email: prefer dealerships.contact_email, fall back to admin member email
      const { data: dealershipRow } = await supabase
        .from("dealerships")
        .select("name, contact_email")
        .eq("id", dealership_id)
        .maybeSingle();

      let dealerEmail = dealershipRow?.contact_email ?? null;
      if (!dealerEmail) {
        const { data: memberRow } = await supabase
          .from("dealer_members")
          .select("user_id")
          .eq("dealership_id", dealership_id)
          .eq("role", "dealer_admin")
          .limit(1)
          .maybeSingle();
        if (memberRow?.user_id) {
          const { data: adminData } = await supabase.auth.admin.getUserById(memberRow.user_id);
          dealerEmail = adminData?.user?.email ?? null;
        }
      }

      if (!dealerEmail) return;

      // Get vehicle label if inquiry is tied to an inventory item
      let vehicleLabel = subject;
      if (inquiry.inventory_item_id) {
        const { data: item } = await supabase
          .from("dealer_inventory")
          .select("year, make, model")
          .eq("id", inquiry.inventory_item_id)
          .maybeSingle();
        if (item) vehicleLabel = `${item.year ?? ""} ${item.make} ${item.model}`.trim();
      }

      await sendLeadNotification({
        dealerEmail,
        dealerName: dealershipRow?.name ?? "Your dealership",
        buyerName,
        vehicleLabel,
        message,
        inquiryType: inquiry_type,
        inquiryId: inquiry.id,
      });
    } catch {
      // Best-effort — never block the response
    }
  })();

  return NextResponse.json(
    { success: true, inquiry },
    { status: 201 }
  );
}
