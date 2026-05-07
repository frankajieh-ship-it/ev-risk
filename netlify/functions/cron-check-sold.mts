/**
 * Netlify Scheduled Function: Check Sold Listings
 *
 * Runs once daily at 6am UTC. Calls /api/admin/deals-check-sold to deactivate
 * any curated deals whose listing pages have been sold or removed.
 */

import type { Config } from "@netlify/functions";

export default async function handler() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "https://offolab.com").replace(/\/$/, "");
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error("[cron-check-sold] ADMIN_API_KEY not set — aborting");
    return;
  }

  console.log("[cron-check-sold] Starting daily sold-listing check...");

  try {
    const res = await fetch(`${siteUrl}/api/admin/deals-check-sold`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminKey}` },
      signal: AbortSignal.timeout(55000),
    });

    const data = await res.json() as { ok?: boolean; message?: string };
    console.log(`[cron-check-sold] Response: ${JSON.stringify(data)}`);
  } catch (err) {
    console.error("[cron-check-sold] Failed:", err instanceof Error ? err.message : err);
  }
}

export const config: Config = {
  schedule: "0 6 * * *",
};
