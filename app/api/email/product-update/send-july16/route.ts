/**
 * Product Update Broadcast — July 16 2026
 *
 * POST /api/email/product-update/send-july16
 *
 * One-time send announcing: At a Glance 9-check grid, warranty coverage,
 * photo analysis fixed. Covers both auth users + anon email captures.
 *
 * Idempotency key: product-update:report-upgrade-july16:{userId|email}
 * Safe to call multiple times — duplicates suppressed by crm_email_sends unique constraint.
 *
 * Query params:
 *   ?dry_run=true   — log recipients without sending
 *
 * Protected by ADMIN_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";
import { buildProductUpdateReportUpgrade } from "@/lib/crm-templates/product-update";

const CAMPAIGN_KEY = "product-update:report-upgrade-july16";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  if (!isResendConfigured()) return NextResponse.json({ error: "Email service not configured" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dry_run") === "true";

  const results = { sent: 0, skipped: 0, errors: 0, dry_run: dryRun, recipients: [] as string[] };

  async function sendTo(email: string, userId?: string): Promise<void> {
    if (dryRun) {
      console.log(`[product-update/send-july16] DRY RUN → ${email}`);
      results.recipients.push(email);
      results.sent++;
      return;
    }

    try {
      const { subject, html } = buildProductUpdateReportUpgrade({ email });
      const idempotencyKey = userId
        ? `${CAMPAIGN_KEY}:${userId}`
        : `${CAMPAIGN_KEY}:${email}`;

      const r = await safeSend({
        email,
        userId,
        sequenceType: "activation",
        sequenceStep: "product_update_july16_2026",
        subject,
        html,
        idempotencyKey,
        metadata: { campaign: CAMPAIGN_KEY },
      });

      if (r.sent) {
        results.sent++;
        console.log(`[product-update/send-july16] Sent → ${email}`);
      } else if (r.skipped) {
        results.skipped++;
      } else {
        results.errors++;
        console.error(`[product-update/send-july16] safeSend error for ${email}:`, r.error);
      }
    } catch (err) {
      results.errors++;
      console.error(`[product-update/send-july16] Error for ${email}:`, err instanceof Error ? err.message : err);
    }
  }

  // ── Collect all recipients first, then send in parallel batches ─────────

  const seenEmails = new Set<string>();
  const queue: Array<{ email: string; userId?: string }> = [];

  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 500 });

  for (const user of authUsers?.users ?? []) {
    if (!user.email) continue;

    const { data: pref } = await supabase
      .from("crm_email_preferences")
      .select("all_marketing, bounced, activation")
      .eq("email", user.email)
      .maybeSingle();

    if (pref && (!pref.all_marketing || pref.bounced || pref.activation === false)) {
      results.skipped++;
      continue;
    }

    seenEmails.add(user.email);
    queue.push({ email: user.email, userId: user.id });
  }

  const { data: captures } = await supabase
    .from("checklist_email_captures")
    .select("email")
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  for (const cap of captures ?? []) {
    if (!cap.email || seenEmails.has(cap.email)) continue;

    const { data: pref } = await supabase
      .from("crm_email_preferences")
      .select("all_marketing, bounced, activation")
      .eq("email", cap.email)
      .maybeSingle();

    if (pref && (!pref.all_marketing || pref.bounced || pref.activation === false)) {
      results.skipped++;
      continue;
    }

    seenEmails.add(cap.email);
    queue.push({ email: cap.email });
  }

  // Send in parallel batches of 10 to stay well under the 60s timeout
  const BATCH_SIZE = 10;
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((r) => sendTo(r.email, r.userId)));
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    campaign: CAMPAIGN_KEY,
    results,
  });
}
