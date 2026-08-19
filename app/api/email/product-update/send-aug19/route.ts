/**
 * Product Update Broadcast — August 2026
 *
 * POST /api/email/product-update/send-aug19
 *
 * One-time blast announcing OFFO is now fully free.
 * Covers two pools:
 *   Pool A: authenticated users (auth.users)
 *   Pool B: anon email captures (checklist_email_captures)
 *
 * Idempotency key: product-update:free-aug2026:{userId|email}
 * Safe to call multiple times — duplicates suppressed by unique constraint
 * on crm_email_sends.idempotency_key.
 *
 * Query params:
 *   ?dry_run=true  — log recipients without sending
 *
 * Protected by ADMIN_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";
import { buildProductUpdateFreeAugust2026 } from "@/lib/crm-templates/product-update";

const CAMPAIGN_KEY = "product-update:free-aug2026";

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
      results.recipients.push(email);
      results.sent++;
      return;
    }

    try {
      const { subject, html } = buildProductUpdateFreeAugust2026({ email });
      const idempotencyKey = userId
        ? `${CAMPAIGN_KEY}:${userId}`
        : `${CAMPAIGN_KEY}:${email}`;

      const r = await safeSend({
        email,
        userId,
        sequenceType: "product_update",
        sequenceStep: "free_aug2026",
        subject,
        html,
        idempotencyKey,
        metadata: { campaign: CAMPAIGN_KEY },
      });

      if (r.sent) {
        results.sent++;
        console.log(`[product-update/send-aug19] Sent → ${email}`);
      } else if (r.skipped) {
        results.skipped++;
      } else {
        results.errors++;
        console.error(`[product-update/send-aug19] Error for ${email}:`, r.error);
      }
    } catch (err) {
      results.errors++;
      console.error(`[product-update/send-aug19] Error for ${email}:`, err instanceof Error ? err.message : err);
    }
  }

  // ── Pool A: authenticated users ───────────────────────────────────────────

  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 500 });
  const seenEmails = new Set<string>();

  for (const user of authUsers?.users ?? []) {
    if (!user.email) continue;

    const { data: pref } = await supabase
      .from("crm_email_preferences")
      .select("all_marketing, bounced, product_update")
      .eq("email", user.email)
      .maybeSingle();

    if (pref && (!pref.all_marketing || pref.bounced || pref.product_update === false)) {
      results.skipped++;
      continue;
    }

    seenEmails.add(user.email);
    await sendTo(user.email, user.id);
  }

  // ── Pool B: anon email captures ───────────────────────────────────────────

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
      .select("all_marketing, bounced, product_update")
      .eq("email", cap.email)
      .maybeSingle();

    if (pref && (!pref.all_marketing || pref.bounced || pref.product_update === false)) {
      results.skipped++;
      continue;
    }

    seenEmails.add(cap.email);
    await sendTo(cap.email);
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    campaign: CAMPAIGN_KEY,
    results,
  });
}
