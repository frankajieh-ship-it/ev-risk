/**
 * POST /api/workspace/garage/[vehicleId]/owned-ev/purchase-sellers-report
 *
 * Creates a Stripe Checkout session for the $9.99 Sellers Report unlock.
 * Returns the Stripe checkout URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

type Params = { params: Promise<{ vehicleId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { vehicleId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  // 1. Verify user owns this vehicle as an owned EV
  const { data: vehicle } = await supabase
    .from("garage_vehicles")
    .select("id, make, model, year, is_owned_ev")
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .eq("is_owned_ev", true)
    .maybeSingle();

  if (!vehicle) {
    return NextResponse.json(
      { success: false, error: "Owned EV not found." },
      { status: 404 }
    );
  }

  // 2. Check if already unlocked
  const { data: existing } = await supabase
    .from("owned_ev_entitlements")
    .select("id")
    .eq("user_id", user.id)
    .eq("garage_vehicle_id", vehicleId)
    .eq("entitlement_type", "sellers_report_pdf")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: false, error: "Sellers Report already unlocked." }, { status: 409 });
  }

  // 3. Delegate to the checkout endpoint
  const body = await req.json().catch(() => ({}));
  const checkoutRes = await fetch(
    new URL("/api/payments/checkout", req.nextUrl.origin).toString(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
      body: JSON.stringify({
        scenario_type: "owned_ev",
        scenario_id: vehicleId,
        pack_tier: "sellers_report_pdf",
        anon_id: body.anon_id || user.id,
        user_id: user.id,
        page_source: "owned_ev_report",
      }),
    }
  );

  const checkoutData = await checkoutRes.json();

  if (!checkoutRes.ok) {
    return NextResponse.json({ success: false, error: checkoutData.error || "Checkout failed" }, { status: checkoutRes.status });
  }

  return NextResponse.json({ success: true, url: checkoutData.url, session_id: checkoutData.session_id });
}
