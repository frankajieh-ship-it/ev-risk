/**
 * Scheduled Conversion Email Sender
 *
 * Runs every 4 hours to catch the 2h checkout-abandoned window within 2 checks max.
 * Also handles the 24h paywall-dismissed follow-up.
 *
 * Calls /api/email/conversion/send.
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
    console.error("[send-conversion-emails] ADMIN_API_KEY not set — aborting");
    await alertOps(
      "⚠️ send-conversion-emails: missing ADMIN_API_KEY",
      "The scheduled conversion email job could not run because ADMIN_API_KEY is not set."
    );
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/api/email/conversion/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.error(`[send-conversion-emails] API returned ${response.status}: ${text}`);
      await alertOps(
        `⚠️ send-conversion-emails: HTTP ${response.status}`,
        `The conversion email API returned status ${response.status}. Response: ${text.slice(0, 500)}`
      );
      return;
    }

    const data = await response.json();
    console.log("[send-conversion-emails] Result:", JSON.stringify(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-conversion-emails] Failed:", err);
    await alertOps("⚠️ send-conversion-emails: exception", `The conversion email job threw an exception: ${msg}`);
  }
}

// Paused — no automated emails until sequences are reviewed and approved.
export const config: Config = {};
