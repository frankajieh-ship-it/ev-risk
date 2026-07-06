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
import { safeSend } from "@/lib/crm-email";
import { buildReceiptPaymentConfirm } from "@/lib/crm-templates/activation";

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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("⚠️ Webhook signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
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

      // Subscription lifecycle events
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        const periodEnd = (invoice as { period_end?: number }).period_end;

        if (customerId && subscriptionId) {
          // Extend the user's pro access to the end of the billing period
          const expiresAt = periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

          try {
            // Find user by stripe_customer_id stored in user_roles or purchases
            const { data: roleRow } = await supabase
              .from("user_roles")
              .select("user_id")
              .eq("stripe_customer_id", customerId)
              .maybeSingle();

            if (roleRow?.user_id) {
              await supabase
                .from("user_roles")
                .upsert(
                  {
                    user_id: roleRow.user_id,
                    role: "pro",
                    stripe_customer_id: customerId,
                    stripe_subscription_id: subscriptionId,
                    expires_at: expiresAt,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id" }
                );
              console.log(`✅ Subscription renewed for user ${roleRow.user_id} until ${expiresAt}`);
            }
          } catch (err) {
            console.error("[Webhook] invoice.payment_succeeded error:", err);
          }

          audit({
            actor_type: "webhook",
            action: "subscription.renewed",
            result: "ok",
            metadata: { stripe_customer_id: customerId, subscription_id: subscriptionId },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;

        if (customerId) {
          try {
            // Downgrade buyer pro access
            await supabase
              .from("user_roles")
              .update({
                role: "free",
                expires_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("stripe_customer_id", customerId)
              .eq("role", "pro");

            // Cancel dealer subscription if this was a dealer subscription
            const dealerPriceIds = [
              process.env.STRIPE_PRICE_STARTER_MONTHLY,
              process.env.STRIPE_PRICE_GROWTH_MONTHLY,
              process.env.STRIPE_PRICE_PRO_MONTHLY,
              process.env.STRIPE_PRICE_DEALER_MONTHLY,
            ].filter(Boolean) as string[];

            const wasDealerSub = dealerPriceIds.length > 0
              ? subscription.items.data.some((i) => dealerPriceIds.includes(i.price.id))
              : false;

            if (wasDealerSub) {
              await supabase
                .from("dealerships")
                .update({ subscription_status: "canceled" })
                .eq("stripe_customer_id", customerId);
            }

            console.log(`🔒 Subscription cancelled for customer ${customerId}`);
          } catch (err) {
            console.error("[Webhook] customer.subscription.deleted error:", err);
          }

          audit({
            actor_type: "webhook",
            action: "subscription.cancelled",
            result: "ok",
            metadata: { stripe_customer_id: customerId, subscription_id: subscription.id },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        console.log(`⚠️ Subscription payment failed for customer ${customerId ?? "unknown"}`);
        break;
      }

      // Dealer subscription lifecycle
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;

        // Match against all 3 tier price IDs plus the legacy fallback
        const dealerPriceIds = [
          process.env.STRIPE_PRICE_STARTER_MONTHLY,
          process.env.STRIPE_PRICE_GROWTH_MONTHLY,
          process.env.STRIPE_PRICE_PRO_MONTHLY,
          process.env.STRIPE_PRICE_DEALER_MONTHLY,
        ].filter(Boolean) as string[];

        const hasDealerPrice = dealerPriceIds.length > 0
          ? subscription.items.data.some((i) => dealerPriceIds.includes(i.price.id))
          : false;

        if (customerId && hasDealerPrice) {
          const newStatus = subscription.status === "active" ? "active"
            : subscription.status === "trialing" ? "trial"
            : subscription.status === "canceled" ? "canceled"
            : "inactive";

          const tier = subscription.metadata?.tier ?? null;

          const updatePayload: Record<string, string | null> = {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            subscription_status: newStatus,
          };
          if (tier) updatePayload.subscription_tier = tier;

          try {
            await supabase
              .from("dealerships")
              .update(updatePayload)
              .eq("stripe_customer_id", customerId);

            // Also handle first-time setup where stripe_customer_id isn't set yet
            const dealershipId = subscription.metadata?.dealership_id;
            if (dealershipId) {
              await supabase
                .from("dealerships")
                .update(updatePayload)
                .eq("id", dealershipId);
            }

            console.log(`✅ Dealer subscription ${event.type}: customer ${customerId} → ${newStatus} (tier: ${tier ?? "unknown"})`);
          } catch (err) {
            console.error("[Webhook] dealer subscription update error:", err);
          }

          audit({
            actor_type: "webhook",
            action: `dealer.subscription.${event.type === "customer.subscription.created" ? "created" : "updated"}`,
            result: "ok",
            metadata: { stripe_customer_id: customerId, subscription_id: subscription.id, status: newStatus, tier },
          });
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
 * Fulfill $39 Full Risk Report purchase.
 *
 * Fetches the existing receipt from Supabase, triggers the background AI
 * upgrade function (same pipeline as the free lite→ai_upgraded path), and
 * marks the receipt as "paid_full_risk". Sends confirmation email immediately
 * so the user knows it's processing; a second email fires when the upgrade
 * completes (handled inside the background function).
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

  // --- Automated AI upgrade ---
  if (receiptId) {
    try {
      // Fetch the stored receipt so we can reconstruct the upgrade payload
      const { data: receipt, error: fetchErr } = await supabase
        .from("receipts")
        .select("id, session_id, input_json, generation_status, is_pro")
        .eq("id", receiptId)
        .single();

      if (fetchErr || !receipt) {
        console.error("[FRR] Receipt not found for upgrade:", receiptId, fetchErr?.message);
      } else {
        // Mark as paid so the UI can show appropriate state
        await supabase
          .from("receipts")
          .update({ generation_status: "paid_full_risk" })
          .eq("id", receiptId);

        // Trigger the background function — with durable job record
        const upgradeUrl = `${process.env.NETLIFY_URL ?? "http://localhost:8888"}/.netlify/functions/upgrade-receipt-background`;
        const upgradePayload = {
          receipt_id: receipt.id,
          // session_id doubles as receipt_token (set at generation time)
          receipt_token: receipt.session_id ?? receiptId,
          input: receipt.input_json,
          rule_signals: [],   // will be re-derived inside background function
          rule_scoring: { verdict: "unknown", fit_score: 0 },
          rule_classification: { category: "unknown" },
          features: { full_risk_report: true },
          client_ip: "webhook",
          ip_hash: null,
          is_pro: true, // paid full risk = pro-level generation
          t0: Date.now(),
        };

        // Insert durable job record before firing so the retry scanner can recover it
        let jobId: string | null = null;
        try {
          const { data: jobRow } = await supabase
            .from("receipt_upgrade_jobs")
            .insert({
              receipt_id: receipt.id,
              receipt_token: receipt.session_id ?? receiptId,
              payload: upgradePayload,
              status: "pending",
              next_retry_at: new Date().toISOString(),
            })
            .select("job_id")
            .single();
          jobId = jobRow?.job_id ?? null;
        } catch (jobErr) {
          console.warn("[FRR] Job record insert failed:", jobErr instanceof Error ? jobErr.message : jobErr);
        }

        const payloadWithJobId = jobId ? { ...upgradePayload, job_id: jobId } : upgradePayload;
        fetch(upgradeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Upgrade-Secret": process.env.UPGRADE_SECRET ?? "",
          },
          body: JSON.stringify(payloadWithJobId),
        }).then((res) => {
          if (!res.ok && jobId) {
            supabase.from("receipt_upgrade_jobs").update({
              status: "failed",
              last_error: `enqueue_http_${res.status}`,
              next_retry_at: new Date(Date.now() + 60_000).toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("job_id", jobId).then(() => {}, () => {});
          }
        }).catch((err) => {
          console.error("[FRR] Failed to enqueue background upgrade:", err.message);
          if (jobId) {
            supabase.from("receipt_upgrade_jobs").update({
              status: "failed",
              last_error: err.message?.slice(0, 300) ?? "enqueue_fetch_threw",
              next_retry_at: new Date(Date.now() + 60_000).toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("job_id", jobId).then(() => {}, () => {});
          }
        });

        console.log("[FRR] Background upgrade enqueued for receipt:", receiptId);
      }
    } catch (err) {
      console.error("[FRR] Error during automated upgrade:", err);
    }
  }

  // Send immediate confirmation email
  if (customerEmail && isResendConfigured()) {
    const html = `
      <h2>Your Full Risk Report is being generated!</h2>
      <p>Hi there,</p>
      <p>
        Payment confirmed. Your <strong>Full Risk Report</strong> (battery · accident ·
        recall history + Fair/Good/Great deal rating) is being generated now and will
        be ready within a few minutes.
      </p>
      <p>Refresh your report page to see it when it's ready.</p>
      ${receiptId ? `<p style="font-size:13px;color:#888;">Reference: ${receiptId}</p>` : ""}
      <p>
        Questions? Contact us at
        <a href="mailto:support@offolabs.com">support@offolabs.com</a>.
      </p>
      <p>— The OFFO Team</p>
    `;
    try {
      await sendChecklistEmail(
        customerEmail,
        "Your OFFO Full Risk Report is generating now",
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

    // Sellers Report PDF entitlement — insert when pack_tier is sellers_report_pdf
    if (packTier === "sellers_report_pdf" && baseScenarioId) {
      const userId = session.metadata?.user_id;
      if (userId) {
        try {
          await supabase.from("owned_ev_entitlements").insert({
            user_id: userId,
            garage_vehicle_id: baseScenarioId,
            entitlement_type: "sellers_report_pdf",
            stripe_purchase_id: data.purchase_id,
          });
        } catch {
          // Non-fatal — entitlement can be granted manually if insert fails
          console.error("⚠️ Failed to insert sellers_report entitlement for vehicle", baseScenarioId);
        }
      }
    }

    // Auction report entitlement — insert when pack_tier is copart_report
    // base_scenario_id carries the auc_xxx result_id for auction purchases
    if (packTier === "copart_report" && baseScenarioId) {
      const userId = session.metadata?.user_id ?? null;
      try {
        await supabase.from("auction_entitlements").insert({
          result_id: baseScenarioId,
          stripe_purchase_id: data.purchase_id,
          stripe_session_id: session.id,
          user_id: userId,
          pack_tier: "copart_report",
        });
      } catch {
        // Non-fatal — entitlement can be granted manually if insert fails
        console.error("⚠️ Failed to insert auction entitlement for", baseScenarioId);
      }
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

    // Send post-purchase confirmation email (fire-and-forget)
    const customerEmail = session.customer_details?.email;
    if (customerEmail && isResendConfigured() && (packTier === "receipt_single" || packTier === "buyer_pass")) {
      // Fetch vehicle label from receipt for personalization
      let vehicle: string | undefined;
      if (baseScenarioId && scenarioType === "receipt") {
        try {
          const { data: receiptRow } = await supabase
            .from("receipts")
            .select("output_json")
            .eq("id", baseScenarioId)
            .maybeSingle();
          const output = receiptRow?.output_json as Record<string, unknown> | null;
          if (output?.year && output?.make && output?.model) {
            vehicle = `${output.year} ${output.make} ${output.model}`;
          }
        } catch { /* non-critical */ }
      }
      safeSend({
        email: customerEmail,
        sequenceType: "activation",
        sequenceStep: `purchase_confirm_${packTier}`,
        subject: buildReceiptPaymentConfirm({ email: customerEmail, vehicle, receiptId: baseScenarioId, tier: packTier as "receipt_single" | "buyer_pass" }).subject,
        html: buildReceiptPaymentConfirm({ email: customerEmail, vehicle, receiptId: baseScenarioId, tier: packTier as "receipt_single" | "buyer_pass" }).html,
        idempotencyKey: `purchase-confirm:${session.id}`,
        metadata: { pack_tier: packTier, scenario_id: baseScenarioId },
      }).catch(() => { /* non-critical */ });
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
