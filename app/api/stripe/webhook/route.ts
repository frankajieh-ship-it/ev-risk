/**
 * EV-Risk™ / OFFO Stripe Webhook Handler
 *
 * POST /api/stripe/webhook
 * Handles Stripe events for payment fulfillment.
 *
 * Routes:
 * - Legacy report checkout: metadata has no scenario_type → fulfillOrder()
 * - Decision Pack checkout: metadata.scenario_type → fulfillDecisionPack()
 *
 * Dedup: stripe_webhook_events table prevents duplicate processing.
 *
 * Events handled:
 * - checkout.session.completed
 * - checkout.session.async_payment_succeeded
 * - checkout.session.async_payment_failed / payment_intent.payment_failed
 * - charge.refunded
 *
 * Docs: https://stripe.com/docs/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

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

  // Dedup: check if we already processed this event
  try {
    const { data: existingEvent } = await supabase
      .from("stripe_webhook_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();

    if (existingEvent) {
      return NextResponse.json({ received: true, deduplicated: true });
    }
  } catch {
    // Table may not exist yet — continue processing
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === "paid") {
          // Route by product type
          if (session.metadata?.scenario_type) {
            await fulfillDecisionPack(session);
          } else {
            await fulfillOrder(session);
          }
        } else {
          console.log(
            `⏳ Payment pending for session ${session.id} - will fulfill on payment success`
          );
        }
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.scenario_type) {
          await fulfillDecisionPack(session);
        } else {
          await fulfillOrder(session);
        }
        break;
      }

      case "checkout.session.async_payment_failed":
      case "payment_intent.payment_failed": {
        const obj = event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent;
        const sessionId = "id" in obj && typeof obj.id === "string" ? obj.id : null;
        if (sessionId) {
          // Mark Decision Pack purchase as failed
          await supabase
            .from("purchases")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("stripe_session_id", sessionId)
            .eq("status", "pending");
        }
        console.log(`❌ Payment failed for ${sessionId || "unknown session"}`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : null;
        if (paymentIntentId) {
          await supabase
            .from("purchases")
            .update({ status: "refunded", updated_at: new Date().toISOString() })
            .eq("stripe_payment_intent_id", paymentIntentId)
            .eq("status", "paid");
          console.log(`💸 Refund processed for payment_intent ${paymentIntentId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Record event for dedup
    try {
      await supabase
        .from("stripe_webhook_events")
        .insert({ id: event.id, event_type: event.type });
    } catch {
      // Ignore insert errors (table may not exist, or race condition)
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
    const { data, error } = await supabase
      .from("reports")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_session_id: session.id,
        customer_email: customerEmail || null,
      })
      .eq("id", reportId)
      .eq("status", "draft")
      .select("id")
      .single();

    if (error || !data) {
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
 * Fulfill Decision Pack purchase (receipt or evroutine scenario)
 * Marks the purchase as paid in the purchases table
 */
async function fulfillDecisionPack(session: Stripe.Checkout.Session) {
  const scenarioType = session.metadata?.scenario_type;
  const baseScenarioId = session.metadata?.base_scenario_id || session.client_reference_id;

  if (!baseScenarioId) {
    console.error("❌ No scenario_id in Decision Pack session");
    return false;
  }

  try {
    const { data, error } = await supabase
      .from("purchases")
      .update({
        status: "paid",
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_session_id", session.id)
      .eq("status", "pending")
      .select("purchase_id")
      .single();

    if (error || !data) {
      console.error(
        `❌ Purchase for session ${session.id} not found or already fulfilled`
      );
      return false;
    }

    console.log("✅ Decision Pack fulfilled:", {
      sessionId: session.id,
      scenarioType,
      baseScenarioId,
      purchaseId: data.purchase_id,
      customerEmail: session.customer_details?.email,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error("❌ Decision Pack fulfillment error:", error);
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
