/**
 * Personalized Activation Email Send (Internal)
 *
 * POST /api/email/activation/send
 *
 * Processes pending Day 1, 3, and 7 activation emails with vehicle/verdict
 * personalization fetched from receipts.output_json.
 *
 * Replaces the generic /api/email/nudge/send over time — both can run in
 * parallel safely (idempotency_key in crm_email_sends prevents double-sends,
 * and this route also updates email_sequences.day{N}_sent_at so the old
 * route's WHERE clauses still filter correctly).
 *
 * Protected by ADMIN_API_KEY. Called daily by send-activation-emails Netlify function.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";
import { buildActivationDay1, buildActivationDay3, buildActivationDay7 } from "@/lib/crm-templates/activation";
import { vehicleLabel } from "@/lib/crm-templates/shared";
import type { ActivationContext } from "@/lib/crm-templates/activation";

const BATCH_LIMIT = 50;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  if (!isResendConfigured()) return NextResponse.json({ error: "Email service not configured" }, { status: 503 });

  const now = new Date();
  const results = { day1: 0, day3: 0, day7: 0, skipped: 0, errors: 0 };

  // Helper: fetch personalization context from receipts table
  async function buildContext(row: Record<string, unknown>): Promise<ActivationContext> {
    const meta = (row.metadata as Record<string, unknown>) || {};
    const triggerId = meta.trigger_id as string | undefined;
    const triggerEvent = (row.trigger_event as string) === "receipt_generated"
      ? "receipt_generated" as const
      : "evfit_completed" as const;

    let vehicle = (meta.top_vehicle as string) || (meta.vehicle as string) || "your vehicle";
    let verdict: ActivationContext["verdict"];
    let topRiskFlag: string | undefined;
    let fitScore: number | undefined;

    if (triggerId) {
      const { data: receipt } = await supabase
        .from("receipts")
        .select("output_json")
        .eq("id", triggerId)
        .maybeSingle();

      if (receipt?.output_json) {
        const out = receipt.output_json as Record<string, unknown>;
        const summary = out.listing_summary as Record<string, unknown> | undefined;
        vehicle = vehicleLabel(
          summary?.year as number | null,
          summary?.make as string | null,
          summary?.model as string | null
        ) || vehicle;
        verdict = (out.verdict as ActivationContext["verdict"]) || undefined;
        const flags = out.risk_flags as string[] | undefined;
        topRiskFlag = flags?.[0];
        fitScore = (out.fit_score as number) || undefined;
      }
    }

    return {
      email: row.email as string,
      vehicle,
      verdict,
      topRiskFlag,
      fitScore,
      receiptId: triggerId,
      triggerEvent,
    };
  }

  // ── Day 1: enrolled 23+ hours ago, day1 not sent ──────────────────────────
  const { data: day1Rows } = await supabase
    .from("email_sequences")
    .select("*")
    .is("day1_sent_at", null)
    .eq("unsubscribed", false)
    .lte("enrolled_at", new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString())
    .limit(BATCH_LIMIT);

  for (const row of day1Rows || []) {
    try {
      const ctx = await buildContext(row);
      const { subject, html } = buildActivationDay1(ctx);
      const r = await safeSend({
        email: row.email,
        sequenceType: "activation",
        sequenceStep: "day1",
        subject,
        html,
        idempotencyKey: `activation:${row.id}:day1`,
        metadata: { sequence_id: row.id, vehicle: ctx.vehicle, verdict: ctx.verdict },
      });
      if (r.sent) {
        await supabase.from("email_sequences").update({ day1_sent_at: now.toISOString() }).eq("id", row.id);
        results.day1++;
      } else if (r.skipped) {
        results.skipped++;
      } else {
        results.errors++;
      }
    } catch (err) {
      results.errors++;
      console.error("[activation/send] Day 1 error for", row.email, err instanceof Error ? err.message : err);
    }
  }

  // ── Day 3: enrolled 3+ days ago, day1 sent, day3 not sent ────────────────
  const { data: day3Rows } = await supabase
    .from("email_sequences")
    .select("*")
    .not("day1_sent_at", "is", null)
    .is("day3_sent_at", null)
    .eq("unsubscribed", false)
    .lte("enrolled_at", new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())
    .limit(BATCH_LIMIT);

  for (const row of day3Rows || []) {
    try {
      const ctx = await buildContext(row);
      const { subject, html } = buildActivationDay3(ctx);
      const r = await safeSend({
        email: row.email,
        sequenceType: "activation",
        sequenceStep: "day3",
        subject,
        html,
        idempotencyKey: `activation:${row.id}:day3`,
        metadata: { sequence_id: row.id, vehicle: ctx.vehicle },
      });
      if (r.sent) {
        await supabase.from("email_sequences").update({ day3_sent_at: now.toISOString() }).eq("id", row.id);
        results.day3++;
      } else if (r.skipped) {
        results.skipped++;
      } else {
        results.errors++;
      }
    } catch (err) {
      results.errors++;
      console.error("[activation/send] Day 3 error for", row.email, err instanceof Error ? err.message : err);
    }
  }

  // ── Day 7: enrolled 7+ days ago, day3 sent, day7 not sent ────────────────
  const { data: day7Rows } = await supabase
    .from("email_sequences")
    .select("*")
    .not("day3_sent_at", "is", null)
    .is("day7_sent_at", null)
    .eq("unsubscribed", false)
    .lte("enrolled_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(BATCH_LIMIT);

  for (const row of day7Rows || []) {
    try {
      const ctx = await buildContext(row);
      const { subject, html } = buildActivationDay7(ctx);
      const r = await safeSend({
        email: row.email,
        sequenceType: "activation",
        sequenceStep: "day7",
        subject,
        html,
        idempotencyKey: `activation:${row.id}:day7`,
        metadata: { sequence_id: row.id, vehicle: ctx.vehicle },
      });
      if (r.sent) {
        await supabase.from("email_sequences").update({ day7_sent_at: now.toISOString() }).eq("id", row.id);
        results.day7++;
      } else if (r.skipped) {
        results.skipped++;
      } else {
        results.errors++;
      }
    } catch (err) {
      results.errors++;
      console.error("[activation/send] Day 7 error for", row.email, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true, timestamp: now.toISOString(), sent: results });
}
