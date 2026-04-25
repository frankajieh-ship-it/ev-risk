/**
 * Weekly Digest Email Send (Internal)
 *
 * POST /api/email/weekly-digest/send?offset=0&limit=200
 *
 * Sends the Monday digest to auth users with deal watches or saved scenarios.
 * Accepts ?offset and ?limit for batching (Netlify function calls twice for
 * up to 400 recipients while staying within the 60s timeout).
 *
 * Market snapshot is computed ONCE per call (not per-user).
 * Idempotency key: digest:{userId}:week:{YYYY-WW} — one per calendar week.
 *
 * Protected by ADMIN_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { isResendConfigured } from "@/lib/resend";
import { safeSend, isoWeekKey } from "@/lib/crm-email";
import { getDigestRecipients, getDigestMarketSnapshot } from "@/lib/crm-queries";
import { buildWeeklyDigest } from "@/lib/crm-templates/weekly-digest";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10), 200);

  const weekKey = isoWeekKey();
  const results = { sent: 0, skipped: 0, errors: 0, offset, limit };

  // Compute market snapshot once for all recipients in this batch
  const marketSnapshot = await getDigestMarketSnapshot();

  const recipients = await getDigestRecipients(limit, offset, weekKey);

  for (const recipient of recipients) {
    try {
      const { subject, html } = buildWeeklyDigest({
        email: recipient.email,
        userId: recipient.userId,
        dealWatchMatches: recipient.dealWatchMatches,
        receiptsThisWeek: recipient.receiptsThisWeek,
        marketSnapshot,
        lastVehicle: recipient.lastVehicle,
        lastVerdict: recipient.lastVerdict,
      });

      const idempotencyKey = recipient.userId
        ? `digest:${recipient.userId}:week:${weekKey}`
        : `digest:anon:${recipient.email}:week:${weekKey}`;

      const r = await safeSend({
        email: recipient.email,
        userId: recipient.userId,
        anonId: recipient.anonId,
        sequenceType: "weekly_digest",
        sequenceStep: "digest_weekly",
        subject,
        html,
        idempotencyKey,
        metadata: {
          week_key: weekKey,
          deal_watch_matches: recipient.dealWatchMatches,
          receipts_this_week: recipient.receiptsThisWeek,
          last_vehicle: recipient.lastVehicle,
        },
      });

      if (r.sent) results.sent++;
      else if (r.skipped) results.skipped++;
      else results.errors++;
    } catch (err) {
      results.errors++;
      console.error("[weekly-digest/send] error for", recipient.email, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), week: weekKey, sent: results });
}
