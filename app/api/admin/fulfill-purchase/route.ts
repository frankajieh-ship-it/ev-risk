import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-12-15.clover" })
  : null;

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!ADMIN_KEY || auth !== `Bearer ${ADMIN_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { stripe_session_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { stripe_session_id } = body;
  if (!stripe_session_id) {
    return NextResponse.json({ error: "Missing stripe_session_id" }, { status: 400 });
  }

  // Verify the session is actually paid in Stripe before updating DB
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(stripe_session_id);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to retrieve session from Stripe", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Session not paid in Stripe", payment_status: session.payment_status },
      { status: 400 }
    );
  }

  const packTier = session.metadata?.pack_tier || "buyer_pass";

  const { data, error } = await supabase
    .from("purchases")
    .update({
      status: "paid",
      pack_tier: packTier,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", stripe_session_id)
    .eq("status", "pending")
    .select("purchase_id, scenario_type, amount")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Purchase not found or already fulfilled", detail: error?.message },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    purchase_id: data.purchase_id,
    scenario_type: data.scenario_type,
    amount_cents: data.amount,
  });
}
