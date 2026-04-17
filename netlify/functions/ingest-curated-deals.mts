/**
 * Curated Deals Ingestion
 *
 * Runs 3× daily (07:00, 13:00, 19:00 UTC) via Netlify scheduled functions.
 * Auto-discovers individual EV listing URLs from CarGurus search pages,
 * runs OFFO receipt analysis on each, and upserts results into `curated_deals`.
 */

import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Cars.com search pages — server-rendered HTML, no JS required, works without
// ScrapingBee. One search per popular EV model, sorted by best match.
// ---------------------------------------------------------------------------
const SEARCH_PAGES = [
  "https://www.cars.com/shopping/results/?makes[]=tesla&models[]=tesla-model_3&stock_type=used&sort=best_match_desc",
  "https://www.cars.com/shopping/results/?makes[]=tesla&models[]=tesla-model_y&stock_type=used&sort=best_match_desc",
  "https://www.cars.com/shopping/results/?makes[]=chevrolet&models[]=chevrolet-bolt_ev&stock_type=used&sort=best_match_desc",
  "https://www.cars.com/shopping/results/?makes[]=hyundai&models[]=hyundai-ioniq_5&stock_type=used&sort=best_match_desc",
  "https://www.cars.com/shopping/results/?makes[]=hyundai&models[]=hyundai-ioniq_6&stock_type=used&sort=best_match_desc",
  "https://www.cars.com/shopping/results/?makes[]=volkswagen&models[]=volkswagen-id_4&stock_type=used&sort=best_match_desc",
  "https://www.cars.com/shopping/results/?makes[]=ford&models[]=ford-mustang_mach-e&stock_type=used&sort=best_match_desc",
  "https://www.cars.com/shopping/results/?makes[]=kia&models[]=kia-ev6&stock_type=used&sort=best_match_desc",
  "https://www.cars.com/shopping/results/?makes[]=nissan&models[]=nissan-leaf&stock_type=used&sort=best_match_desc",
];

const MAX_LISTINGS_PER_SEARCH_PAGE = 10;
const MAX_TOTAL_PER_RUN = 40;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDealQualityScore(
  evidenceScore: number | null,
  riskPoints: number | null,
  fitScore: number | null
): number {
  const evidence = evidenceScore ?? 50;
  const risk = riskPoints ?? 5;
  const fit = fitScore ?? 50;
  return Math.round(evidence * 0.35 + (10 - risk) * 5 * 0.4 + fit * 0.25);
}

/**
 * Fetch a CarGurus search page via the proxy-fetch endpoint and extract
 * individual listing URLs from the HTML.
 */
async function discoverListingUrls(searchPageUrl: string, siteUrl: string): Promise<string[]> {
  try {
    const proxyRes = await fetch(`${siteUrl}/api/proxy-fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: searchPageUrl, timeout: 20000 }),
      signal: AbortSignal.timeout(25000),
    });

    if (!proxyRes.ok) {
      console.warn(`[discover] proxy-fetch ${proxyRes.status} for ${searchPageUrl}`);
      return [];
    }

    const proxyData = (await proxyRes.json()) as { success?: boolean; html?: string };
    const html = proxyData?.html;
    if (!html || html.length < 1000) {
      console.warn(`[discover] Empty or short HTML for ${searchPageUrl} (${html?.length ?? 0} chars)`);
      return [];
    }

    const urls = new Set<string>();

    // Cars.com: individual listings are at /vehicledetail/{id}/
    // These appear as href="/vehicledetail/12345678abc/" in server-rendered HTML
    const vehicleDetailMatches = html.matchAll(/href="(\/vehicledetail\/[a-z0-9\-]+\/)"/gi);
    for (const m of vehicleDetailMatches) {
      urls.add(`https://www.cars.com${m[1]}`);
      if (urls.size >= MAX_LISTINGS_PER_SEARCH_PAGE) break;
    }

    // Fallback: full cars.com URLs in case of absolute hrefs
    if (urls.size === 0) {
      const absMatches = html.matchAll(/href="(https:\/\/www\.cars\.com\/vehicledetail\/[^"]+)"/gi);
      for (const m of absMatches) {
        urls.add(m[1]);
        if (urls.size >= MAX_LISTINGS_PER_SEARCH_PAGE) break;
      }
    }

    const result = Array.from(urls).slice(0, MAX_LISTINGS_PER_SEARCH_PAGE);
    console.log(`[discover] Found ${result.length} listing URLs from ${searchPageUrl}`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[discover] Error fetching ${searchPageUrl}: ${msg}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiteReceiptResponse {
  success: boolean;
  receipt_id?: string;
  receipt?: {
    verdict?: string;
    evidence_score?: number;
    fit_score?: number;
    why_not_green?: Array<{ points?: number }>;
    photo_url?: string;
    vehicle_label?: string;
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    price?: number;
    mileage?: number;
    location?: string;
    risk_flags?: string[];
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

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

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  let totalProcessed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalDiscovered = 0;

  for (const searchPageUrl of SEARCH_PAGES) {
    if (totalProcessed >= MAX_TOTAL_PER_RUN) {
      console.log(`[ingest-curated-deals] Hit cap of ${MAX_TOTAL_PER_RUN} — stopping`);
      break;
    }

    console.log(`[ingest-curated-deals] Discovering listings from: ${searchPageUrl}`);
    const listingUrls = await discoverListingUrls(searchPageUrl, siteUrl);
    totalDiscovered += listingUrls.length;

    if (listingUrls.length === 0) {
      console.warn(`[ingest-curated-deals] No listings found for ${searchPageUrl}`);
      continue;
    }

    // Check which of these URLs were recently analyzed
    const { data: recentRows } = await supabase
      .from("curated_deals")
      .select("listing_url")
      .in("listing_url", listingUrls)
      .gte("last_analyzed_at", sixHoursAgo);

    const recentUrls = new Set((recentRows ?? []).map((r: { listing_url: string }) => r.listing_url));

    for (const listingUrl of listingUrls) {
      if (totalProcessed >= MAX_TOTAL_PER_RUN) break;

      if (recentUrls.has(listingUrl)) {
        totalSkipped++;
        continue;
      }

      try {
        let urlDomain: string | null = null;
        try { urlDomain = new URL(listingUrl).hostname.replace("www.", ""); } catch { /* ignore */ }

        // Call receipt API — DEAL_WATCH_TOKEN is internal, no rate limiting or DB receipt writes
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
          console.warn(`[ingest-curated-deals] Receipt API ${receiptRes.status} for ${listingUrl}`);
          totalFailed++;
          continue;
        }

        const receiptData = (await receiptRes.json()) as LiteReceiptResponse;
        if (!receiptData.success || !receiptData.receipt) {
          console.warn(`[ingest-curated-deals] No receipt for ${listingUrl}`);
          totalFailed++;
          continue;
        }

        const r = receiptData.receipt;
        const verdict = r.verdict ?? null;

        // Don't surface RED listings
        if (verdict === "RED") {
          console.log(`[ingest-curated-deals] Skipping RED: ${listingUrl}`);
          continue;
        }

        const riskPoints =
          r.why_not_green && r.why_not_green.length > 0
            ? r.why_not_green.reduce((sum: number, f) => sum + (f.points ?? 0), 0)
            : null;

        const dealQualityScore = computeDealQualityScore(
          r.evidence_score ?? null,
          riskPoints,
          r.fit_score ?? null
        );

        // Build vehicle label from structured receipt fields or URL fallback
        const vehicleLabel =
          r.vehicle_label ||
          [r.year, r.make, r.model, r.trim].filter(Boolean).join(" ") ||
          buildVehicleLabelFromUrl(listingUrl);

        const upsertPayload = {
          listing_url: listingUrl,
          url_domain: urlDomain,
          vehicle_label: vehicleLabel,
          year: r.year ?? null,
          make: r.make ?? null,
          model: r.model ?? null,
          trim: r.trim ?? null,
          price: r.price ?? null,
          mileage: r.mileage ?? null,
          location: r.location ?? null,
          verdict: verdict as "GREEN" | "YELLOW" | "RED" | null,
          evidence_score: r.evidence_score ?? null,
          fit_score: r.fit_score ?? null,
          risk_points: riskPoints,
          deal_quality_score: dealQualityScore,
          risk_flags: r.risk_flags ?? null,
          photo_url: r.photo_url ?? null,
          receipt_id: receiptData.receipt_id ?? null,
          last_analyzed_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          is_active: true,
        };

        const { error: upsertErr } = await supabase
          .from("curated_deals")
          .upsert(upsertPayload, { onConflict: "listing_url", ignoreDuplicates: false });

        if (upsertErr) {
          console.error(`[ingest-curated-deals] Upsert failed for ${listingUrl}: ${upsertErr.message}`);
          totalFailed++;
        } else {
          console.log(`[ingest-curated-deals] ✓ ${vehicleLabel} → verdict=${verdict} dqs=${dealQualityScore}`);
          totalProcessed++;
        }

        // Brief delay between receipt API calls
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ingest-curated-deals] Error processing ${listingUrl}: ${msg}`);
        totalFailed++;
      }
    }

    // Delay between search pages
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.log(
    `[ingest-curated-deals] Done — discovered: ${totalDiscovered}, processed: ${totalProcessed}, failed: ${totalFailed}, skipped: ${totalSkipped}`
  );
}

function buildVehicleLabelFromUrl(url: string): string {
  // Cars.com vehicledetail URLs don't encode the model name — return generic label
  // The receipt API will populate the real label from the scraped listing page
  if (url.includes("cars.com/vehicledetail")) return "Used Electric Vehicle";
  const lower = url.toLowerCase();
  if (lower.includes("tesla-model-3")) return "Tesla Model 3";
  if (lower.includes("tesla-model-y")) return "Tesla Model Y";
  if (lower.includes("tesla-model-s")) return "Tesla Model S";
  if (lower.includes("tesla-model-x")) return "Tesla Model X";
  if (lower.includes("bolt-ev") || lower.includes("bolt_ev")) return "Chevrolet Bolt EV";
  if (lower.includes("ioniq-5") || lower.includes("ioniq5")) return "Hyundai IONIQ 5";
  if (lower.includes("ioniq-6") || lower.includes("ioniq6")) return "Hyundai IONIQ 6";
  if (lower.includes("id.4") || lower.includes("id4")) return "Volkswagen ID.4";
  if (lower.includes("mach-e") || lower.includes("mustang")) return "Ford Mustang Mach-E";
  if (lower.includes("ev6")) return "Kia EV6";
  if (lower.includes("leaf")) return "Nissan LEAF";
  if (lower.includes("rivian-r1t") || lower.includes("r1t")) return "Rivian R1T";
  if (lower.includes("bmw-i4") || lower.includes("_i4")) return "BMW i4";
  return "Electric Vehicle";
}

export const config: Config = {
  schedule: "0 7,13,19 * * *",
};
