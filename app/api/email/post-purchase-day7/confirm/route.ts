/**
 * POST-PURCHASE DAY 7 — CONFIRM PURCHASE
 *
 * GET /api/email/post-purchase-day7/confirm?token={base64url}
 *
 * Called when a user clicks "Yes, I bought it" in the Day 7 email.
 * Decodes the token, marks the garage vehicle as owned, and redirects
 * to the owned-EV page. If no garage vehicle is linked, redirects to
 * the garage home so the user can add it manually.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(`${SITE_URL}/workspace/garage`);
  }

  let userId: string | null = null;
  let garageVehicleId: string | null = null;

  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
    userId = decoded?.userId ?? null;
    garageVehicleId = decoded?.garageVehicleId ?? null;
  } catch {
    return NextResponse.redirect(`${SITE_URL}/workspace/garage`);
  }

  if (!userId) {
    return NextResponse.redirect(`${SITE_URL}/workspace/garage`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.redirect(`${SITE_URL}/workspace/garage`);
  }

  if (garageVehicleId) {
    const now = new Date().toISOString();
    await supabase
      .from("garage_vehicles")
      .update({
        is_owned_ev: true,
        outcome: "purchased",
        purchased_at: now,
        updated_at: now,
      })
      .eq("id", garageVehicleId)
      .eq("user_id", userId)
      .eq("is_owned_ev", false);

    return NextResponse.redirect(`${SITE_URL}/workspace/garage/${garageVehicleId}/owned-ev?src=day7_confirm`);
  }

  // No garage vehicle linked — send to garage home to add manually
  return NextResponse.redirect(`${SITE_URL}/workspace/garage?src=day7_confirm`);
}
