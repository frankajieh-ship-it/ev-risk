/**
 * Scheduled Win-Back Email Sender
 *
 * Runs daily at 11:00 UTC.
 * Calls /api/email/win-back/send to process 30-day and 60-day win-back emails.
 *
 * Note: The 30-day window means no emails will fire for 30 days after first deploy.
 * This is expected — do not backfill retroactively on day 1.
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
    console.error("[send-win-back-emails] ADMIN_API_KEY not set — aborting");
    await alertOps(
      "⚠️ send-win-back-emails: missing ADMIN_API_KEY",
      "The scheduled win-back email job could not run because ADMIN_API_KEY is not set."
    );
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/api/email/win-back/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.error(`[send-win-back-emails] API returned ${response.status}: ${text}`);
      await alertOps(
        `⚠️ send-win-back-emails: HTTP ${response.status}`,
        `The win-back email API returned status ${response.status}. Response: ${text.slice(0, 500)}`
      );
      return;
    }

    const data = await response.json();
    console.log("[send-win-back-emails] Result:", JSON.stringify(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-win-back-emails] Failed:", err);
    await alertOps("⚠️ send-win-back-emails: exception", `The win-back email job threw an exception: ${msg}`);
  }
}

export const config: Config = {
  schedule: "0 11 * * *",
};
