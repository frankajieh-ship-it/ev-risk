/**
 * Curated Deals Ingestion
 *
 * Runs 3× daily (07:00, 13:00, 19:00 UTC) via Netlify scheduled functions.
 *
 * Discovery strategy:
 *   1. Pull recent CarGurus, Cars.com, and AutoTrader URLs from the receipts table
 *      (users already submitted and analyzed these — no scraping, no bot walls)
 *   2. Supplemental: use Auto.dev to find EVs by VIN, cross-reference against
 *      existing receipts to discover listing URLs not yet in curated_deals
 *   3. Re-analyze any that haven't been seen in 6h, upsert into curated_deals
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
  // Pull recently analyzed listings from CarGurus, Cars.com, and AutoTrader.
  // These are real URLs already successfully scraped by users — no bot walls.
  const since7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  async function fetchReceiptUrls(domainPattern: string) {
    const { data, error } = await supabase
      .from("receipts")
      .select("listing_url, output_json, created_at")
      .eq("generation_status", "full")
      .ilike("listing_url", `%${domainPattern}%`)
      .not("listing_url", "is", null)
      .gte("created_at", since7Days)
      .order("created_at", { ascending: false })
      .limit(MAX_TOTAL_PER_RUN * 3);
    if (error) console.warn(`[ingest-curated-deals] Failed to query receipts for ${domainPattern}:`, error.message);
    return data ?? [];
  }

  // URL cleaners — each enforces individual listing page format
  function cleanCarGurusUrl(raw: string): string | null {
    // Fix doubled URLs: "https://x.comhttps://x.com" → take the last valid URL
    const doubled = raw.match(/(https:\/\/[^\s]+)$/);
    const cleaned = doubled ? doubled[1] : raw;
    try {
      const u = new URL(cleaned);
      if (!u.pathname.match(/^\/details\/\d+/)) return null;
      return `${u.origin}${u.pathname}`;
    } catch { return null; }
  }

  function cleanCarsDotComUrl(raw: string): string | null {
    try {
      const u = new URL(raw);
      if (!u.hostname.includes("cars.com")) return null;
      if (!u.pathname.match(/^\/vehicledetail\/\d+/)) return null;
      return `${u.origin}${u.pathname}`;
    } catch { return null; }
  }

  function cleanAutoTraderUrl(raw: string): string | null {
    try {
      const u = new URL(raw);
      if (!u.hostname.includes("autotrader.com")) return null;
      if (!u.pathname.includes("vehicledetails")) return null;
      const listingId = u.searchParams.get("listingId");
      if (!listingId) return null;
      return `${u.origin}${u.pathname}?listingId=${listingId}`;
    } catch { return null; }
  }

  const [carGurusRows, carsDotComRows, autoTraderRows] = await Promise.all([
    fetchReceiptUrls("cargurus.com"),
    fetchReceiptUrls("cars.com"),
    fetchReceiptUrls("autotrader.com"),
  ]);

  // Merge and deduplicate across all sources
  const seenUrls = new Map<string, (typeof carGurusRows)[0]>();

  const addRows = (rows: typeof carGurusRows, cleaner: (url: string) => string | null) => {
    for (const row of rows) {
      const clean = row.listing_url ? cleaner(row.listing_url) : null;
      if (clean && !seenUrls.has(clean)) seenUrls.set(clean, row);
    }
  };

  addRows(carGurusRows, cleanCarGurusUrl);
  addRows(carsDotComRows, cleanCarsDotComUrl);
  addRows(autoTraderRows, cleanAutoTraderUrl);

  const candidateUrls = Array.from(seenUrls.keys());
  console.log(
    `[ingest-curated-deals] Found ${candidateUrls.length} unique URLs ` +
    `(CarGurus: ${carGurusRows.length}, Cars.com: ${carsDotComRows.length}, AutoTrader: ${autoTraderRows.length})`
  );

  if (!candidateUrls.length) {
    console.log("[ingest-curated-deals] No recent receipts found — nothing to ingest");
    return;
  }

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

  // --- Supplemental: Auto.dev proactive EV discovery ---
  // Search Auto.dev for recent used EV listings by popular makes.
  // For each listing that has a VIN also present in our receipts table,
  // trigger a fresh re-analysis so the deal surfaces on the next ingest cycle.
  const autoDevKey = process.env.AUTODEV_API;
  if (!autoDevKey) return;

  const EV_MAKES = ["Tesla", "Chevrolet", "Hyundai", "Kia", "Ford", "Volkswagen", "Nissan", "BMW", "Rivian"];
  const supplementalUrls: string[] = [];

  for (const evMake of EV_MAKES) {
    try {
      const qs = new URLSearchParams({ make: evMake, limit: "15" });
      const res = await fetch(`https://auto.dev/api/listings?${qs}`, {
        headers: { Authorization: `Bearer ${autoDevKey}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const data = await res.json() as { records?: Array<{ vin?: string }> };
      const vins = (data.records ?? []).map((r) => r.vin).filter((v): v is string => !!v);
      if (!vins.length) continue;

      // Find receipts for these VINs with a usable listing URL not already ingested
      const { data: vinReceipts } = await supabase
        .from("receipts")
        .select("listing_url")
        .eq("generation_status", "full")
        .in("vin", vins)
        .not("listing_url", "is", null)
        .limit(10);

      for (const row of vinReceipts ?? []) {
        if (!row.listing_url) continue;
        const clean =
          cleanCarGurusUrl(row.listing_url) ??
          cleanCarsDotComUrl(row.listing_url) ??
          cleanAutoTraderUrl(row.listing_url);
        if (!clean || recentUrls.has(clean) || candidateUrls.includes(clean)) continue;
        supplementalUrls.push(clean);
      }
    } catch { /* non-critical */ }
  }

  console.log(`[ingest-curated-deals] Auto.dev supplemental: ${supplementalUrls.length} new listing URLs discovered`);

  // Process supplemental URLs (up to 10 extra per run, with same delay)
  for (const listingUrl of supplementalUrls.slice(0, 10)) {
    try {
      let urlDomain: string | null = null;
      try { urlDomain = new URL(listingUrl).hostname.replace("www.", ""); } catch { /* ignore */ }

      const receiptRes = await fetch(`${siteUrl}/api/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_url: listingUrl, receipt_token: dealWatchToken, mode: "single", region: "US" }),
        signal: AbortSignal.timeout(30000),
      });
      if (!receiptRes.ok) continue;
      const receiptData = (await receiptRes.json()) as LiteReceiptResponse;
      if (!receiptData.success || !receiptData.receipt) continue;

      const r = receiptData.receipt;
      if (!r.make && !r.model && !r.price && !r.year) continue;
      const category = r.vehicle_category ?? "";
      if (category && category !== "EV" && category !== "PHEV") continue;
      if (r.verdict === "RED") continue;

      const riskPoints = r.why_not_green?.length
        ? r.why_not_green.reduce((sum: number, f) => sum + (f.points ?? 0), 0)
        : null;
      const dealQualityScore = computeDealQualityScore(r.evidence_score ?? null, riskPoints, r.fit_score ?? null);
      const vehicleLabel = r.vehicle_label || [r.year, r.make, r.model, r.trim].filter(Boolean).join(" ") || "Electric Vehicle";

      await supabase.from("curated_deals").upsert({
        listing_url: listingUrl, url_domain: urlDomain, vehicle_label: vehicleLabel,
        year: r.year ?? null, make: r.make ?? null, model: r.model ?? null, trim: r.trim ?? null,
        price: r.price ?? null, mileage: r.mileage ?? null, location: r.location ?? null,
        verdict: r.verdict as "GREEN" | "YELLOW" | "RED" | null,
        evidence_score: r.evidence_score ?? null, fit_score: r.fit_score ?? null,
        risk_points: riskPoints, deal_quality_score: dealQualityScore,
        risk_flags: r.risk_flags ?? null, photo_url: receiptData.photo_urls?.[0] ?? null,
        receipt_id: receiptData.receipt_id ?? null,
        last_analyzed_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), is_active: true,
      }, { onConflict: "listing_url", ignoreDuplicates: false });

      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch { /* non-critical */ }
  }
}

export const config: Config = {
  schedule: "0 7,13,19 * * *",
};
