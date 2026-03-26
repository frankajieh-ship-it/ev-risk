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
import { audit } from "@/lib/audit-logger";
import { sendChecklistEmail, isResendConfigured } from "@/lib/resend";

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
      audit({
        actor_type: "webhook",
        action: "payment.duplicate_webhook",
        result: "ok",
        metadata: { event_id: event.id, event_type: event.type },
      });
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
            await fulfillBuyerPass(session);
          } else if (session.amount_total === 3900) {
            await fulfillFullRiskReport(session);
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
          await fulfillBuyerPass(session);
        } else if (session.amount_total === 3900) {
          await fulfillFullRiskReport(session);
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
          // Track payment failure event for analytics
          try {
            await supabase.from("user_events").insert({
              event_name: "payment_failed",
              event_data: {
                stripe_session_id: sessionId,
                event_type: event.type,
              },
              page_path: "/api/stripe/webhook",
              timestamp: new Date().toISOString(),
            });
          } catch { /* swallow */ }
        }
        console.log(`Payment failed for ${sessionId || "unknown session"}`);
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
 * Fulfill $39 Full Risk Report purchase from Stripe Payment Link.
 * Logs the event + sends confirmation email to the buyer.
 */
async function fulfillFullRiskReport(session: Stripe.Checkout.Session) {
  const receiptId = session.client_reference_id;
  const customerEmail = session.customer_details?.email;

  // Persist to user_events
  try {
    await supabase.from("user_events").insert({
      event_name: "checkout_completed",
      timestamp: new Date().toISOString(),
      event_data: {
        offer_type: "full_risk_report_39",
        receipt_id: receiptId,
        stripe_session_id: session.id,
        amount: 39,
        customer_email: customerEmail || null,
      },
    });
  } catch {
    // Non-critical
  }

  audit({
    actor_type: "webhook",
    action: "payment.fulfilled",
    resource: `receipt:${receiptId || "unknown"}`,
    result: "ok",
    metadata: { stripe_session_id: session.id, offer_type: "full_risk_report_39" },
  });

  console.log("✅ Full Risk Report payment received:", {
    sessionId: session.id,
    receiptId,
    customerEmail,
    amount: "$39",
  });

  // Send confirmation email to buyer
  if (customerEmail && isResendConfigured()) {
    const html = `
      <h2>We received your Full Risk Report order!</h2>
      <p>Hi there,</p>
      <p>
        Thank you for your purchase. Our team will review your vehicle details and
        deliver your <strong>Full Risk Report</strong> (battery · accident · recall history
        + Fair/Good/Great deal rating) to this email address within <strong>48 hours</strong>.
      </p>
      ${receiptId ? `<p style="font-size:13px;color:#888;">Reference: ${receiptId}</p>` : ""}
      <p>
        If you have any questions, reply to this email or contact us at
        <a href="mailto:support@offolabs.com">support@offolabs.com</a>.
      </p>
      <p>— The OFFO Team</p>
    `;
    try {
      await sendChecklistEmail(
        customerEmail,
        "Your OFFO Full Risk Report — we'll deliver within 48h",
        html
      );
    } catch {
      // Non-critical
    }
  }

  return true;
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
      audit({
        actor_type: "webhook",
        action: "payment.fulfill_failed",
        resource: `receipt:${reportId}`,
        result: "error",
        metadata: { stripe_session_id: session.id },
      });
      return false;
    }

    console.log("✅ Order fulfilled:", {
      sessionId: session.id,
      reportId,
      customerEmail,
      amountPaid: `$${amountPaid}`,
      timestamp: new Date().toISOString(),
    });
    audit({
      actor_type: "webhook",
      action: "payment.fulfilled",
      resource: `receipt:${reportId}`,
      result: "ok",
      metadata: { stripe_session_id: session.id },
    });

    return true;
  } catch (error) {
    console.error("❌ Fulfillment error:", error);
    return false;
  }
}

/**
 * Fulfill Buyer Pass purchase (receipt or evroutine scenario)
 * Marks the purchase as paid in the purchases table
 */
async function fulfillBuyerPass(session: Stripe.Checkout.Session) {
  const scenarioType = session.metadata?.scenario_type;
  const baseScenarioId = session.metadata?.base_scenario_id || session.client_reference_id;
  const packTier = session.metadata?.pack_tier || "buyer_pass";

  if (!baseScenarioId) {
    console.error("❌ No scenario_id in Decision Pack session");
    return false;
  }

  try {
    const { data, error } = await supabase
      .from("purchases")
      .update({
        status: "paid",
        pack_tier: packTier,
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
      audit({
        actor_type: "webhook",
        action: "payment.fulfill_failed",
        resource: `purchase:${baseScenarioId}`,
        result: "error",
        metadata: { stripe_session_id: session.id, scenario_type: scenarioType },
      });
      return false;
    }

    console.log(`✅ Buyer Pass fulfilled:`, {
      sessionId: session.id,
      scenarioType,
      baseScenarioId,
      packTier,
      purchaseId: data.purchase_id,
      customerEmail: session.customer_details?.email,
      timestamp: new Date().toISOString(),
    });

    audit({
      actor_type: "webhook",
      action: "payment.fulfilled",
      resource: `purchase:${data.purchase_id}`,
      result: "ok",
      metadata: { stripe_session_id: session.id, scenario_type: scenarioType, pack_tier: packTier },
    });

    // Log checkout_completed + buyer_pass_activated events
    try {
      const eventData = {
        scenario_type: scenarioType,
        scenario_id: baseScenarioId,
        purchase_id: data.purchase_id,
        stripe_session_id: session.id,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        pack_tier: packTier,
      };
      await supabase.from("user_events").insert([
        { event_name: "checkout_completed", event_data: eventData, timestamp: new Date().toISOString() },
        { event_name: "buyer_pass_activated", event_data: eventData, timestamp: new Date().toISOString() },
      ]);
    } catch {
      // Non-critical — don't fail fulfillment over analytics
    }

    // Update email funnel stage → purchased (fire-and-forget)
    const anonId = session.metadata?.anon_id;
    if (anonId) {
      supabase
        .from("checklist_email_captures")
        .update({ funnel_stage: "purchased", updated_at: new Date().toISOString() })
        .eq("anon_id", anonId)
        .then(() => {});
    }

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
