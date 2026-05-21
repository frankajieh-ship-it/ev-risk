/**
 * Win-Back Email Send (Internal)
 *
 * POST /api/email/win-back/send
 *
 * Processes win-back sequences for auth users who have gone dark:
 *   - 30-day: users with no activity for 30+ days → Email A
 *   - 60-day: users with no activity for 60+ days AND already received Email A → Email B (last attempt)
 *
 * Protected by ADMIN_API_KEY. Called daily at 11:00 UTC.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend, isoWeekKey } from "@/lib/crm-email";
import { getWinBackCandidates } from "@/lib/crm-queries";
import { buildWinBack30, buildWinBack60 } from "@/lib/crm-templates/win-back";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  if (!isResendConfigured()) return NextResponse.json({ error: "Email service not configured" }, { status: 503 });

  const now = new Date().toISOString();
  const weekKey = isoWeekKey();
  const results = { winback_30: 0, winback_60: 0, skipped: 0, errors: 0 };

  // ── 30-day win-back ───────────────────────────────────────────────────────
  const candidates30 = await getWinBackCandidates("30d", 100);
  for (const candidate of candidates30) {
    try {
      const daysSilent = Math.floor(
        (Date.now() - new Date(candidate.lastReceiptAt).getTime()) / (24 * 60 * 60 * 1000)
      ) as 30 | 60;

      const { subject, html } = buildWinBack30({
        email: candidate.email,
        vehicle: candidate.vehicle,
        daysSilent,
        receiptsGenerated: candidate.receiptsGenerated,
      });

      // Claim the slot before sending — prevents duplicate if send succeeds but upsert would have failed
      await supabase.from("crm_win_back_state").upsert(
        {
          user_id: candidate.userId,
          email: candidate.email,
          winback_30_sent_at: now,
          last_receipt_at: candidate.lastReceiptAt,
        },
        { onConflict: "user_id" }
      );

      const r = await safeSend({
        email: candidate.email,
        userId: candidate.userId,
        sequenceType: "win_back",
        sequenceStep: "winback_30",
        subject,
        html,
        idempotencyKey: `winback:${candidate.userId}:30d:${weekKey}`,
        metadata: { vehicle: candidate.vehicle, last_receipt_at: candidate.lastReceiptAt },
      });

      if (r.sent) {
        results.winback_30++;
      } else if (r.skipped) {
        results.skipped++;
      } else {
        results.errors++;
      }
    } catch (err) {
      results.errors++;
      console.error("[win-back/send] 30d error:", err instanceof Error ? err.message : err);
    }
  }

  // ── 60-day win-back ───────────────────────────────────────────────────────
  const candidates60 = await getWinBackCandidates("60d", 100);
  for (const candidate of candidates60) {
    try {
      const { subject, html } = buildWinBack60({
        email: candidate.email,
        vehicle: candidate.vehicle,
        daysSilent: 60,
        receiptsGenerated: candidate.receiptsGenerated,
      });

      // Claim the slot before sending
      await supabase.from("crm_win_back_state")
        .update({ winback_60_sent_at: now })
        .eq("user_id", candidate.userId);

      const r = await safeSend({
        email: candidate.email,
        userId: candidate.userId,
        sequenceType: "win_back",
        sequenceStep: "winback_60",
        subject,
        html,
        idempotencyKey: `winback:${candidate.userId}:60d:${weekKey}`,
        metadata: { vehicle: candidate.vehicle, last_receipt_at: candidate.lastReceiptAt },
      });

      if (r.sent) {
        results.winback_60++;
      } else if (r.skipped) {
        results.skipped++;
      } else {
        results.errors++;
      }
    } catch (err) {
      results.errors++;
      console.error("[win-back/send] 60d error:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true, timestamp: now, sent: results });
}
