/**
 * Post-Purchase Day 7 Scanner
 *
 * Runs daily at 14:00 UTC via Netlify scheduled functions.
 * Calls /api/email/post-purchase-day7/send to find purchases made
 * 6–8 days ago and send the "did you buy it?" check-in email.
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
    console.error("[send-post-purchase-day7] ADMIN_API_KEY not set — aborting");
    await alertOps(
      "⚠️ send-post-purchase-day7: missing ADMIN_API_KEY",
      "The Day 7 post-purchase email could not run because ADMIN_API_KEY is not set."
    );
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/api/email/post-purchase-day7/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.error(`[send-post-purchase-day7] API returned ${response.status}: ${text}`);
      await alertOps(
        `⚠️ send-post-purchase-day7: HTTP ${response.status}`,
        `The Day 7 email API returned status ${response.status}. Response: ${text.slice(0, 500)}`
      );
      return;
    }

    const data = await response.json();
    console.log("[send-post-purchase-day7] Result:", JSON.stringify(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-post-purchase-day7] Failed:", err);
    await alertOps("⚠️ send-post-purchase-day7: exception", `The Day 7 email scan threw an exception: ${msg}`);
  }
}

export const config: Config = {
  schedule: "0 14 * * *",
};
