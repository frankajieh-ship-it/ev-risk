/**
 * Dealer Cold Outreach Scheduler
 *
 * Runs daily at 15:00 UTC (offset from other daily senders).
 * Calls /api/email/dealer-cold-outreach/send to:
 *   - Send intro emails to new prospects
 *   - Send 7-day follow-ups to prospects who got an intro but haven't signed up
 *
 * Volume is intentionally capped at 50 prospects/day in the route handler
 * to keep outreach warm and avoid spam filters.
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
    console.error("[send-dealer-cold-outreach] ADMIN_API_KEY not set — aborting");
    await alertOps(
      "⚠️ send-dealer-cold-outreach: missing ADMIN_API_KEY",
      "Dealer cold outreach could not run because ADMIN_API_KEY is not set."
    );
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/api/email/dealer-cold-outreach/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.error(`[send-dealer-cold-outreach] API returned ${response.status}: ${text}`);
      await alertOps(
        `⚠️ send-dealer-cold-outreach: HTTP ${response.status}`,
        `Response: ${text.slice(0, 500)}`
      );
      return;
    }

    const data = await response.json();
    console.log("[send-dealer-cold-outreach] Result:", JSON.stringify(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-dealer-cold-outreach] Failed:", err);
    await alertOps("⚠️ send-dealer-cold-outreach: exception", `Dealer outreach scan threw: ${msg}`);
  }
}

export const config: Config = {
  schedule: "0 15 * * *", // 3pm UTC daily
};
