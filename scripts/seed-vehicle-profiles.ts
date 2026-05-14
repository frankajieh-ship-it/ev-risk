/**
 * Seed vehicle_profiles table from range_delta.csv
 *
 * Transforms precision CSV data into band-based profiles.
 * Run: npx tsx scripts/seed-vehicle-profiles.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { parse as csvParse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load env
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface CsvRow {
  model: string;
  year: string;
  epa_range_mi: string;
  real_world_range_mi: string;
  delta_percent: string;
  chemistry: string;
  battery_kwh: string;
}

function inferBands(row: CsvRow) {
  const realRange = parseInt(row.real_world_range_mi);
  const batteryKwh = parseFloat(row.battery_kwh);
  const efficiency = realRange / batteryKwh;

  // Range band: <200mi = low, 200-300 = medium, >300 = high
  const usable_range_band =
    realRange < 200 ? "low" : realRange < 300 ? "medium" : "high";

  // DC fast band: kWh<70 = slow, 70-90 = okay, >90 = strong
  const dc_fast_band =
    batteryKwh < 70 ? "slow" : batteryKwh < 90 ? "okay" : "strong";

  // AC home charge band: smaller batteries charge proportionally faster
  const ac_home_charge_band =
    batteryKwh < 60 ? "strong" : batteryKwh < 85 ? "okay" : "slow";

  // Winter sensitivity: LFP = mild, NMC = moderate, NMC811 = strong
  const winter_sensitivity_band =
    row.chemistry === "LFP"
      ? "mild"
      : row.chemistry === "NMC811"
        ? "strong"
        : "moderate";

  // Efficiency band: mi/kWh <3.0 = low, 3.0-3.5 = medium, >3.5 = high
  const efficiency_band =
    efficiency < 3.0 ? "low" : efficiency < 3.5 ? "medium" : "high";

  return {
    usable_range_band,
    dc_fast_band,
    ac_home_charge_band,
    winter_sensitivity_band,
    efficiency_band,
  };
}

function parseModelName(fullModel: string): { make: string; model: string } {
  // Known make prefixes (longest first to avoid partial matches)
  const makes = [
    "Ford Mustang",
    "Ford F-150",
    "Ford Focus",
    "Tesla Model",
    "Tesla Cybertruck",
    "Chevrolet Bolt",
    "Hyundai Ioniq",
    "Hyundai Kona",
    "Genesis GV",
    "Genesis G",
    "Kia Soul",
    "Kia EV",
    "Kia",
    "Volkswagen",
    "Nissan",
    "Rivian",
    "BMW",
    "Mercedes",
    "Cadillac",
    "Volvo",
    "Porsche",
    "Lucid",
    "Polestar",
    "Honda",
    "Subaru",
    "Toyota",
    "Mini",
    "Audi",
    "Ford",
    "Chevrolet",
    "Hyundai",
  ];

  for (const prefix of makes) {
    if (fullModel.startsWith(prefix)) {
      // For entries like "Tesla Model 3 Long Range" → make: Tesla, model: Model 3 Long Range
      const make = prefix.split(" ")[0];
      const model = fullModel.slice(make.length).trim();
      return { make, model };
    }
  }

  // Fallback: first word is make, rest is model
  const parts = fullModel.split(" ");
  return { make: parts[0], model: parts.slice(1).join(" ") };
}

async function main() {
  const force = process.argv.includes("--force");

  const csvPath = resolve(__dirname, "../data_v1.0/range_delta.csv");
  const csvContent = readFileSync(csvPath, "utf-8");

  const rows: CsvRow[] = csvParse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    // Skip comment lines
    comment: "#",
  });

  console.log(`Parsed ${rows.length} rows from range_delta.csv`);
  if (force) console.log("--force: will overwrite existing rows");

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const { make, model } = parseModelName(row.model);
    const bands = inferBands(row);

    const isTesla = make === "Tesla";
    const connector_types = isTesla ? ["NACS"] : ["CCS"];

    const record = {
      year: parseInt(row.year),
      make,
      model,
      epa_range_mi: parseInt(row.epa_range_mi),
      real_world_range_mi: parseInt(row.real_world_range_mi),
      usable_range_mi_estimate: parseInt(row.real_world_range_mi),
      battery_kwh: parseFloat(row.battery_kwh),
      chemistry: row.chemistry,
      connector_types,
      data_source: "range_delta_csv",
      is_active: true,
      ...bands,
    };

    if (force) {
      // Overwrite everything — upsert by (year, make, model)
      const { error } = await supabase
        .from("vehicle_profiles")
        .upsert(record, { onConflict: "year,make,model" });
      if (error) {
        console.error(`Error upserting ${row.model}:`, error.message);
      } else {
        upserted++;
        console.log(`  [upsert] ${make} ${model} (${row.year})`);
      }
    } else {
      // Default: insert only if not already present (check by year+make+model)
      const { data: existing } = await supabase
        .from("vehicle_profiles")
        .select("id")
        .eq("year", record.year)
        .eq("make", record.make)
        .eq("model", record.model)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("vehicle_profiles").insert(record);
      if (error) {
        console.error(`Error inserting ${row.model}:`, error.message);
      } else {
        upserted++;
        console.log(
          `  [new] ${make} ${model} (${row.year}) — range: ${bands.usable_range_band}, winter: ${bands.winter_sensitivity_band}`
        );
      }
    }
  }

  console.log(`\nDone: ${upserted} added/updated, ${skipped} already existed.`);
  console.log("Tip: run with --force to overwrite all existing rows.");
}

main().catch(console.error);
