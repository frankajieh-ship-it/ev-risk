/**
 * Deal Watch Scanner
 *
 * Runs daily at 09:00 UTC via Netlify scheduled functions.
 * Calls /api/email/deal-watch to process pending price-drop alerts.
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
    console.error("[scan-deal-watch] ADMIN_API_KEY not set — aborting");
    await alertOps("⚠️ scan-deal-watch: missing ADMIN_API_KEY", "The scheduled deal-watch scan could not run because ADMIN_API_KEY is not set in the Netlify environment.");
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/api/email/deal-watch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.error(`[scan-deal-watch] API returned ${response.status}: ${text}`);
      await alertOps(
        `⚠️ scan-deal-watch: HTTP ${response.status}`,
        `The deal-watch API returned status ${response.status}. Response: ${text.slice(0, 500)}`
      );
      return;
    }

    const data = await response.json();
    console.log("[scan-deal-watch] Result:", JSON.stringify(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[scan-deal-watch] Failed:", err);
    await alertOps("⚠️ scan-deal-watch: exception", `The deal-watch scan threw an exception: ${msg}`);
  }
}

// Paused — no automated emails until sequences are reviewed and approved.
export const config: Config = {};
