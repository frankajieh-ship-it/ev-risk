/**
 * POST /api/admin/checkout-recovery
 *
 * One-shot manual recovery for abandoned Stripe checkout sessions.
 *
 * Fetches recent expired/open sessions from Stripe, resolves buyer emails
 * (from Stripe customer_details or our checklist_email_captures via anon_id),
 * and sends a recovery email via safeSend() (idempotent — safe to re-run).
 *
 * Body (optional):
 *   { dry_run?: boolean, limit?: number, created_after?: string (ISO date) }
 *
 * Protected by ADMIN_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { safeSend, emailWrapper, emailFooter } from "@/lib/crm-email";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-12-15.clover" })
  : null;

function buildRecoveryEmail(params: {
  email: string;
  vehicle: string | null;
  receiptUrl: string;
  priceLabel: string;
}): string {
  const { email, vehicle, receiptUrl, priceLabel } = params;
  const vehicleName = vehicle || "your listing";
  const footer = emailFooter(email, "conversion");

  return emailWrapper(`
    <h2 style="font-size:19px;font-weight:700;color:#ffffff;margin:0 0 14px;line-height:1.3;">
      Your OFFO report is still waiting
    </h2>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 18px;">
      You started to unlock the full analysis for <strong>${vehicleName}</strong> but didn't finish.
      Your report is saved — complete checkout to see everything.
    </p>

    <div style="background:#ffffff0a;border:1px solid #30363d;border-radius:10px;padding:16px 20px;margin:0 0 22px;">
      <p style="font-size:13px;color:#8b949e;margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">What you'll unlock</p>
      <ul style="margin:0;padding-left:18px;color:#c9d1d9;font-size:14px;line-height:1.8;">
        <li>VIN history — theft, salvage &amp; accident records</li>
        <li>Full AI risk verdict &amp; deal quality score</li>
        <li>Photo angle analysis — missing or suspicious angles flagged</li>
        <li>Negotiation talking points for this exact listing</li>
      </ul>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="${receiptUrl}" style="display:inline-block;background:#00d97e;color:#0d1117;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;padding:14px 32px;">
        Complete checkout — ${priceLabel} →
      </a>
    </div>

    <p style="font-size:13px;color:#8b949e;line-height:1.6;margin:0 0 32px;text-align:center;">
      One listing only · No subscription · Secure payment via Stripe
    </p>

    <p style="font-size:15px;color:#c9d1d9;margin:0;">
      — Frank<br/>
      <span style="color:#8b949e;font-size:13px;">Founder, OFFO · <a href="mailto:frank@offolab.com" style="color:#8b949e;">frank@offolab.com</a></span>
    </p>
    ${footer}
  `);
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { dry_run?: boolean; limit?: number; created_after?: string } = {};
  try { body = await req.json(); } catch { /* empty body fine */ }

  const dryRun = body.dry_run === true;
  const limit = Math.min(body.limit ?? 20, 100);
  // Default: sessions created in the last 30 days
  const createdAfter = body.created_after
    ? Math.floor(new Date(body.created_after).getTime() / 1000)
    : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

  // 1. Fetch expired sessions from Stripe
  const expiredSessions = await stripe.checkout.sessions.list({
    status: "expired",
    limit,
    created: { gte: createdAfter },
  });

  const candidates: Array<{
    session_id: string;
    email: string | null;
    anon_id: string | null;
    scenario_id: string | null;
    pack_tier: string;
    amount: number;
    created: number;
    email_source: "stripe" | "db" | null;
  }> = [];

  for (const session of expiredSessions.data) {
    // Skip sessions that were completed (shouldn't happen with status=expired but be safe)
    if (session.payment_status === "paid") continue;

    const anonId = session.metadata?.anon_id || null;
    const scenarioId = session.metadata?.base_scenario_id || session.client_reference_id || null;
    const packTier = session.metadata?.pack_tier || "receipt_single";

    let email: string | null = session.customer_details?.email || null;
    let emailSource: "stripe" | "db" | null = email ? "stripe" : null;

    // If Stripe doesn't have email (buyer abandoned before entering it), check our DB
    if (!email && anonId) {
      const { data: capture } = await supabase
        .from("checklist_email_captures")
        .select("email")
        .eq("anon_id", anonId)
        .maybeSingle();
      if (capture?.email) {
        email = capture.email;
        emailSource = "db";
      }
    }

    candidates.push({
      session_id: session.id,
      email,
      anon_id: anonId,
      scenario_id: scenarioId,
      pack_tier: packTier,
      amount: session.amount_total || 0,
      created: session.created,
      email_source: emailSource,
    });
  }

  const withEmail = candidates.filter(c => c.email);
  const withoutEmail = candidates.filter(c => !c.email);

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      total_expired: candidates.length,
      recoverable: withEmail.length,
      no_email: withoutEmail.length,
      sessions: candidates.map(c => ({
        session_id: c.session_id,
        email: c.email,
        email_source: c.email_source,
        scenario_id: c.scenario_id,
        pack_tier: c.pack_tier,
        amount_dollars: (c.amount / 100).toFixed(2),
        created_at: new Date(c.created * 1000).toISOString(),
      })),
    });
  }

  // 2. Send recovery emails
  const results = { sent: 0, skipped: 0, no_email: withoutEmail.length, errors: [] as string[] };

  for (const c of withEmail) {
    if (!c.email) continue;

    // Resolve vehicle label from receipts table
    let vehicle: string | null = null;
    if (c.scenario_id) {
      try {
        const { data: receipt } = await supabase
          .from("receipts")
          .select("output_json")
          .eq("id", c.scenario_id)
          .maybeSingle();
        const out = receipt?.output_json as Record<string, unknown> | null;
        const ls = out?.listing_summary as Record<string, unknown> | null;
        if (ls) {
          vehicle = [ls.year, ls.make, ls.model].filter(Boolean).join(" ") || null;
        }
      } catch { /* non-critical */ }
    }

    const priceLabel = c.pack_tier === "buyer_pass" ? "$9.99" : "$3.99";
    const receiptUrl = c.scenario_id
      ? `${SITE_URL}/receipt?id=${c.scenario_id}`
      : `${SITE_URL}/receipt`;

    const subject = `Your OFFO report is still waiting — ${priceLabel} unlocks everything`;

    try {
      const result = await safeSend({
        email: c.email,
        anonId: c.anon_id || undefined,
        sequenceType: "conversion",
        sequenceStep: "checkout_abandoned",
        subject,
        html: buildRecoveryEmail({ email: c.email, vehicle, receiptUrl, priceLabel }),
        idempotencyKey: `checkout_expired:${c.session_id}`,
        metadata: { stripe_session_id: c.session_id, scenario_id: c.scenario_id, pack_tier: c.pack_tier },
      });

      if (result.sent) results.sent++;
      else results.skipped++;
    } catch (err) {
      results.errors.push(`${c.email}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Brief pause to avoid Resend rate limits
    await new Promise(r => setTimeout(r, 150));
  }

  return NextResponse.json({
    success: true,
    ...results,
    total_expired: candidates.length,
    ...(results.errors.length > 0 && { errors: results.errors }),
  });
}
