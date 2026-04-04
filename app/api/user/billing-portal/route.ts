/**
 * POST /api/user/billing-portal
 *
 * Creates a Stripe Billing Portal session for the authenticated user,
 * returning a redirect URL. The client redirects to that URL so the user
 * can manage their subscription, update payment methods, and view invoices.
 *
 * Requires the user to have a stripe_customer_id in user_roles.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-12-15.clover" })
  : null;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!stripe) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Look up stripe_customer_id from user_roles
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("stripe_customer_id")
    .eq("user_id", auth.id)
    .maybeSingle();

  if (!roleRow?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found for this user." },
      { status: 404 }
    );
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://www.offolab.com";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: roleRow.stripe_customer_id,
    return_url: `${origin}/workspace/settings`,
  });

  return NextResponse.json({ url: portalSession.url });
}
