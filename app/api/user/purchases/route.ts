/**
 * GET /api/user/purchases
 *
 * Returns the authenticated user's purchase history, ordered newest-first.
 * Used by workspace settings to show a payment history section.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("purchases")
    .select(
      "purchase_id, created_at, status, scenario_type, amount, currency, stripe_session_id"
    )
    .eq("user_id", auth.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[/api/user/purchases] Supabase error:", error.message);
    return NextResponse.json(
      { success: false, error: "Failed to fetch purchases" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, purchases: data ?? [] });
}
