/**
 * EV-Risk™ Stripe Checkout API Route (MVP-Ready)
 *
 * POST /api/checkout
 * Creates Stripe checkout session for $15 full report purchase
 *
 * Implementation follows Stripe best practices:
 * - One-time payment mode (not subscription)
 * - Webhook-based fulfillment (not redirect-based)
 * - Client reference ID for tracking
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Initialize Stripe with current API version
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia", // Current stable version
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        {
          error: "Stripe not configured",
          instructions: [
            "1. Create Stripe account at stripe.com",
            "2. Get your API keys from Dashboard → Developers → API keys",
            "3. Add STRIPE_SECRET_KEY to .env.local",
            "4. Add STRIPE_WEBHOOK_SECRET after configuring webhook",
            "5. Restart dev server",
          ],
        },
        { status: 501 }
      );
    }

    const body = await request.json();
    const { reportId } = body;

    if (!reportId) {
      return NextResponse.json(
        { error: "Missing reportId - create draft report first" },
        { status: 400 }
      );
    }

    // Get origin for redirect URLs
    const origin = request.headers.get("origin") ?? "http://localhost:3002";

    // Create Stripe Checkout Session
    // Docs: https://stripe.com/docs/api/checkout/sessions/create
    const session = await stripe.checkout.sessions.create({
      mode: "payment", // One-time payment (not subscription)
      client_reference_id: reportId, // Link to database record
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 1500, // $15.00 in cents
            product_data: {
              name: "EV-Risk™ Full Report + Negotiation Tools",
              description:
                "Complete used EV risk analysis with negotiation script, inspection checklist, and TCO estimate",
              images: [], // TODO: Add product image URL
            },
          },
          quantity: 1,
        },
      ],
      // Success: redirect to report page (loads from database)
      success_url: `${origin}/report/${reportId}?paid=true&session_id={CHECKOUT_SESSION_ID}`,
      // Cancel: return to report page
      cancel_url: `${origin}/report/${reportId}?canceled=true`,
      // Store metadata for webhook fulfillment
      metadata: {
        reportId: reportId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/checkout (for debugging/testing)
 * Returns product information without creating session
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const model = searchParams.get("model") ?? "Unknown Model";
  const year = searchParams.get("year") ?? "2024";

  return NextResponse.json({
    message: stripe
      ? "Stripe configured - use POST to create checkout session"
      : "Stripe integration ready - add STRIPE_SECRET_KEY to enable",
    product: {
      name_template: `EV-Risk™ Full Report: {year} {model}`,
      currency: "usd",
      unit_amount: 1500, // $15.00 in cents
      features: [
        "Printable full report (web view → Save as PDF)",
        "Model-specific risk flags & verification steps",
        "Price negotiation talking points",
        "Pre-purchase inspection checklist",
        "Dealer questions script",
        "Battery health verification steps",
        "5-year TCO estimate (directional)",
      ],
    },
    example: {
      name: `EV-Risk™ Full Report: ${year} ${model}`,
      price: "$15.00",
    },
    flags: {
      stripe_enabled: !!stripe,
      webhook_fulfillment_enabled: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
    next_steps: stripe
      ? [
          "✅ Stripe SDK installed and configured",
          "2. Configure webhook endpoint in Stripe Dashboard",
          "3. Add STRIPE_WEBHOOK_SECRET to .env.local",
          "4. Implement webhook handler at /api/stripe/webhook",
          "5. Test with Stripe CLI: stripe listen --forward-to localhost:3002/api/stripe/webhook",
        ]
      : [
          "1. Create Stripe account (stripe.com)",
          "2. Install Stripe SDK: npm install stripe",
          "3. Add STRIPE_SECRET_KEY to .env.local",
          "4. Add STRIPE_WEBHOOK_SECRET after webhook setup",
          "5. Restart dev server",
        ],
  });
}
