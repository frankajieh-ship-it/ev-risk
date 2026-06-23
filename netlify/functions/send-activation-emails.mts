/**
 * Scheduled Personalized Activation Email Sender
 *
 * Runs daily at 10:30 UTC (offset from send-nudge-emails at 10:00 to avoid overlap).
 * Calls /api/email/activation/send to process pending Day 1, 3, and 7 emails
 * with vehicle/verdict personalization.
 *
 * The activation/send route uses crm_email_sends idempotency keys, so both this
 * function and send-nudge-emails can run simultaneously without double-sending.
 * Once validated over ~1 week, disable send-nudge-emails by removing its schedule.
 */

import type { Config } from "@netlify/functions";
import { Resend } from "resend";

async function alertOps(subject: string, message: string) {
  const key = process.env.RESEND_API_KEY;
  const opsEmail = process.env.OPS_ALERT_EMAIL || "hello@offolab.com";
  if (!key) return;
  try {
    const resend = new Resend(key);
    await resend.emails.send({
      from: "OFFO Alerts <noreply@offolab.com>",
      to: opsEmail,
      subject,
      html: `<p>${message}</p><p><small>Sent from Netlify scheduled function — ${new Date().toISOString()}</small></p>`,
    });
  } catch {
    // Best-effort
  }
}

export default async function handler() {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || "https://offolab.com";
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error("[send-activation-emails] ADMIN_API_KEY not set — aborting");
    await alertOps(
      "⚠️ send-activation-emails: missing ADMIN_API_KEY",
      "The scheduled activation email job could not run because ADMIN_API_KEY is not set."
    );
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/api/email/activation/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.error(`[send-activation-emails] API returned ${response.status}: ${text}`);
      await alertOps(
        `⚠️ send-activation-emails: HTTP ${response.status}`,
        `The activation email API returned status ${response.status}. Response: ${text.slice(0, 500)}`
      );
      return;
    }

    const data = await response.json();
    console.log("[send-activation-emails] Result:", JSON.stringify(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-activation-emails] Failed:", err);
    await alertOps("⚠️ send-activation-emails: exception", `The activation email job threw an exception: ${msg}`);
  }
}

// Paused — no automated emails until sequences are reviewed and approved.
export const config: Config = {};
