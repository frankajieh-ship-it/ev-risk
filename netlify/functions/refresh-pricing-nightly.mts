/**
 * Nightly Pricing Insight Refresh
 *
 * Runs daily at 03:00 UTC via Netlify scheduled functions.
 * Refreshes pricing insights for active inventory vehicles that are stale
 * (is_stale = true OR refreshed_at older than 24h). Capped at 50 vehicles
 * per run to stay within Netlify function timeout budget.
 */

import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const MAX_VEHICLES_PER_RUN = 50;

export default async function handler() {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || "https://offolab.com";
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!internalSecret) {
    console.error("[refresh-pricing-nightly] INTERNAL_API_SECRET not set — aborting");
    return;
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error("[refresh-pricing-nightly] Supabase env vars not set — aborting");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Find vehicles needing refresh: stale flag OR refreshed_at > 24h ago
  const { data: staleInsights, error } = await supabase
    .from("pricing_insights")
    .select("vehicle_id, dealership_id, refreshed_at, is_stale")
    .or(`is_stale.eq.true,refreshed_at.lt.${since24h}`)
    .limit(MAX_VEHICLES_PER_RUN);

  if (error) {
    console.error("[refresh-pricing-nightly] Supabase query failed:", error.message);
    return;
  }

  if (!staleInsights?.length) {
    console.log("[refresh-pricing-nightly] No stale pricing insights — nothing to refresh");
    return;
  }

  console.log(`[refresh-pricing-nightly] Refreshing ${staleInsights.length} vehicles`);

  let refreshed = 0;
  let failed = 0;

  for (const insight of staleInsights) {
    try {
      const response = await fetch(
        `${siteUrl}/api/internal/pricing/refresh/${insight.vehicle_id}`,
        {
          method: "POST",
          headers: {
            "x-internal-secret": internalSecret,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        refreshed++;
      } else {
        const body = await response.text();
        console.warn(
          `[refresh-pricing-nightly] Vehicle ${insight.vehicle_id} failed (${response.status}): ${body}`
        );
        failed++;
      }
    } catch (err) {
      console.error(`[refresh-pricing-nightly] Vehicle ${insight.vehicle_id} error:`, err);
      failed++;
    }
  }

  console.log(
    `[refresh-pricing-nightly] Done — refreshed: ${refreshed}, failed: ${failed}, total: ${staleInsights.length}`
  );
}

export const config: Config = {
  schedule: "0 3 * * *",
};
