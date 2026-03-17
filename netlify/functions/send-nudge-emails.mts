/**
 * Scheduled Email Nudge Sender
 *
 * Runs daily at 10:00 UTC via Netlify scheduled functions.
 * Calls the internal /api/email/nudge/send endpoint to process
 * pending Day 1, Day 3, and Day 7 nudge emails.
 */

import type { Config } from "@netlify/functions";

export default async function handler() {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || "https://offolab.com";
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error("[send-nudge-emails] ADMIN_API_KEY not set — aborting");
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

    const data = await response.json();
    console.log("[send-nudge-emails] Result:", JSON.stringify(data));
  } catch (err) {
    console.error("[send-nudge-emails] Failed to call send API:", err);
  }
}

export const config: Config = {
  schedule: "0 10 * * *",
};
