/**
 * EV-Risk™ Stripe Webhook Handler
 *
 * POST /api/stripe/webhook
 * Handles Stripe events for payment fulfillment
 *
 * Critical events:
 * - checkout.session.completed: Payment successful, fulfill order
 * - checkout.session.async_payment_succeeded: Async payment completed
 * - checkout.session.async_payment_failed: Async payment failed
 *
 * Docs: https://stripe.com/docs/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@vercel/postgres";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
    })
  : null;

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 501 }
    );
  }

  const sig = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  // Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error("⚠️ Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only fulfill if payment was successful
        if (session.payment_status === "paid") {
          await fulfillOrder(session);
        } else {
          console.log(
            `⏳ Payment pending for session ${session.id} - will fulfill on payment success`
          );
        }
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await fulfillOrder(session);
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`❌ Payment failed for session ${session.id}`);
        // TODO: Send failure notification email if customer_email exists
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Fulfill order after successful payment
 * Marks the report as paid in the database
 */
async function fulfillOrder(session: Stripe.Checkout.Session) {
  const reportId = session.client_reference_id;
  const customerEmail = session.customer_details?.email;
  const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

  if (!reportId) {
    console.error("❌ No reportId in session - cannot fulfill order");
    return false;
  }

  try {
    // Mark report as paid in database
    const result = await sql`
      UPDATE reports
      SET
        status = 'paid',
        paid_at = NOW(),
        stripe_session_id = ${session.id},
        customer_email = ${customerEmail || null}
      WHERE id = ${reportId}
      AND status = 'draft'
      RETURNING id
    `;

    if (result.rowCount === 0) {
      console.error(`❌ Report ${reportId} not found or already paid`);
      return false;
    }

    console.log("✅ Order fulfilled:", {
      sessionId: session.id,
      reportId,
      customerEmail,
      amountPaid: `$${amountPaid}`,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error("❌ Fulfillment error:", error);
    return false;
  }
}

/**
 * GET /api/stripe/webhook (for testing)
 * Returns webhook configuration status
 */
export async function GET() {
  const configured = !!(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
  );

  return NextResponse.json({
    webhook_configured: configured,
    message: configured
      ? "Webhook endpoint ready to receive events"
      : "Configure STRIPE_WEBHOOK_SECRET to enable webhooks",
    instructions: configured
      ? [
          "✅ Webhook endpoint configured",
          "2. Add this endpoint to Stripe Dashboard:",
          "   https://yourdomain.com/api/stripe/webhook",
          "3. Select events: checkout.session.completed, checkout.session.async_payment_*",
          "4. Test with Stripe CLI:",
          "   stripe listen --forward-to localhost:3002/api/stripe/webhook",
        ]
      : [
          "1. Get webhook signing secret from Stripe Dashboard",
          "2. Add STRIPE_WEBHOOK_SECRET to .env.local",
          "3. Restart dev server",
          "4. Configure webhook endpoint in Stripe Dashboard",
        ],
    events_handled: [
      "checkout.session.completed (payment successful)",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
    ],
  });
}
