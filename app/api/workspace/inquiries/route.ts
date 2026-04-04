/**
 * Buyer Inquiries API
 *
 * GET  /api/workspace/inquiries — list buyer's inquiries
 * POST /api/workspace/inquiries — create a new inquiry to a dealer
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { sendChecklistEmail, isResendConfigured } from "@/lib/resend";

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

  // Notify dealer of new inquiry (fire-and-forget)
  void (async () => {
    try {
      if (!isResendConfigured()) return;

      // Get buyer email
      const { data: buyerData } = await supabase.auth.admin.getUserById(user.id);
      const buyerEmail = buyerData?.user?.email ?? "a buyer";

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

      const dealerName = dealershipRow?.name ?? "Your dealership";
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.offolab.com";
      const ctaUrl = `${siteUrl}/dealer/inquiries`;

      const html = `
        <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#111827">
          <div style="background:#16a34a;padding:20px 24px;border-radius:12px 12px 0 0">
            <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff">New inquiry on OFFO</p>
          </div>
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
            <p style="margin:0 0 16px;font-size:14px;color:#374151">
              <strong>${buyerEmail}</strong> sent a new inquiry to <strong>${dealerName}</strong>.
            </p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:20px">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Subject</p>
              <p style="margin:0 0 14px;font-size:14px;font-weight:600;color:#111827">${subject}</p>
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Message</p>
              <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap">${message}</p>
            </div>
            <a href="${ctaUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
              View &amp; Reply in OFFO →
            </a>
            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">
              You are receiving this because you have a dealer account on OFFO.
              <a href="${siteUrl}/dealer/profile" style="color:#6b7280">Manage notifications</a>
            </p>
          </div>
        </div>
      `;

      await sendChecklistEmail(dealerEmail, `New inquiry: ${subject}`, html);
    } catch {
      // Best-effort — never block the response
    }
  })();

  return NextResponse.json(
    { success: true, inquiry },
    { status: 201 }
  );
}
