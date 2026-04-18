/**
 * Curated Deals Ingestion
 *
 * Runs 3× daily (07:00, 13:00, 19:00 UTC) via Netlify scheduled functions.
 *
 * Discovery strategy:
 *   1. Pull recent CarGurus listing URLs from the receipts table (users already
 *      submitted and analyzed these — no scraping needed, no bot walls)
 *   2. Re-analyze any that haven't been seen in 6h, upsert into curated_deals
 *
 * This avoids all scraping complexity while seeding from real, verified listings.
 */

import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const MAX_TOTAL_PER_RUN = 40;

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

interface LiteReceiptResponse {
  success: boolean;
  receipt_id?: string;
  photo_urls?: string[];
  receipt?: {
    verdict?: string;
    evidence_score?: number;
    fit_score?: number;
    why_not_green?: Array<{ points?: number }>;
    vehicle_label?: string;
    vehicle_category?: string;
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

  // --- Step 1: Discover listing URLs from the receipts table ---
  // Pull recently analyzed CarGurus listings that had a full receipt generated.
  // These are real URLs that were successfully scraped already.
  const since7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: receiptRows, error: receiptErr } = await supabase
    .from("receipts")
    .select("listing_url, output_json, created_at")
    .eq("generation_status", "full")
    .ilike("listing_url", "%cargurus.com%")
    .not("listing_url", "is", null)
    .gte("created_at", since7Days)
    .order("created_at", { ascending: false })
    .limit(MAX_TOTAL_PER_RUN * 3); // fetch extras since some will be skipped

  if (receiptErr) {
    console.error("[ingest-curated-deals] Failed to query receipts:", receiptErr.message);
    return;
  }

  if (!receiptRows?.length) {
    console.log("[ingest-curated-deals] No recent CarGurus receipts found — nothing to ingest");
    return;
  }

  // Clean and deduplicate URLs:
  // - Strip query params (tracking noise like srpc=, resultSetId= etc) — the listing ID is in the path
  // - Fix duplicated URLs (some rows store "https://...https://..." due to a sharing bug)
  // - Keep only /details/ paths (individual listings)
  function cleanCarGurusUrl(raw: string): string | null {
    // Fix doubled URLs: "https://x.comhttps://x.com" → take the last valid URL
    const doubled = raw.match(/(https:\/\/[^\s]+)$/);
    const cleaned = doubled ? doubled[1] : raw;
    try {
      const u = new URL(cleaned);
      // Only accept individual listing pages (/details/NNNN)
      if (!u.pathname.match(/^\/details\/\d+/)) return null;
      // Return clean URL with no query params
      return `${u.origin}${u.pathname}`;
    } catch {
      return null;
    }
  }

  const seenUrls = new Map<string, typeof receiptRows[0]>();
  for (const row of receiptRows) {
    const clean = row.listing_url ? cleanCarGurusUrl(row.listing_url) : null;
    if (clean && !seenUrls.has(clean)) {
      seenUrls.set(clean, row);
    }
  }

  const candidateUrls = Array.from(seenUrls.keys());
  console.log(`[ingest-curated-deals] Found ${candidateUrls.length} unique CarGurus URLs from receipts`);

  // --- Step 2: Skip URLs already recently ingested ---
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: recentRows } = await supabase
    .from("curated_deals")
    .select("listing_url")
    .in("listing_url", candidateUrls)
    .gte("last_analyzed_at", sixHoursAgo);

  const recentUrls = new Set((recentRows ?? []).map((r: { listing_url: string }) => r.listing_url));
  const urlsToProcess = candidateUrls.filter((u) => !recentUrls.has(u)).slice(0, MAX_TOTAL_PER_RUN);

  console.log(
    `[ingest-curated-deals] Processing ${urlsToProcess.length} URLs (${recentUrls.size} skipped as recent)`
  );

  if (urlsToProcess.length === 0) {
    console.log("[ingest-curated-deals] Nothing to process this run");
    return;
  }

  let totalProcessed = 0;
  let totalFailed = 0;

  for (const listingUrl of urlsToProcess) {
    try {
      let urlDomain: string | null = null;
      try { urlDomain = new URL(listingUrl).hostname.replace("www.", ""); } catch { /* ignore */ }

      // Re-analyze via receipt API using internal secret header — bypasses token validation,
      // rate limits, and DB writes without needing FLAG_TESTER_ANON_IDS
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

      // Detect sold/gone listings — scraper returned a page with no vehicle data
      if (!r.make && !r.model && !r.price && !r.year) {
        console.log(`[ingest-curated-deals] Listing gone (no vehicle data): ${listingUrl}`);
        await supabase.from("curated_deals").update({ is_active: false }).eq("listing_url", listingUrl);
        continue;
      }

      // Only surface EVs — skip ICE/hybrid vehicles
      const category = r.vehicle_category ?? "";
      if (category && category !== "EV" && category !== "PHEV") {
        console.log(`[ingest-curated-deals] Skipping non-EV (${category}): ${listingUrl}`);
        await supabase.from("curated_deals").update({ is_active: false }).eq("listing_url", listingUrl);
        continue;
      }

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

      const vehicleLabel =
        r.vehicle_label ||
        [r.year, r.make, r.model, r.trim].filter(Boolean).join(" ") ||
        "Electric Vehicle";

      const { error: upsertErr } = await supabase
        .from("curated_deals")
        .upsert({
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
          photo_url: receiptData.photo_urls?.[0] ?? null,
          receipt_id: receiptData.receipt_id ?? null,
          last_analyzed_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          is_active: true,
        }, { onConflict: "listing_url", ignoreDuplicates: false });

      if (upsertErr) {
        console.error(`[ingest-curated-deals] Upsert failed for ${listingUrl}: ${upsertErr.message}`);
        totalFailed++;
      } else {
        console.log(`[ingest-curated-deals] ✓ ${vehicleLabel} → verdict=${verdict} dqs=${dealQualityScore}`);
        totalProcessed++;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ingest-curated-deals] Error processing ${listingUrl}: ${msg}`);
      totalFailed++;
    }
  }

  console.log(
    `[ingest-curated-deals] Done — processed: ${totalProcessed}, failed: ${totalFailed}, skipped: ${recentUrls.size}`
  );
}

export const config: Config = {
  schedule: "0 7,13,19 * * *",
};
