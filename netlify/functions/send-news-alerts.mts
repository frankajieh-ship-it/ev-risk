/**
 * Scheduled News Alert Sender
 *
 * Runs daily at 09:00 UTC — after the news ingestion pipeline has had time
 * to score overnight articles (ingest typically completes by 08:00 UTC).
 *
 * Calls /api/email/news-alerts/send which:
 *   1. Finds all high-impact articles from the last 24h
 *   2. Matches each article to users' saved garage vehicle listings
 *   3. Sends standalone recall emails + batched digest emails
 *   4. Marks dispatched articles in news_alert_dispatches (dedup)
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
    console.error("[send-news-alerts] ADMIN_API_KEY not set — aborting");
    await alertOps(
      "⚠️ send-news-alerts: missing ADMIN_API_KEY",
      "The scheduled news alert job could not run because ADMIN_API_KEY is not set."
    );
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/api/email/news-alerts/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.error(`[send-news-alerts] API returned ${response.status}: ${text}`);
      await alertOps(
        `⚠️ send-news-alerts: HTTP ${response.status}`,
        `The news alert API returned status ${response.status}. Response: ${text.slice(0, 500)}`
      );
      return;
    }

    const data = await response.json();
    console.log("[send-news-alerts] Result:", JSON.stringify(data));

    // Alert ops if any errors occurred
    const totalErrors = (data.recall_emails?.errors ?? 0) + (data.digest_emails?.errors ?? 0);
    if (totalErrors > 0) {
      await alertOps(
        `⚠️ send-news-alerts: ${totalErrors} send errors`,
        `News alert job completed with ${totalErrors} errors. Full result: ${JSON.stringify(data)}`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-news-alerts] Failed:", err);
    await alertOps("⚠️ send-news-alerts: exception", `The news alert job threw an exception: ${msg}`);
  }
}

export const config: Config = {
  schedule: "0 9 * * *",
};
