/**
 * ETL Job 1a: EPA FuelEconomy API → data_v2/vehicle_master.json
 *
 * Fetches all BEV trim-year records from fueleconomy.gov (public, no auth).
 * Run: npx tsx scripts/etl/fetch-epa-vehicles.ts
 *
 * Refresh cadence: quarterly
 */

import fs from "fs";
import path from "path";

const OUT_PATH = path.join(process.cwd(), "data_v2", "vehicle_master.json");
const EPA_BASE = "https://fueleconomy.gov/ws/rest";
const YEARS = Array.from({ length: 10 }, (_, i) => 2017 + i); // 2017–2026
const DELAY_MS = 100;

interface EpaVehicleDetail {
  id: number;
  make: string;
  model: string;
  year: number;
  trany: string;
  drive: string;
  fuelType1: string;
  fuelType2?: string;
  rangeA?: number;       // EPA range (BEV)
  charge240?: number;    // DCFC kW (sometimes; may be AC)
  charge240b?: number;   // onboard AC kW
  co2TailpipeAGpm?: number;
  VClass?: string;
  startStop?: string;
  phevBlended?: boolean;
}

interface EpaMenuOption {
  value: string; // vehicle ID as string
  text: string;  // trim label
}

interface EpaMenuMake { value: string; text: string }
interface EpaMenuModel { value: string; text: string }

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Map EPA fuelType1 values that indicate pure BEV
const BEV_FUEL_TYPES = new Set(["Electricity", "Electric"]);

// Infer battery chemistry heuristically (mirrors lib/data.ts:inferBatteryChemistry)
function inferChemistry(make: string, model: string, year: number): string {
  const m = `${make} ${model}`.toLowerCase();
  if (m.includes("tesla")) {
    if ((m.includes("model 3") || m.includes("model y")) && year >= 2021) {
      if (m.includes("standard") || m.includes("rwd")) return "LFP";
      return "NMC811";
    }
    if (m.includes("model s") || m.includes("model x")) return year >= 2021 ? "NMC811" : "NCA";
  }
  if (m.includes("byd")) return "LFP";
  if (m.includes("rivian") && m.includes("standard")) return "LFP";
  if (m.includes("lucid") || (m.includes("rivian") && m.includes("max"))) return "NMC811";
  return "NMC";
}

// Rough federal incentive eligibility based on IRA rules (simplified; update manually for assembly rules)
function federalIncentive(make: string, model: string, year: number, msrp: number | null): {
  incentive_federal: number;
  incentive_eligible: boolean;
  incentive_expiry: string | null;
} {
  // IRA took effect Aug 16 2022 — only applies to 2023+ model year purchases in practice
  if (year < 2023) {
    return { incentive_federal: 7500, incentive_eligible: true, incentive_expiry: "2022-12-31" };
  }
  const m = `${make} ${model}`.toLowerCase();
  // Known fully-ineligible (foreign assembly / above MSRP cap) — incomplete, update via fetch-incentives.ts
  const ineligible = ["rivian r1t", "rivian r1s", "lucid air"];
  if (ineligible.some(v => m.includes(v))) {
    return { incentive_federal: 0, incentive_eligible: false, incentive_expiry: null };
  }
  // Tesla MSRP caps: sedan ≤$55k, SUV/truck ≤$80k
  if (m.includes("tesla model s") && (msrp ?? 0) > 55000) {
    return { incentive_federal: 0, incentive_eligible: false, incentive_expiry: null };
  }
  return { incentive_federal: 7500, incentive_eligible: true, incentive_expiry: null };
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  const today = new Date().toISOString().substring(0, 10);
  const results: object[] = [];
  const seen = new Set<number>();

  for (const year of YEARS) {
    console.log(`\n📅 Year ${year}…`);

    const makesData = await getJson<{ menuItem: EpaMenuMake[] | EpaMenuMake }>(
      `${EPA_BASE}/vehicle/menu/make?year=${year}`
    );
    if (!makesData?.menuItem) continue;
    const makeItems: EpaMenuMake[] = Array.isArray(makesData.menuItem)
      ? makesData.menuItem
      : [makesData.menuItem as EpaMenuMake];

    for (const makeItem of makeItems) {
      const make = makeItem.text.trim();
      await sleep(DELAY_MS);

      const modelsData = await getJson<{ menuItem: EpaMenuModel[] | EpaMenuModel }>(
        `${EPA_BASE}/vehicle/menu/model?year=${year}&make=${encodeURIComponent(make)}`
      );
      if (!modelsData?.menuItem) continue;
      const modelItems: EpaMenuModel[] = Array.isArray(modelsData.menuItem)
        ? modelsData.menuItem
        : [modelsData.menuItem as EpaMenuModel];

      for (const modelItem of modelItems) {
        const model = modelItem.text.trim();
        await sleep(DELAY_MS);

        const optionsData = await getJson<{ menuItem: EpaMenuOption[] | EpaMenuOption | string }>(
          `${EPA_BASE}/vehicle/menu/options?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
        );
        if (!optionsData?.menuItem) continue;
        // EPA API sometimes returns a single object instead of an array
        const optionItems: EpaMenuOption[] = Array.isArray(optionsData.menuItem)
          ? optionsData.menuItem
          : typeof optionsData.menuItem === "object"
            ? [optionsData.menuItem as EpaMenuOption]
            : [];
        if (optionItems.length === 0) continue;

        for (const opt of optionItems) {
          const vehicleId = parseInt(opt.value);
          if (isNaN(vehicleId) || seen.has(vehicleId)) continue;
          seen.add(vehicleId);

          await sleep(DELAY_MS);
          const detail = await getJson<EpaVehicleDetail>(`${EPA_BASE}/vehicle/${vehicleId}`);
          if (!detail) continue;

          // BEV filter
          if (!BEV_FUEL_TYPES.has(detail.fuelType1 ?? "")) continue;
          if (detail.phevBlended) continue; // PHEV blended — skip

          const epaRange = detail.rangeA ? Number(detail.rangeA) : null;
          const dcFast = detail.charge240 ? Number(detail.charge240) : null;
          const acKw = detail.charge240b ? Number(detail.charge240b) : null;
          const chemistry = inferChemistry(make, model, year);
          const incentiveInfo = federalIncentive(make, model, year, null);

          results.push({
            make,
            model,
            year: detail.year ?? year,
            trim: opt.text.trim(),
            vin_pattern: null,
            battery_kwh: null,
            chemistry,
            dc_fast_kw: dcFast,
            onboard_ac_kw: acKw,
            epa_range_mi: epaRange,
            real_world_range_mi: epaRange ? Math.round(epaRange * 0.85) : null,
            delta_percent: epaRange ? -15 : null, // default -15% until test data available
            msrp_usd: null,
            ...incentiveInfo,
            data_source: "epa_api",
            last_updated: today,
          });
        }
      }
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✅ Wrote ${results.length} BEV trim-year records → ${OUT_PATH}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
