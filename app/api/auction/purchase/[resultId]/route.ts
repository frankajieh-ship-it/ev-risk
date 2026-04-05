/**
 * POST /api/auction/purchase/[resultId]
 *
 * Initiate a Stripe Checkout session to unlock the paid tier of an
 * auction analysis (arbitrage + repair cost breakdown).
 *
 * Body: { success_url: string; cancel_url: string }
 *
 * Uses the same copart_report pack tier as the legacy /api/checkout route.
 * On payment completion the webhook upgrades is_paid on auction_analyses
 * and sets receipt_token so the result can be fetched with full data.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import Stripe from "stripe";

export const maxDuration = 15;

const rateLimiter = new RateLimiter(60 * 1000, 10); // 10/min per IP

function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-12-15.clover" });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
  const ip = getClientIP(request);
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const { resultId } = await params;
  if (!resultId || !resultId.startsWith("auc_")) {
    return NextResponse.json({ success: false, error: "Invalid result ID" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  const successUrl = (body.success_url as string) || process.env.NEXT_PUBLIC_APP_URL + "/auction/result/" + resultId + "?paid=1";
  const cancelUrl = (body.cancel_url as string) || process.env.NEXT_PUBLIC_APP_URL + "/auction/result/" + resultId;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ success: false, error: "Payment service unavailable" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Service unavailable" }, { status: 503 });
  }

  // Verify result exists
  const { data: row } = await supabase
    .from("auction_analyses")
    .select("id, result_id, is_paid, auction_source, lot_number")
    .eq("result_id", resultId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ success: false, error: "Result not found" }, { status: 404 });
  }

  if (row.is_paid) {
    return NextResponse.json({ success: false, error: "Already purchased" }, { status: 409 });
  }

  const priceId = process.env.STRIPE_COPART_REPORT_PRICE_ID;

  const lineItems: import("stripe").Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          price_data: {
            currency: "usd",
            unit_amount: 4900,
            product_data: {
              name: "OFFO Auction Audit",
              description: "Full auction arbitrage analysis: market value (ARV), repair cost range, max safe bid, confidence rating, and caveats.",
            },
          },
          quantity: 1,
        },
      ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        pack_tier: "copart_report",
        auction_analysis_id: row.id,
        result_id: resultId,
        auction_source: row.auction_source,
        lot_number: row.lot_number,
        anon_id: (body.anon_id as string) || "",
      },
    });

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (err) {
    console.error("[/api/auction/purchase] Stripe error:", err);
    return NextResponse.json({ success: false, error: "Failed to create checkout session" }, { status: 500 });
  }
}
