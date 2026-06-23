/**
 * Scheduled Weekly Digest Sender
 *
 * Runs every Monday at 13:00 UTC (~8-9am US Eastern).
 * Calls /api/email/weekly-digest/send twice to handle up to 400 recipients
 * while staying within the 60s Netlify function timeout.
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
    console.error("[send-weekly-digest] ADMIN_API_KEY not set — aborting");
    await alertOps(
      "⚠️ send-weekly-digest: missing ADMIN_API_KEY",
      "The scheduled weekly digest job could not run because ADMIN_API_KEY is not set."
    );
    return;
  }

  const headers = {
    Authorization: `Bearer ${adminKey}`,
    "Content-Type": "application/json",
  };

  const batchResults: unknown[] = [];

  // Two batches of 200 = up to 400 recipients
  for (const offset of [0, 200]) {
    try {
      const response = await fetch(
        `${siteUrl}/api/email/weekly-digest/send?offset=${offset}&limit=200`,
        { method: "POST", headers }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => "(no body)");
        console.error(`[send-weekly-digest] Batch offset=${offset} returned ${response.status}: ${text}`);
        await alertOps(
          `⚠️ send-weekly-digest: HTTP ${response.status} (offset=${offset})`,
          `Response: ${text.slice(0, 500)}`
        );
        break;
      }

      const data = await response.json();
      batchResults.push(data);
      console.log(`[send-weekly-digest] Batch offset=${offset}:`, JSON.stringify(data));

      // If fewer than 200 recipients returned, no need for a second batch
      if ((data as { sent?: { sent?: number } }).sent?.sent !== undefined) {
        const totalSent = (data as { sent?: { sent?: number; skipped?: number } }).sent;
        if ((totalSent?.sent ?? 0) + (totalSent?.skipped ?? 0) < 200) break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[send-weekly-digest] Batch offset=${offset} failed:`, err);
      await alertOps("⚠️ send-weekly-digest: exception", `Batch offset=${offset} threw: ${msg}`);
      break;
    }
  }

  console.log("[send-weekly-digest] All batches complete:", JSON.stringify(batchResults));
}

// Paused — no automated emails until sequences are reviewed and approved.
export const config: Config = {};
