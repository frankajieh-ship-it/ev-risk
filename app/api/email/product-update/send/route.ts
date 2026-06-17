/**
 * Product Update Broadcast — June 2026
 *
 * POST /api/email/product-update/send
 *
 * One-time send to all opted-in users announcing the Scan the Listing
 * + photo analysis features. Covers two pools:
 *   Pool A: authenticated users (auth.users)
 *   Pool B: anon email captures (checklist_email_captures)
 *
 * Idempotency key: product-update:june2026:{userId|email}
 * Safe to call multiple times — duplicate sends are suppressed by the
 * unique constraint on crm_email_sends.idempotency_key.
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
import { buildProductUpdateJune2026 } from "@/lib/crm-templates/product-update";

const CAMPAIGN_KEY = "product-update:june2026";

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

  // ── Helper: send to one address ───────────────────────────────────────────

  async function sendTo(email: string, userId?: string): Promise<void> {
    if (dryRun) {
      console.log(`[product-update/send] DRY RUN → ${email}`);
      results.recipients.push(email);
      results.sent++;
      return;
    }

    try {
      const { subject, html } = buildProductUpdateJune2026({ email });
      const idempotencyKey = userId
        ? `${CAMPAIGN_KEY}:${userId}`
        : `${CAMPAIGN_KEY}:${email}`;

      const r = await safeSend({
        email,
        userId,
        sequenceType: "activation",
        sequenceStep: "product_update_june2026",
        subject,
        html,
        idempotencyKey,
        metadata: { campaign: CAMPAIGN_KEY },
      });

      if (r.sent) {
        results.sent++;
        console.log(`[product-update/send] Sent → ${email}`);
      } else if (r.skipped) {
        results.skipped++;
      } else {
        results.errors++;
        console.error(`[product-update/send] safeSend error for ${email}:`, r.error);
      }
    } catch (err) {
      results.errors++;
      console.error(`[product-update/send] Error for ${email}:`, err instanceof Error ? err.message : err);
    }
  }

  // ── Pool A: authenticated users ───────────────────────────────────────────

  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 500 });
  const seenEmails = new Set<string>();

  for (const user of authUsers?.users ?? []) {
    if (!user.email) continue;

    // Check suppression
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

    // Check suppression
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
    await sendTo(cap.email);
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    campaign: CAMPAIGN_KEY,
    results,
  });
}
