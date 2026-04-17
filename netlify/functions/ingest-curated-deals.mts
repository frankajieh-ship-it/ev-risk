/**
 * Curated Deals Ingestion
 *
 * Runs 3× daily (07:00, 13:00, 19:00 UTC) via Netlify scheduled functions.
 * Scrapes a seed list of individual EV listing URLs, runs OFFO receipt analysis
 * on each one, and upserts results into the `curated_deals` table.
 *
 * Phase 1: seed list of hardcoded CarGurus + Cars.com individual listing URLs.
 * Future phases: automated search-page scraping to discover new listings.
 */

import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Seed list — individual EV listing URLs to analyze each run.
// Keep to ~30 URLs; stale/sold listings will naturally score low or 404.
// Replace URLs periodically as listings sell.
// ---------------------------------------------------------------------------
const SEED_URLS: string[] = [
  // Tesla Model 3
  "https://www.cargurus.com/Cars/new/nl_Tesla-Model-3_d2388",
  "https://www.cars.com/research/tesla-model_3/",
  // Tesla Model Y
  "https://www.cargurus.com/Cars/new/nl_Tesla-Model-Y_d2403",
  // Chevrolet Bolt EV
  "https://www.cargurus.com/Cars/new/nl_Chevrolet-Bolt-EV_d2360",
  "https://www.cars.com/research/chevrolet-bolt_ev/",
  // Hyundai Ioniq 5
  "https://www.cargurus.com/Cars/new/nl_Hyundai-IONIQ-5_d2441",
  // Hyundai Ioniq 6
  "https://www.cargurus.com/Cars/new/nl_Hyundai-IONIQ-6_d2479",
  // Volkswagen ID.4
  "https://www.cargurus.com/Cars/new/nl_Volkswagen-ID.4_d2432",
  // Ford Mustang Mach-E
  "https://www.cargurus.com/Cars/new/nl_Ford-Mustang-Mach-E_d2419",
  // Kia EV6
  "https://www.cargurus.com/Cars/new/nl_Kia-EV6_d2452",
  // Nissan Leaf
  "https://www.cargurus.com/Cars/new/nl_Nissan-LEAF_d1921",
  // BMW i4
  "https://www.cargurus.com/Cars/new/nl_BMW-i4_d2467",
  // Rivian R1T
  "https://www.cargurus.com/Cars/new/nl_Rivian-R1T_d2430",
];

// Deal quality scoring formula (mirrors plan spec)
function computeDealQualityScore(
  evidenceScore: number | null,
  riskPoints: number | null,
  fitScore: number | null
): number {
  const evidence = evidenceScore ?? 50;
  const risk = riskPoints ?? 5;
  const fit = fitScore ?? 50;
  return Math.round(
    evidence * 0.35 + (10 - risk) * 5 * 0.4 + fit * 0.25
  );
}

interface LiteReceiptResponse {
  success: boolean;
  receipt_id?: string;
  receipt?: {
    verdict?: string;
    evidence_score?: number;
    fit_score?: number;
    // V2 scoring stores risk_points in why_not_green or scoring_reasons
    why_not_green?: Array<{ points?: number }>;
    photo_url?: string;
  };
  generation_status?: string;
}

export default async function handler() {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || "https://offolab.com";
  const dealWatchToken = process.env.DEAL_WATCH_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dealWatchToken) {
    console.error("[ingest-curated-deals] DEAL_WATCH_TOKEN not set — aborting");
    return;
  }
  if (!supabaseUrl || !supabaseKey) {
    console.error("[ingest-curated-deals] Supabase env vars not set — aborting");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- Check which URLs were recently analyzed (< 6h) so we skip them ---
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: recentRows } = await supabase
    .from("curated_deals")
    .select("listing_url, last_analyzed_at")
    .in("listing_url", SEED_URLS)
    .gte("last_analyzed_at", sixHoursAgo);

  const recentUrls = new Set((recentRows ?? []).map((r: { listing_url: string }) => r.listing_url));

  const urlsToProcess = SEED_URLS.filter((url) => !recentUrls.has(url));
  console.log(
    `[ingest-curated-deals] ${urlsToProcess.length} URLs to process (${recentUrls.size} skipped as recently analyzed)`
  );

  if (urlsToProcess.length === 0) {
    console.log("[ingest-curated-deals] Nothing to do this run");
    return;
  }

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const listingUrl of urlsToProcess) {
    try {
      // 1. Extract URL domain for display
      let urlDomain: string | null = null;
      try {
        urlDomain = new URL(listingUrl).hostname.replace("www.", "");
      } catch {
        // ignore
      }

      // 2. Call the receipt API (autofill + rule-based analysis)
      //    Using DEAL_WATCH_TOKEN which is an internal tester — no DB writes, no rate limiting
      const receiptRes = await fetch(`${siteUrl}/api/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_url: listingUrl,
          receipt_token: dealWatchToken,
          mode: "single",
          region: "US",
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!receiptRes.ok) {
        console.warn(
          `[ingest-curated-deals] Receipt API ${receiptRes.status} for ${listingUrl}`
        );
        failed++;
        continue;
      }

      const receiptData = (await receiptRes.json()) as LiteReceiptResponse;
      if (!receiptData.success || !receiptData.receipt) {
        console.warn(`[ingest-curated-deals] No receipt returned for ${listingUrl}`);
        failed++;
        continue;
      }

      const r = receiptData.receipt;
      const verdict = r.verdict ?? null;

      // Skip RED verdicts — don't surface actively bad listings
      if (verdict === "RED") {
        console.log(`[ingest-curated-deals] Skipping RED verdict: ${listingUrl}`);
        continue;
      }

      // 3. Compute risk_points from why_not_green sum if present
      const riskPoints =
        r.why_not_green && r.why_not_green.length > 0
          ? r.why_not_green.reduce((sum: number, f) => sum + (f.points ?? 0), 0)
          : null;

      const dealQualityScore = computeDealQualityScore(
        r.evidence_score ?? null,
        riskPoints,
        r.fit_score ?? null
      );

      // 4. Upsert into curated_deals
      //    We don't have structured vehicle fields from the lite receipt API response
      //    (those live in the receipt output_json). For Phase 1, use the URL domain
      //    and a placeholder vehicle_label until the fetch route is integrated.
      //    The receipt_id links to the full receipt if saved.
      const vehicleLabel = buildVehicleLabel(listingUrl);

      const upsertPayload = {
        listing_url: listingUrl,
        url_domain: urlDomain,
        vehicle_label: vehicleLabel,
        verdict: verdict as "GREEN" | "YELLOW" | "RED" | null,
        evidence_score: r.evidence_score ?? null,
        fit_score: r.fit_score ?? null,
        risk_points: riskPoints,
        deal_quality_score: dealQualityScore,
        photo_url: r.photo_url ?? null,
        receipt_id: receiptData.receipt_id ?? null,
        last_analyzed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        is_active: true,
      };

      const { error: upsertErr, data: upsertData } = await supabase
        .from("curated_deals")
        .upsert(upsertPayload, {
          onConflict: "listing_url",
          ignoreDuplicates: false,
        })
        .select("id")
        .single();

      if (upsertErr) {
        console.error(
          `[ingest-curated-deals] Upsert failed for ${listingUrl}:`,
          upsertErr.message
        );
        failed++;
      } else {
        console.log(
          `[ingest-curated-deals] Upserted ${listingUrl} → verdict=${verdict} dqs=${dealQualityScore} id=${upsertData?.id}`
        );
        // Distinguish insert vs update (Supabase doesn't expose this directly)
        inserted++;
      }

      // Small delay between requests to avoid hammering the receipt API
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ingest-curated-deals] Error processing ${listingUrl}: ${msg}`);
      failed++;
    }
  }

  console.log(
    `[ingest-curated-deals] Run complete — processed: ${inserted + updated}, failed: ${failed}, skipped: ${recentUrls.size}`
  );
}

/**
 * Derive a human-readable vehicle label from the listing URL for Phase 1.
 * Phase 2 will populate this from scraped vehicle data.
 */
function buildVehicleLabel(url: string): string {
  const lower = url.toLowerCase();

  if (lower.includes("tesla-model-3") || lower.includes("tesla_model-3")) return "Tesla Model 3";
  if (lower.includes("tesla-model-y") || lower.includes("tesla_model-y")) return "Tesla Model Y";
  if (lower.includes("tesla-model-s") || lower.includes("tesla_model-s")) return "Tesla Model S";
  if (lower.includes("tesla-model-x") || lower.includes("tesla_model-x")) return "Tesla Model X";
  if (lower.includes("bolt-ev") || lower.includes("bolt_ev")) return "Chevrolet Bolt EV";
  if (lower.includes("ioniq-5") || lower.includes("ioniq_5") || lower.includes("ioniq5")) return "Hyundai IONIQ 5";
  if (lower.includes("ioniq-6") || lower.includes("ioniq_6") || lower.includes("ioniq6")) return "Hyundai IONIQ 6";
  if (lower.includes("id.4") || lower.includes("id4")) return "Volkswagen ID.4";
  if (lower.includes("mach-e") || lower.includes("mach_e") || lower.includes("mustang")) return "Ford Mustang Mach-E";
  if (lower.includes("ev6")) return "Kia EV6";
  if (lower.includes("leaf")) return "Nissan LEAF";
  if (lower.includes("i4")) return "BMW i4";
  if (lower.includes("r1t")) return "Rivian R1T";
  if (lower.includes("r1s")) return "Rivian R1S";

  // Fallback: extract from URL path
  try {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    if (segments.length > 0) {
      return segments[segments.length - 1]
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .slice(0, 60);
    }
  } catch {
    // ignore
  }

  return "Electric Vehicle";
}

export const config: Config = {
  schedule: "0 7,13,19 * * *",
};
