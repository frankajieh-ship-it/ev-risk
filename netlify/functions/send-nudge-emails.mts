/**
 * Scheduled Email Nudge Sender
 *
 * Runs daily at 10:00 UTC via Netlify scheduled functions.
 * Calls the internal /api/email/nudge/send endpoint to process
 * pending Day 1, Day 3, and Day 7 nudge emails.
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
    // Best-effort — don't throw from alerting code
  }
}

export default async function handler() {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || "https://offolab.com";
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error("[send-nudge-emails] ADMIN_API_KEY not set — aborting");
    await alertOps("⚠️ send-nudge-emails: missing ADMIN_API_KEY", "The scheduled nudge email job could not run because ADMIN_API_KEY is not set in the Netlify environment.");
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/api/email/nudge/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.error(`[send-nudge-emails] API returned ${response.status}: ${text}`);
      await alertOps(
        `⚠️ send-nudge-emails: HTTP ${response.status}`,
        `The nudge email API returned status ${response.status}. Response: ${text.slice(0, 500)}`
      );
      return;
    }

    const data = await response.json();
    console.log("[send-nudge-emails] Result:", JSON.stringify(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-nudge-emails] Failed to call send API:", err);
    await alertOps("⚠️ send-nudge-emails: exception", `The nudge email job threw an exception: ${msg}`);
  }
}

export const config: Config = {
  schedule: "0 10 * * *",
};
