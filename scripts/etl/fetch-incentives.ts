/**
 * ETL Job 1e: IRS + AFDC → data_v2/incentives.json
 *
 * Builds a federal + state EV incentive database combining:
 * 1. IRS Clean Vehicle Credit rules (IRA, effective Aug 16 2022)
 * 2. AFDC state incentive data
 *
 * Federal eligibility rules as of 2025 (update annually):
 * - New EVs: up to $7,500 (50% battery minerals + 50% battery assembly)
 * - Used EVs: $4,000 or 30% of price, max $25k vehicle price, ≥ 2yr old
 * - MSRP caps: Sedans/wagons/hatchbacks ≤ $55k; SUVs/trucks/vans ≤ $80k
 * - Income limits: Single < $150k, HOH < $225k, Joint < $300k (new)
 *                  Single < $75k, HOH < $112.5k, Joint < $150k (used)
 *
 * Run: npx tsx scripts/etl/fetch-incentives.ts
 * Refresh cadence: monthly (IRS rules change; state programs added/removed)
 */

import fs from "fs";
import path from "path";

const OUT_PATH = path.join(process.cwd(), "data_v2", "incentives.json");
const AFDC_INCENTIVES_URL = "https://developer.nrel.gov/api/transportation-incentives-laws/v1.json";

interface AfdcIncentive {
  id: number;
  title: string;
  agency: string;
  type: string;        // "TAX_CREDIT", "REBATE", "GRANT", etc.
  type_name: string;
  categories: string[];
  technologies: string[];
  state: string;       // 2-letter or "Federal"
  is_expired: boolean;
  enacted_date?: string;
  expired_date?: string;
  text?: string;
  amount?: string;
  more_info_url?: string;
}

interface AfdcResponse {
  total: number;
  result: AfdcIncentive[];
}

// ---------- Hardcoded IRA Federal Incentive Rules (2024–2025) ----------
// Source: IRS Notice 2023-29, Rev. Proc. 2022-42, IRS Form 8936
// Update this list annually as assembly/mineral requirements change.
//
// Eligibility determined by:
// - Final assembly in North America (since Aug 16, 2022)
// - Critical mineral sourcing % (escalating through 2029)
// - Battery component manufacturing % (escalating through 2029)
//
// As of 2024 credit eligibility (partial list; update from IRS VIN list):
// https://www.irs.gov/credits-deductions/manufacturers-and-models-for-new-clean-vehicles-purchased-in-2023-2024

interface FederalNewVehicle {
  make: string;
  model: string;
  year_start: number;
  year_end: number | null;
  trim_filter: string | null;
  amount_usd: number;
  msrp_cap: number;    // $55k sedan, $80k SUV/truck
  notes: string;
}

const FEDERAL_NEW_VEHICLES: FederalNewVehicle[] = [
  // Chevrolet
  { make: "Chevrolet", model: "Bolt EV", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 55000, notes: "Assembled in Orion Township, MI" },
  { make: "Chevrolet", model: "Bolt EUV", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Orion Township, MI" },
  { make: "Chevrolet", model: "Equinox EV", year_start: 2024, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Ingersoll, Ontario" },
  { make: "Chevrolet", model: "Blazer EV", year_start: 2024, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Ramos Arizpe, Mexico" },
  // Tesla
  { make: "Tesla", model: "Model 3", year_start: 2023, year_end: null, trim_filter: "RWD", amount_usd: 7500, msrp_cap: 55000, notes: "Rear-wheel drive only (Fremont, CA)" },
  { make: "Tesla", model: "Model Y", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Fremont, CA or Austin, TX" },
  { make: "Tesla", model: "Cybertruck", year_start: 2024, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Austin, TX" },
  // Ford
  { make: "Ford", model: "F-150 Lightning", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Dearborn, MI" },
  { make: "Ford", model: "Mustang Mach-E", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 3750, msrp_cap: 80000, notes: "Assembled in Cuautitlán, Mexico; partial credit" },
  { make: "Ford", model: "E-Transit", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Kansas City, MO" },
  // Volkswagen
  { make: "Volkswagen", model: "ID.4", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Chattanooga, TN (2023+)" },
  // Honda
  { make: "Honda", model: "Prologue", year_start: 2024, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Ramos Arizpe, Mexico" },
  // Cadillac
  { make: "Cadillac", model: "LYRIQ", year_start: 2024, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Spring Hill, TN" },
  { make: "Cadillac", model: "OPTIQ", year_start: 2025, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Mexico" },
  // Chrysler / Stellantis
  { make: "Jeep", model: "Wrangler 4xe", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 3750, msrp_cap: 80000, notes: "PHEV; partial credit" },
  { make: "Jeep", model: "Grand Cherokee 4xe", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 3750, msrp_cap: 80000, notes: "PHEV; partial credit" },
  // GMC
  { make: "GMC", model: "Sierra EV", year_start: 2024, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Detroit, MI" },
  { make: "GMC", model: "Hummer EV", year_start: 2022, year_end: null, trim_filter: null, amount_usd: 7500, msrp_cap: 80000, notes: "Assembled in Detroit, MI; MSRP typically exceeds cap" },
  // Nissan
  { make: "Nissan", model: "LEAF", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 3750, msrp_cap: 55000, notes: "Assembled in Smyrna, TN; partial credit" },
  // Ineligible (foreign assembly or MSRP cap exceeded)
  { make: "Rivian", model: "R1T", year_start: 2023, year_end: 2023, trim_filter: null, amount_usd: 0, msrp_cap: 80000, notes: "MSRP typically exceeds $80k cap" },
  { make: "Rivian", model: "R1S", year_start: 2023, year_end: 2023, trim_filter: null, amount_usd: 0, msrp_cap: 80000, notes: "MSRP typically exceeds $80k cap" },
  { make: "Lucid", model: "Air", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 0, msrp_cap: 55000, notes: "MSRP exceeds $55k sedan cap" },
  { make: "BMW", model: "i4", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 0, msrp_cap: 55000, notes: "Assembled in Germany; not eligible" },
  { make: "Hyundai", model: "IONIQ 5", year_start: 2023, year_end: 2024, trim_filter: null, amount_usd: 0, msrp_cap: 80000, notes: "Assembled in Korea through 2024" },
  { make: "Hyundai", model: "IONIQ 6", year_start: 2023, year_end: 2024, trim_filter: null, amount_usd: 0, msrp_cap: 55000, notes: "Assembled in Korea through 2024" },
  { make: "Kia", model: "EV6", year_start: 2023, year_end: 2024, trim_filter: null, amount_usd: 0, msrp_cap: 55000, notes: "Assembled in Korea through 2024" },
  { make: "Toyota", model: "bZ4X", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 0, msrp_cap: 80000, notes: "Assembled in Japan; not eligible" },
  { make: "Subaru", model: "Solterra", year_start: 2023, year_end: null, trim_filter: null, amount_usd: 0, msrp_cap: 80000, notes: "Assembled in Japan; not eligible" },
];

async function fetchAfdcStateIncentives(apiKey: string | undefined): Promise<AfdcIncentive[]> {
  if (!apiKey) return [];

  const url = `${AFDC_INCENTIVES_URL}?api_key=${apiKey}&type=TAX_CREDIT,REBATE&technology=ELEC&status=ACTIVE`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as AfdcResponse;
    return (data.result ?? []).filter(i => !i.is_expired);
  } catch {
    return [];
  }
}

async function main() {
  const nrelKey = process.env.NREL_API_KEY;
  const today = new Date().toISOString().substring(0, 10);
  const results = [];

  // Build federal new vehicle credits
  for (const v of FEDERAL_NEW_VEHICLES) {
    results.push({
      make: v.make,
      model: v.model,
      year_start: v.year_start,
      year_end: v.year_end,
      trim_filter: v.trim_filter,
      incentive_type: "federal_new",
      state: null,
      amount_usd: v.amount_usd,
      msrp_cap: v.msrp_cap,
      income_cap: 300000, // married filing jointly; most permissive threshold
      eligible_from: "2023-01-01",
      eligible_to: null,
      source_url: "https://www.irs.gov/credits-deductions/manufacturers-and-models-for-new-clean-vehicles-purchased-in-2023-2024",
      last_verified: today,
    });
  }

  // Federal used vehicle credit (§30D(g) — applies to all qualifying used EVs)
  results.push({
    make: "*",
    model: "*",
    year_start: 2019, // vehicle must be ≥2 model years old; 2022 credit for 2019 and older
    year_end: null,
    trim_filter: null,
    incentive_type: "federal_used",
    state: null,
    amount_usd: 4000,
    msrp_cap: 25000,
    income_cap: 150000, // married filing jointly
    eligible_from: "2023-01-01",
    eligible_to: null,
    source_url: "https://www.irs.gov/credits-deductions/used-clean-vehicle-credit",
    last_verified: today,
  });

  // Fetch AFDC state incentives if key available
  if (nrelKey) {
    console.log("🔍 Fetching state incentives from AFDC…");
    const stateIncentives = await fetchAfdcStateIncentives(nrelKey);
    console.log(`  Got ${stateIncentives.length} active state incentives`);

    // Note: AFDC incentives are not vehicle-specific; they apply to all EVs in the state.
    // We include them as wildcard entries — the consuming code should filter by state.
    for (const inc of stateIncentives) {
      if (inc.state === "Federal" || !inc.state) continue;
      const amount = inc.amount ? parseFloat(inc.amount.replace(/[^0-9.]/g, "")) : 0;
      if (!amount) continue;

      results.push({
        make: "*",
        model: "*",
        year_start: 2017,
        year_end: null,
        trim_filter: null,
        incentive_type: inc.type === "TAX_CREDIT" ? "state_new" : "state_new",
        state: inc.state,
        amount_usd: amount,
        msrp_cap: null,
        income_cap: null,
        eligible_from: inc.enacted_date ?? "2022-01-01",
        eligible_to: inc.expired_date ?? null,
        source_url: inc.more_info_url ?? `https://afdc.energy.gov/laws/${inc.id}`,
        last_verified: today,
      });
    }
  } else {
    console.log("ℹ️  No NREL_API_KEY set; skipping AFDC state incentives.");
    console.log("   Register free at https://developer.nrel.gov/signup/");
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✅ Wrote ${results.length} incentive records → ${OUT_PATH}`);
  console.log(`\n⚠️  IMPORTANT: IRS assembly eligibility rules change annually.`);
  console.log(`   Verify the FEDERAL_NEW_VEHICLES list against the current IRS VIN list:`);
  console.log(`   https://www.irs.gov/credits-deductions/manufacturers-and-models-for-new-clean-vehicles-purchased-in-2023-2024`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
