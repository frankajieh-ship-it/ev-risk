/**
 * Dealer Inquiries API
 * GET /api/dealer/inquiries — List inquiries for dealership
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

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const supabase = getSupabaseAdmin()!;
  let query = supabase
    .from("inquiries")
    .select("*, inventory_item:dealer_inventory!inventory_item_id(make, model, year)")
    .eq("dealership_id", dealershipId)
    .order("created_at", { ascending: false });

  if (status && ["open", "read", "replied", "closed"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Fetch buyer emails for each inquiry
  const buyerIds = [...new Set((data || []).map((i) => i.buyer_user_id))];
  let emailMap: Record<string, string> = {};

  if (buyerIds.length > 0) {
    const emails = await Promise.all(
      buyerIds.map(async (id) => {
        const { data: userData } = await supabase.auth.admin.getUserById(id);
        return { id, email: userData?.user?.email || "" };
      })
    );
    emailMap = Object.fromEntries(emails.map((e) => [e.id, e.email]));
  }

  const inquiries = (data || []).map((inq) => ({
    ...inq,
    buyer_email: emailMap[inq.buyer_user_id] || undefined,
  }));

  return NextResponse.json({ inquiries });
}
