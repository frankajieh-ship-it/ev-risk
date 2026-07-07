/**
 * GET /api/user/referral-credits
 *
 * Returns the total unspent referral credits for the authenticated user.
 * Requires Authorization: Bearer <token> header.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ credits: 0, authenticated: false });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ credits: 0, authenticated: true });
  }

  const { data, error } = await supabase
    .from("referral_credits")
    .select("credit_amount")
    .eq("referrer_user_id", user.id);

  if (error) {
    return NextResponse.json({ credits: 0, authenticated: true });
  }

  const total = (data ?? []).reduce((sum, row) => sum + (row.credit_amount ?? 0), 0);

  return NextResponse.json({ credits: total, authenticated: true });
}
