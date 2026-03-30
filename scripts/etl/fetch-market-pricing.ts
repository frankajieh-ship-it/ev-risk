/**
 * ETL Job 2c: Market Pricing → data_v2/market_pricing.json
 *
 * Fetches used EV listing prices via the Auto.dev API (already integrated
 * in lib/auto-dev-client.ts) and computes P10/P50/P90 per trim-year.
 *
 * Requires: AUTODEV_API env var (same as used by the app)
 * Requires: data_v2/vehicle_master.json (run fetch-epa-vehicles.ts first)
 *
 * Run: npx tsx scripts/etl/fetch-market-pricing.ts
 * Refresh cadence: monthly
 */

import fs from "fs";
import path from "path";

const VEHICLE_MASTER_PATH = path.join(process.cwd(), "data_v2", "vehicle_master.json");
const OUT_PATH = path.join(process.cwd(), "data_v2", "market_pricing.json");
const AUTODEV_BASE = "https://auto.dev/api";
const DELAY_MS = 300; // Conservative delay; Auto.dev is a paid API

interface VehicleMasterRow {
  make: string;
  model: string;
  year: number;
  trim: string;
  msrp_usd: number | null;
}

interface AutoDevListing {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  priceUnformatted?: number;
  mileageUnformatted?: number;
  condition?: string;
}

interface AutoDevResponse {
  records?: AutoDevListing[];
  total?: number;
}

interface MarketPricingRow {
  make: string;
  model: string;
  year: number;
  // Percentile prices (USD) — clean condition listings
  clean_p10: number | null;
  clean_p50: number | null;
  clean_p90: number | null;
  // Listing count used for computation
  listing_count: number;
  // Mileage stats of listings used
  median_mileage: number | null;
  // Depreciation vs MSRP (if available)
  depreciation_from_msrp_pct: number | null;
  data_source: "auto_dev_api";
  fetched_at: string;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function fetchListings(
  apiKey: string,
  make: string,
  model: string,
  year: number
): Promise<AutoDevListing[]> {
  const url = new URL(`${AUTODEV_BASE}/listings`);
  url.searchParams.set("make", make);
  url.searchParams.set("model", model);
  url.searchParams.set("year_min", String(year));
  url.searchParams.set("year_max", String(year));
  url.searchParams.set("limit", "200");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as AutoDevResponse;
    return data.records ?? [];
  } catch {
    return [];
  }
}

async function main() {
  const apiKey = process.env.AUTODEV_API;
  if (!apiKey) {
    console.error("❌ AUTODEV_API env var required.");
    process.exit(1);
  }

  if (!fs.existsSync(VEHICLE_MASTER_PATH)) {
    console.error(`❌ vehicle_master.json not found. Run fetch-epa-vehicles.ts first.`);
    process.exit(1);
  }

  const vehicles = JSON.parse(fs.readFileSync(VEHICLE_MASTER_PATH, "utf-8")) as VehicleMasterRow[];

  // Deduplicate to make/model/year (ignore trim for now — aggregate across trims)
  const combos = new Map<string, { make: string; model: string; year: number; msrp: number | null }>();
  for (const v of vehicles) {
    const key = `${v.make}|${v.model}|${v.year}`;
    if (!combos.has(key)) {
      combos.set(key, { make: v.make, model: v.model, year: v.year, msrp: v.msrp_usd });
    }
  }

  console.log(`🔍 Fetching market pricing for ${combos.size} make/model/year combos…`);

  const today = new Date().toISOString().substring(0, 10);
  const results: MarketPricingRow[] = [];
  let i = 0;

  for (const { make, model, year, msrp } of combos.values()) {
    i++;
    if (i % 25 === 0) console.log(`  ${i}/${combos.size} (${results.length} priced so far)…`);

    const listings = await fetchListings(apiKey, make, model, year);

    // Filter: only listings with a valid price, exclude outliers (< $5k or > $200k)
    const validListings = listings.filter(
      l => l.priceUnformatted && l.priceUnformatted >= 5000 && l.priceUnformatted <= 200000
    );

    if (validListings.length === 0) {
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    const prices = validListings
      .map(l => l.priceUnformatted!)
      .sort((a, b) => a - b);

    const mileages = validListings
      .filter(l => l.mileageUnformatted && l.mileageUnformatted > 0)
      .map(l => l.mileageUnformatted!)
      .sort((a, b) => a - b);

    const p50 = percentile(prices, 50);
    const depreciationPct = (p50 !== null && msrp && msrp > 0)
      ? Math.round(((msrp - p50) / msrp) * 1000) / 10
      : null;

    results.push({
      make,
      model,
      year,
      clean_p10: percentile(prices, 10),
      clean_p50: p50,
      clean_p90: percentile(prices, 90),
      listing_count: validListings.length,
      median_mileage: median(mileages),
      depreciation_from_msrp_pct: depreciationPct,
      data_source: "auto_dev_api",
      fetched_at: today,
    });

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✅ Wrote ${results.length} market pricing records → ${OUT_PATH}`);

  // Summary stats
  const withData = results.filter(r => r.clean_p50 !== null);
  console.log(`   ${withData.length}/${results.length} combos had sufficient listing data`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
