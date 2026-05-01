/**
 * Conversion Email Send (Internal)
 *
 * POST /api/email/conversion/send
 *
 * Processes two conversion triggers in a single run:
 *   1. paywall_dismissed  → 24h follow-up (window: 23-48h ago)
 *   2. checkout_started   → 2h follow-up  (window: 1.5-3h ago)
 *
 * Run every 4 hours by send-conversion-emails Netlify function
 * (catches the 2h checkout window within 2 checks max).
 *
 * Protected by ADMIN_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";
import { getConversionCandidates, getAuctionNurtureCandidates } from "@/lib/crm-queries";
import { buildConversionPaywall, buildConversionCheckout, buildAuctionNurture } from "@/lib/crm-templates/conversion";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  const results = {
    paywall_24h: { sent: 0, skipped: 0, errors: 0 },
    checkout_2h: { sent: 0, skipped: 0, errors: 0 },
    auction_nurture: { sent: 0, skipped: 0, errors: 0 },
  };

  // ── Paywall dismissed → 24h follow-up ────────────────────────────────────
  const paywallCandidates = await getConversionCandidates("paywall_dismissed", 50);
  for (const candidate of paywallCandidates) {
    try {
      const { subject, html } = buildConversionPaywall({
        email: candidate.email,
        vehicle: candidate.vehicle,
        receiptId: candidate.receiptId,
        triggerType: "paywall_dismissed",
        verdict: candidate.verdict as "GREEN" | "YELLOW" | "RED" | undefined,
      });
      const r = await safeSend({
        email: candidate.email,
        userId: candidate.userId,
        anonId: candidate.anonId,
        sequenceType: "conversion",
        sequenceStep: "conv_24h",
        subject,
        html,
        idempotencyKey: `conv:${candidate.eventId}:conv_24h`,
        metadata: {
          trigger_event_id: candidate.eventId,
          receipt_id: candidate.receiptId,
          vehicle: candidate.vehicle,
          verdict: candidate.verdict,
        },
      });
      if (r.sent) results.paywall_24h.sent++;
      else if (r.skipped) results.paywall_24h.skipped++;
      else results.paywall_24h.errors++;
    } catch (err) {
      results.paywall_24h.errors++;
      console.error("[conversion/send] paywall_24h error:", err instanceof Error ? err.message : err);
    }
  }

  // ── Checkout started → 2h follow-up ──────────────────────────────────────
  const checkoutCandidates = await getConversionCandidates("checkout_started", 50);
  for (const candidate of checkoutCandidates) {
    try {
      const { subject, html } = buildConversionCheckout({
        email: candidate.email,
        vehicle: candidate.vehicle,
        receiptId: candidate.receiptId,
        triggerType: "checkout_started",
        verdict: candidate.verdict as "GREEN" | "YELLOW" | "RED" | undefined,
      });
      const r = await safeSend({
        email: candidate.email,
        userId: candidate.userId,
        anonId: candidate.anonId,
        sequenceType: "conversion",
        sequenceStep: "conv_2h",
        subject,
        html,
        idempotencyKey: `conv:${candidate.eventId}:conv_2h`,
        metadata: {
          trigger_event_id: candidate.eventId,
          receipt_id: candidate.receiptId,
          vehicle: candidate.vehicle,
        },
      });
      if (r.sent) results.checkout_2h.sent++;
      else if (r.skipped) results.checkout_2h.skipped++;
      else results.checkout_2h.errors++;
    } catch (err) {
      results.checkout_2h.errors++;
      console.error("[conversion/send] checkout_2h error:", err instanceof Error ? err.message : err);
    }
  }

  // ── Auction email captured → 2-24h nurture ──────────────────────────────────
  const auctionCandidates = await getAuctionNurtureCandidates(50);
  for (const candidate of auctionCandidates) {
    try {
      const { subject, html } = buildAuctionNurture({
        email: candidate.email,
        vehicle: candidate.vehicle,
        resultId: candidate.resultId,
      });
      const r = await safeSend({
        email: candidate.email,
        anonId: candidate.anonId,
        sequenceType: "conversion",
        sequenceStep: "auction_nurture",
        subject,
        html,
        idempotencyKey: `auction_nurture:${candidate.eventId}`,
        metadata: {
          trigger_event_id: candidate.eventId,
          result_id: candidate.resultId,
          vehicle: candidate.vehicle,
        },
      });
      if (r.sent) results.auction_nurture.sent++;
      else if (r.skipped) results.auction_nurture.skipped++;
      else results.auction_nurture.errors++;
    } catch (err) {
      results.auction_nurture.errors++;
      console.error("[conversion/send] auction_nurture error:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), sent: results });
}
