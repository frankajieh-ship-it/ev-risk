/**
 * CRM Email Utilities
 *
 * Shared utilities for all CRM email sequences:
 *   - safeSend(): suppression check + idempotency + send + log
 *   - unsubscribeLink(): per-sequence unsubscribe URL (backward-compatible base64 token)
 *   - emailFooter(): branded footer with unsubscribe link
 *   - emailWrapper(): full HTML document wrapper
 */

import { sendChecklistEmail } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/api-auth";

export type SequenceType =
  | "activation"
  | "win_back"
  | "conversion"
  | "weekly_digest"
  | "deal_watch"
  | "recall";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

// ── Unsubscribe link ─────────────────────────────────────────────────────────
// Uses same base64(email) format as existing nudge/unsubscribe route
// so live emails in inboxes continue to work after the migration.

export function unsubscribeLink(email: string, seq: SequenceType): string {
  const token = Buffer.from(email).toString("base64");
  return `${SITE_URL}/api/email/crm/unsubscribe?token=${encodeURIComponent(token)}&seq=${seq}`;
}

// ── Shared HTML components ───────────────────────────────────────────────────

export function emailFooter(email: string, seq: SequenceType): string {
  const unsub = unsubscribeLink(email, seq);
  return `
  <div style="text-align:center;padding-top:20px;border-top:1px solid #21262d;margin-top:32px;">
    <p style="font-size:12px;color:#8b949e;margin:0;line-height:1.6;">
      Sent by <a href="${SITE_URL}" style="color:#00d97e;text-decoration:none;">OFFO Lab</a>
      &nbsp;&middot;&nbsp;
      <a href="${unsub}" style="color:#8b949e;text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>`;
}

export function emailWrapper(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

// ── safeSend ─────────────────────────────────────────────────────────────────
// Checks suppression → checks daily cap → sends → logs to crm_email_sends.
// The unique idempotency_key constraint prevents double-sends on retry/redeploy.

export interface SafeSendParams {
  email: string;
  userId?: string;
  anonId?: string;
  sequenceType: SequenceType;
  sequenceStep: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface SafeSendResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
}

const DAILY_SEND_CAP = 3;

export async function safeSend(params: SafeSendParams): Promise<SafeSendResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { sent: false, skipped: false, error: "DB not configured" };

  // 1. Check suppression in crm_email_preferences
  const { data: pref } = await supabase
    .from("crm_email_preferences")
    .select("all_marketing, bounced, activation, win_back, conversion, weekly_digest, deal_watch, recall")
    .eq("email", params.email)
    .maybeSingle();

  if (pref) {
    const seqPref = pref[params.sequenceType as keyof typeof pref] as boolean | undefined;
    if (!pref.all_marketing || pref.bounced || seqPref === false) {
      return { sent: false, skipped: true };
    }
  }

  // 2. Check daily send cap (max 3 emails/address/24h)
  const { count } = await supabase
    .from("crm_email_sends")
    .select("id", { count: "exact", head: true })
    .eq("email", params.email)
    .eq("status", "sent")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if ((count ?? 0) >= DAILY_SEND_CAP) {
    return { sent: false, skipped: true };
  }

  // 3. Send via Resend
  const result = await sendChecklistEmail(params.email, params.subject, params.html);

  // 4. Log to crm_email_sends (unique constraint on idempotency_key = dedup on retry)
  const { error: logError } = await supabase.from("crm_email_sends").insert({
    email: params.email,
    user_id: params.userId || null,
    anon_id: params.anonId || null,
    sequence_type: params.sequenceType,
    sequence_step: params.sequenceStep,
    subject: params.subject,
    resend_message_id: result.messageId || null,
    status: result.success ? "sent" : "failed",
    error_message: result.error || null,
    idempotency_key: params.idempotencyKey,
    metadata: params.metadata || null,
  });

  // Unique constraint violation = already sent (race condition or retry) — treat as skipped
  if (logError?.code === "23505") {
    return { sent: false, skipped: true };
  }

  return { sent: result.success, skipped: false, error: result.error };
}

// ── Week key for idempotency ─────────────────────────────────────────────────
// Returns "YYYY-WW" using ISO week number so digest fires once per calendar week.

export function isoWeekKey(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-${String(weekNo).padStart(2, "0")}`;
}
