/**
 * OFFO Buyer Pass — Checkout Endpoint
 *
 * POST /api/payments/checkout
 * Creates a Stripe Checkout Session for a Buyer Pass purchase.
 *
 * Buyer Pass ($9.99): 10 receipt credits, full AI analysis, deep-dive, PDF export.
 *
 * If the scenario already has a paid purchase, returns the existing status.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import {
  getVariantForTier,
  getStripePriceId,
  getAmountCents,
  getDisplayPrice,
  type PriceVariant,
  type PackTier,
} from "@/lib/price-assignment";

const VALID_PACK_TIERS: PackTier[] = ["buyer_pass", "seller_questions", "chat_pass", "copart_report", "sellers_report_pdf", "receipt_single"];

const checkoutRateLimiter = new RateLimiter(60 * 1000, 5); // 5 attempts per minute per IP

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

const VALID_SCENARIO_TYPES = ["receipt", "evroutine", "routine", "compare", "chat", "copart", "owned_ev"] as const;
type ScenarioType = (typeof VALID_SCENARIO_TYPES)[number];

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const ip = getClientIP(request);
  const rateCheck = checkoutRateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scenarioType = body.scenario_type as string;
  const scenarioId = body.scenario_id as string;
  const anonId = body.anon_id as string;
  const userId = (body.user_id as string) || null;
  const pageSource = (body.page_source as string) || null;
  const rawTier = (body.pack_tier as string) || "buyer_pass";
  const packTier: PackTier = VALID_PACK_TIERS.includes(rawTier as PackTier)
    ? (rawTier as PackTier)
    : "buyer_pass";

  // Validate required fields
  if (!scenarioType || !VALID_SCENARIO_TYPES.includes(scenarioType as ScenarioType)) {
    return NextResponse.json({ error: "Invalid scenario_type" }, { status: 400 });
  }
  if (!scenarioId) {
    return NextResponse.json({ error: "Missing scenario_id" }, { status: 400 });
  }
  if (!anonId || anonId.length < 5) {
    return NextResponse.json({ error: "Missing or invalid anon_id" }, { status: 400 });
  }

  // 1. Validate scenario exists and verify ownership
  // chat_pass and receipt_single skip this check — no DB row exists yet at payment time
  // (receipt_single is paid before generation; chat_pass uses sessionId as scenarioId)
  if (scenarioType !== "chat" && packTier !== "receipt_single") {
    const tableMap: Record<string, { table: string; select: string; ownerColumn: string | null; idColumn?: string }> = {
      receipt: { table: "receipts", select: "id, session_id", ownerColumn: "session_id" },
      evroutine: { table: "reports", select: "id", ownerColumn: null },
      routine: { table: "routine_runs", select: "id", ownerColumn: null },
      compare: { table: "compare_sessions", select: "id", ownerColumn: null },
      // copart scenario_id is auc_xxx (result_id), not a UUID — look up in auction_analyses
      copart: { table: "auction_analyses", select: "id, result_id", ownerColumn: null, idColumn: "result_id" },
      owned_ev: { table: "garage_vehicles", select: "id", ownerColumn: null },
    };
    const { table: tableName, select: selectColumns, ownerColumn, idColumn = "id" } = tableMap[scenarioType] || tableMap.evroutine;

    const { data: scenario, error: scenarioError } = await supabase
      .from(tableName)
      .select(selectColumns)
      .eq(idColumn, scenarioId)
      .maybeSingle();

    if (scenarioError || !scenario) {
      console.error("[Checkout] Scenario not found:", { table: tableName, scenarioId, error: scenarioError?.message });
      return NextResponse.json(
        { error: "Scenario not found", scenario_type: scenarioType, scenario_id: scenarioId },
        { status: 404 }
      );
    }

    // Verify ownership for receipts (session_id = receipt_token = anon_id)
    const scenarioRecord = scenario as unknown as Record<string, unknown>;
    if (ownerColumn && scenarioRecord[ownerColumn] && scenarioRecord[ownerColumn] !== anonId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  // 2. Check for existing paid purchase
  const { data: existingPurchase } = await supabase
    .from("purchases")
    .select("purchase_id, status, price_variant, amount, pack_tier")
    .eq("base_scenario_id", scenarioId)
    .eq("scenario_type", scenarioType)
    .eq("status", "paid")
    .maybeSingle();

  if (existingPurchase) {
    return NextResponse.json({
      status: "paid",
      purchase_id: existingPurchase.purchase_id,
      price_variant: existingPurchase.price_variant,
      amount: existingPurchase.amount,
      pack_tier: existingPurchase.pack_tier || "buyer_pass",
    });
  }

  // 3. Resolve price variant from pack tier (seller pack uses A/B via anonId hash)
  const variant: PriceVariant = getVariantForTier(packTier, anonId);

  // 4. Get Stripe Price ID or use inline price
  const stripePriceId = getStripePriceId(variant);
  const amountCents = getAmountCents(variant);
  const origin = request.headers.get("origin") ?? "http://localhost:3002";

  // Build UTM metadata
  const utmFields: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    if (body[key] && typeof body[key] === "string") {
      utmFields[key] = body[key] as string;
    }
  }

  try {
    // 5. Create Stripe Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      client_reference_id: scenarioId,
      metadata: {
        scenario_type: scenarioType,
        base_scenario_id: scenarioId,
        anon_id: anonId,
        ...(userId && { user_id: userId }),
        ...(pageSource && { page_source: pageSource }),
        price_variant: variant,
        pack_tier: packTier,
        ...utmFields,
      },
      success_url: `${origin}${scenarioType === "routine" ? "/routine" : scenarioType === "evroutine" ? "/report" : scenarioType === "compare" ? "/compare" : scenarioType === "chat" ? "/receipt" : scenarioType === "copart" ? "/copart" : scenarioType === "owned_ev" ? `/workspace/garage/${scenarioId}/owned-ev` : "/receipt"}?scenario_type=${scenarioType}&scenario_id=${scenarioId}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${scenarioType === "routine" ? "/routine" : scenarioType === "evroutine" ? "/report" : scenarioType === "compare" ? "/compare" : scenarioType === "chat" ? "/receipt" : scenarioType === "copart" ? "/copart" : scenarioType === "owned_ev" ? `/workspace/garage/${scenarioId}/owned-ev` : "/receipt"}?scenario_type=${scenarioType}&scenario_id=${scenarioId}&checkout=cancel`,
    };

    // Use pre-created Price if available, otherwise inline price_data
    if (stripePriceId) {
      sessionParams.line_items = [{ price: stripePriceId, quantity: 1 }];
    } else {
      const isSeller = packTier === "seller_questions";
      const isChat = packTier === "chat_pass";
      const isCopart = packTier === "copart_report";
      const isSellersReport = packTier === "sellers_report_pdf";
      const isReceiptSingle = packTier === "receipt_single";
      const productName = isReceiptSingle ? "OFFO Receipt Analysis" : isSeller ? "OFFO Seller Questions Pack" : isChat ? "OFFO AI Unlimited" : isCopart ? "OFFO Full Copart Risk Report" : isSellersReport ? "OFFO Sellers Report" : "OFFO Buyer Pass";
      const productDescription = isReceiptSingle
        ? "Full AI-powered EV deal analysis — risk verdict, deal quality score, battery assessment, and negotiation insights."
        : isSeller
        ? "Full seller questions pack + inspect-first checklist for this listing."
        : isChat
        ? "Unlimited AI chat questions forever — full multi-model reasoning, saved history."
        : isCopart
        ? "Full salvage risk analysis: battery projection, repair impact, post-auction routine estimate, and AI deep-dive."
        : isSellersReport
        ? "One-page dealer-ready Sellers Report with routine fit highlights, recall snapshot, and buyer-ready answers."
        : "10 receipts with full AI analysis, deep-dive, and PDF export.";

      sessionParams.line_items = [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: productName,
              description: productDescription,
            },
          },
          quantity: 1,
        },
      ];
    }

    // Stripe idempotency key prevents duplicate sessions for same scenario
    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: `purchase:${scenarioType}:${scenarioId}:${anonId}:${variant}:${packTier}`,
    });

    // 6. Insert pending purchase row
    const receiptCredits = packTier === "receipt_single" ? 1 : packTier === "seller_questions" ? 1 : packTier === "chat_pass" ? 0 : packTier === "copart_report" ? 1 : 10;
    const { error: insertError } = await supabase.from("purchases").insert({
      stripe_session_id: session.id,
      status: "pending",
      scenario_type: scenarioType,
      base_scenario_id: scenarioId,
      anon_id: anonId,
      user_id: userId,
      price_variant: variant,
      pack_tier: packTier,
      amount: amountCents,
      currency: "usd",
      page_source: pageSource,
      receipt_credits_total: receiptCredits,
      receipt_credits_used: 0,
      utm_source: utmFields.utm_source || null,
      utm_medium: utmFields.utm_medium || null,
      utm_campaign: utmFields.utm_campaign || null,
      utm_content: utmFields.utm_content || null,
      utm_term: utmFields.utm_term || null,
    });

    if (insertError) {
      console.error("[Checkout] Failed to insert purchase:", insertError.message);
      // Don't fail — the Stripe session was created, webhook will still work
    }

    return NextResponse.json({
      url: session.url,
      session_id: session.id,
      price: getDisplayPrice(variant),
      variant,
      pack_tier: packTier,
    });
  } catch (error) {
    console.error("[Checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
