/**
 * Garage Price Drop Scanner
 *
 * Runs daily at 11:00 UTC via Netlify scheduled functions.
 * Calls /api/email/garage-price-drop/send to check garage vehicles for price drops
 * and send alerts when a listing drops more than 3% since the user saved it.
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
    console.error("[scan-garage-prices] ADMIN_API_KEY not set — aborting");
    await alertOps(
      "⚠️ scan-garage-prices: missing ADMIN_API_KEY",
      "The scheduled garage price scan could not run because ADMIN_API_KEY is not set."
    );
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/api/email/garage-price-drop/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.error(`[scan-garage-prices] API returned ${response.status}: ${text}`);
      await alertOps(
        `⚠️ scan-garage-prices: HTTP ${response.status}`,
        `The garage price-drop API returned status ${response.status}. Response: ${text.slice(0, 500)}`
      );
      return;
    }

    const data = await response.json();
    console.log("[scan-garage-prices] Result:", JSON.stringify(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[scan-garage-prices] Failed:", err);
    await alertOps("⚠️ scan-garage-prices: exception", `The garage price scan threw an exception: ${msg}`);
  }
}

export const config: Config = {
  schedule: "0 11 * * *",
};
