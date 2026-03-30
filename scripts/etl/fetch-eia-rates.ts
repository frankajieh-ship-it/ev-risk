/**
 * ETL Job 1f: EIA API → data_v2/electricity_rates.json
 *
 * Fetches residential electricity rates (cents/kWh) for all 50 US states + DC
 * from the EIA Open Data API v2.
 *
 * Requires: EIA_API_KEY env var (free at eia.gov/opendata)
 * Run: npx tsx scripts/etl/fetch-eia-rates.ts
 * Refresh cadence: annually
 */

import fs from "fs";
import path from "path";

const OUT_PATH = path.join(process.cwd(), "data_v2", "electricity_rates.json");
const EIA_BASE = "https://api.eia.gov/v2/electricity/retail-sales/data/";

const US_STATES = [
  "AK", "AL", "AR", "AZ", "CA", "CO", "CT", "DC", "DE", "FL",
  "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY", "LA", "MA",
  "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE",
  "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY",
];

// Known off-peak EV TOU rates (manually curated from utility tariffs, cents/kWh)
// Sources: PG&E E-ELEC, SCE TOU-EV-7, ConEd EV SmartCharge, etc.
const KNOWN_TOU_RATES: Record<string, number> = {
  CA: 13.5,
  NY: 11.2,
  WA: 5.8,
  OR: 8.4,
  CO: 9.1,
  IL: 10.3,
  MA: 14.2,
  TX: 8.9,
  FL: 9.6,
  NV: 10.1,
};

interface EiaDataPoint {
  period: string;    // YYYY
  stateid: string;
  sectorid: string;
  "sales-units": string;
  "revenue-units": string;
  price: number;     // cents/kWh
}

interface EiaResponse {
  response: {
    total: number;
    data: EiaDataPoint[];
  };
}

async function fetchStateRate(apiKey: string, state: string): Promise<number | null> {
  // Query residential sector, annual frequency, most recent period
  const url = new URL(EIA_BASE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("frequency", "annual");
  url.searchParams.set("data[0]", "price");
  url.searchParams.set("facets[stateid][]", state);
  url.searchParams.set("facets[sectorid][]", "RES"); // residential
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.set("length", "1");

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as EiaResponse;
    const row = data.response?.data?.[0];
    if (row?.price == null) return null;
    return parseFloat(String(row.price));
  } catch {
    return null;
  }
}

async function main() {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    console.error("❌ EIA_API_KEY env var required. Get free key at https://www.eia.gov/opendata/");
    process.exit(1);
  }

  console.log("⚡ Fetching electricity rates from EIA…");

  const today = new Date().toISOString().substring(0, 10);
  const currentYear = new Date().getFullYear();
  const results = [];

  for (const state of US_STATES) {
    process.stdout.write(`  ${state}… `);
    const rateCents = await fetchStateRate(apiKey, state);

    if (rateCents === null) {
      console.log("⚠️  no data");
      continue;
    }

    console.log(`${rateCents.toFixed(1)} ¢/kWh`);

    results.push({
      state,
      residential_kwh_cents: Math.round(rateCents * 10) / 10,
      ev_tou_kwh_cents: KNOWN_TOU_RATES[state] ?? null,
      year: currentYear - 1, // EIA data lags ~1 year
      source: "eia_api",
      last_updated: today,
    });

    // Small delay to be polite
    await new Promise(r => setTimeout(r, 80));
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✅ Wrote ${results.length} state electricity rates → ${OUT_PATH}`);
  console.log(`\n💡 To improve EV TOU rate coverage, update KNOWN_TOU_RATES in this script`);
  console.log(`   and add utility-specific off-peak rates per utility tariff filings.`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
