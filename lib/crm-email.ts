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
  | "recall"
  | "listing_gone"
  | "lead_notification"
  | "welcome"
  | "dealer_acquisition"
  | "post_purchase_day7";

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
    .select("all_marketing, bounced, activation, win_back, conversion, weekly_digest, deal_watch, recall, listing_gone, welcome, dealer_acquisition, post_purchase_day7")
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

// ── Lead notification email (dealer receives when buyer submits inquiry) ─────

const SITE_URL_INTERNAL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export interface LeadNotificationParams {
  dealerEmail: string;
  dealerName: string;
  buyerName: string;
  vehicleLabel: string;
  message: string;
  inquiryType: string;
  inquiryId: string;
}

export async function sendLeadNotification(params: LeadNotificationParams): Promise<SafeSendResult> {
  const { dealerEmail, dealerName, buyerName, vehicleLabel, message, inquiryType, inquiryId } = params;
  const ctaUrl = `${SITE_URL_INTERNAL}/dealer/inquiries`;
  const typeLabel = inquiryType === "test_drive" ? "Test drive request"
    : inquiryType === "price_check" ? "Price check"
    : inquiryType === "trade_in" ? "Trade-in inquiry"
    : "General inquiry";

  const html = emailWrapper(`
    <div style="background:#161b22;border-radius:12px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">New Lead</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${vehicleLabel || "Inquiry"}</p>
    </div>
    <p style="font-size:14px;color:#c9d1d9;margin:0 0 16px;">
      <strong style="color:#ffffff;">${buyerName}</strong> sent a new inquiry to <strong style="color:#ffffff;">${dealerName}</strong>.
    </p>
    <div style="background:#161b22;border:1px solid #21262d;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:0.05em;">Type</p>
      <p style="margin:0 0 14px;font-size:14px;color:#e6edf3;">${typeLabel}</p>
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
      <p style="margin:0;font-size:14px;color:#e6edf3;white-space:pre-wrap;">${message.slice(0, 300)}${message.length > 300 ? "…" : ""}</p>
    </div>
    <a href="${ctaUrl}" style="display:inline-block;background:#00d97e;color:#0d1117;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">
      View &amp; Reply in Dashboard →
    </a>
    ${emailFooter(dealerEmail, "lead_notification")}
  `);

  return safeSend({
    email: dealerEmail,
    sequenceType: "lead_notification",
    sequenceStep: "initial",
    subject: `New buyer inquiry: ${vehicleLabel || "your inventory"}`,
    html,
    idempotencyKey: `inquiry-${inquiryId}-lead`,
    metadata: { inquiry_id: inquiryId, dealer_name: dealerName },
  });
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
