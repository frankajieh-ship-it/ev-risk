/**
 * Deal Watch Scanner
 *
 * Runs daily at 09:00 UTC via Netlify scheduled functions.
 * Calls /api/email/deal-watch to process pending price-drop alerts.
 */

import type { Config } from "@netlify/functions";

export default async function handler() {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || "https://offolab.com";
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error("[scan-deal-watch] ADMIN_API_KEY not set — aborting");
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

    const data = await response.json();
    console.log("[scan-deal-watch] Result:", JSON.stringify(data));
  } catch (err) {
    console.error("[scan-deal-watch] Failed:", err);
  }
}

export const config: Config = {
  schedule: "0 9 * * *",
};
