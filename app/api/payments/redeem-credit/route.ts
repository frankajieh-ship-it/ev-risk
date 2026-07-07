/**
 * POST /api/payments/redeem-credit
 *
 * Redeems one referral credit to unlock a receipt starter report.
 * Requires an authenticated session (referral credits are user-scoped).
 *
 * Body: { scenario_id: string, anon_id: string }
 * Returns: { success: true } or { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let scenarioId: string | undefined;
  let anonId: string | undefined;
  try {
    const body = await request.json();
    scenarioId = body.scenario_id;
    anonId = body.anon_id;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!scenarioId || !anonId) {
    return NextResponse.json({ error: "scenario_id and anon_id required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Check available unspent credits
  const { data: credits, error: creditsErr } = await supabase
    .from("referral_credits")
    .select("id, credit_amount, redeemed_at")
    .eq("referrer_user_id", user.id)
    .is("redeemed_at", null)
    .order("awarded_at", { ascending: true })
    .limit(1);

  if (creditsErr) {
    return NextResponse.json({ error: "Failed to check credits" }, { status: 500 });
  }

  if (!credits || credits.length === 0) {
    return NextResponse.json({ error: "No credits available" }, { status: 400 });
  }

  const credit = credits[0];

  // Check receipt isn't already unlocked (idempotency)
  const { data: existing } = await supabase
    .from("purchases")
    .select("purchase_id, status")
    .eq("base_scenario_id", scenarioId)
    .eq("scenario_type", "receipt")
    .eq("status", "paid")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Receipt already unlocked" }, { status: 409 });
  }

  // Create a $0 purchase record — same shape as a real purchase, signals unlock to checkPurchaseStatus
  const { error: purchaseErr } = await supabase.from("purchases").insert({
    user_id: user.id,
    anon_id: anonId,
    base_scenario_id: scenarioId,
    scenario_type: "receipt",
    pack_tier: "receipt_single",
    status: "paid",
    amount: 0,
    currency: "usd",
    referral_credit_redeemed: true,
  });

  if (purchaseErr) {
    console.error("[redeem-credit] purchase insert error:", purchaseErr);
    return NextResponse.json({ error: "Failed to redeem credit" }, { status: 500 });
  }

  // Mark credit as redeemed
  await supabase
    .from("referral_credits")
    .update({ redeemed_at: new Date().toISOString(), redeemed_for_scenario_id: scenarioId })
    .eq("id", credit.id);

  return NextResponse.json({ success: true });
}
