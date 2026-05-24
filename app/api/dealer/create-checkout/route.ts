/**
 * POST /api/dealer/create-checkout
 *
 * Creates a Stripe Checkout Session for the dealer monthly subscription.
 * Returns { url } — the client redirects to it.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-12-15.clover" })
  : null;

export async function POST(req: NextRequest) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  }

  const priceId = process.env.STRIPE_PRICE_DEALER_MONTHLY;
  if (!priceId) {
    return NextResponse.json({ error: "Dealer subscription price not configured" }, { status: 501 });
  }

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ error: "No dealership found for this account" }, { status: 400 });
  }

  // Fetch dealership to get existing stripe_customer_id and contact email
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: dealership } = await supabase
    .from("dealerships")
    .select("id, name, stripe_customer_id, contact_email")
    .eq("id", dealershipId)
    .single();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NETLIFY_URL ?? "https://offolab.com";

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { dealership_id: dealershipId },
    success_url: `${baseUrl}/dealer?subscribed=true`,
    cancel_url: `${baseUrl}/dealer`,
  };

  // Re-use existing Stripe customer if we have one, otherwise prefill email
  if (dealership?.stripe_customer_id) {
    sessionParams.customer = dealership.stripe_customer_id;
  } else {
    const email = dealership?.contact_email ?? user.email ?? undefined;
    if (email) sessionParams.customer_email = email;
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[create-checkout] Stripe error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
