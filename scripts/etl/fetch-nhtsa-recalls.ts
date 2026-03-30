/**
 * ETL Job 1c: NHTSA Recalls API → data_v2/recalls_live.json
 *
 * Fetches all recalls for every BEV in vehicle_master.json.
 * Requires vehicle_master.json to exist (run fetch-epa-vehicles.ts first).
 *
 * Run: npx tsx scripts/etl/fetch-nhtsa-recalls.ts
 * Refresh cadence: monthly
 */

import fs from "fs";
import path from "path";

const VEHICLE_MASTER_PATH = path.join(process.cwd(), "data_v2", "vehicle_master.json");
const OUT_PATH = path.join(process.cwd(), "data_v2", "recalls_live.json");
const NHTSA_BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";
const DELAY_MS = 150;

interface VehicleMasterRow {
  make: string;
  model: string;
  year: number;
}

interface NhtsaRecall {
  NHTSACampaignNumber: string;
  Manufacturer: string;
  Make: string;
  Model: string;
  ModelYear: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  ReportReceivedDate: string;
  PotentialNumberOfUnitsAffected?: number;
}

interface NhtsaResponse {
  Count: number;
  Message: string;
  results: NhtsaRecall[];
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchRecalls(make: string, model: string, year: number): Promise<NhtsaRecall[]> {
  const url = `${NHTSA_BASE}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as NhtsaResponse;
    return data.results ?? [];
  } catch {
    return [];
  }
}

async function main() {
  if (!fs.existsSync(VEHICLE_MASTER_PATH)) {
    console.error(`❌ vehicle_master.json not found at ${VEHICLE_MASTER_PATH}`);
    console.error("   Run: npx tsx scripts/etl/fetch-epa-vehicles.ts first");
    process.exit(1);
  }

  const vehicles = JSON.parse(fs.readFileSync(VEHICLE_MASTER_PATH, "utf-8")) as VehicleMasterRow[];

  // Deduplicate make/model/year combos
  const combos = new Map<string, { make: string; model: string; year: number }>();
  for (const v of vehicles) {
    const key = `${v.make}|${v.model}|${v.year}`;
    if (!combos.has(key)) combos.set(key, { make: v.make, model: v.model, year: v.year });
  }

  console.log(`🔍 Fetching recalls for ${combos.size} unique make/model/year combos…`);

  const allRecalls: NhtsaRecall[] = [];
  const seen = new Set<string>();
  let i = 0;

  for (const { make, model, year } of combos.values()) {
    i++;
    if (i % 50 === 0) console.log(`  ${i}/${combos.size} (${allRecalls.length} recalls so far)…`);

    const recalls = await fetchRecalls(make, model, year);
    for (const r of recalls) {
      // Deduplicate by campaign number
      if (!seen.has(r.NHTSACampaignNumber)) {
        seen.add(r.NHTSACampaignNumber);
        allRecalls.push(r);
      }
    }

    await sleep(DELAY_MS);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(allRecalls, null, 2), "utf-8");
  console.log(`\n✅ Wrote ${allRecalls.length} unique recalls → ${OUT_PATH}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
