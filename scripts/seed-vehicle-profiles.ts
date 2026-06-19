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
  msrp_usd?: string;
  dc_fast_kw?: string;
}

// Phase 1: static spec overrides keyed by "make|model_prefix"
// body_type: suv | sedan | hatchback | crossover | truck | van | coupe
// has_heat_pump: true only when factory-confirmed (not all trims/years)
interface SpecOverride {
  body_type: string;
  seating_capacity: number;
  has_heat_pump: boolean;
  towing_capacity_lbs?: number;
  // Phase 2 rich specs
  drivetrain?: "awd" | "rwd" | "fwd";
  cargo_volume_cuft?: number;
  charge_time_l2_hours?: number;
  front_legroom_in?: number;
  rear_legroom_in?: number;
  has_ac?: boolean;
  has_power_windows?: boolean;
  has_power_locks?: boolean;
  has_power_steering?: boolean;
  has_keyless_entry?: boolean;
  has_alarm?: boolean;
  has_satellite_radio?: boolean;
  has_dual_airbags?: boolean;
  has_side_airbags?: boolean;
  has_abs?: boolean;
  has_carplay?: boolean;
  has_android_auto?: boolean;
  exterior_colors?: string[];
  interior_colors?: string[];
  // Phase 2b additional specs
  has_tilt_wheel?: boolean;
  has_am_fm_radio?: boolean;
  has_immobilizer?: boolean;
  has_active_seatbelts?: boolean;
  has_passenger_airbag?: boolean;
  doors?: number;
}

const SPEC_OVERRIDES: Array<{ matchMake: string; matchModel: string; specs: SpecOverride }> = [
  // fmt: body_type, seating, heat_pump, [towing], drivetrain, cargo_cuft, charge_l2_h, f_leg, r_leg, carplay, android_auto, alarm, satellite
  { matchMake: "Tesla",      matchModel: "Model 3",        specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: true,  drivetrain: "awd", cargo_volume_cuft: 15.1, charge_time_l2_hours: 7.5, front_legroom_in: 42.7, rear_legroom_in: 35.2, has_carplay: false, has_android_auto: false, has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Tesla",      matchModel: "Model Y",        specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: true,  towing_capacity_lbs: 3500,  drivetrain: "awd", cargo_volume_cuft: 68.0, charge_time_l2_hours: 8.0, front_legroom_in: 41.8, rear_legroom_in: 40.5, has_carplay: false, has_android_auto: false, has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Tesla",      matchModel: "Model S",        specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: true,  drivetrain: "awd", cargo_volume_cuft: 28.0, charge_time_l2_hours: 9.0, front_legroom_in: 42.7, rear_legroom_in: 35.4, has_carplay: false, has_android_auto: false, has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Tesla",      matchModel: "Model X",        specs: { body_type: "suv",       seating_capacity: 7, has_heat_pump: true,  towing_capacity_lbs: 5000,  drivetrain: "awd", cargo_volume_cuft: 88.1, charge_time_l2_hours: 9.0, front_legroom_in: 41.7, rear_legroom_in: 36.1, has_carplay: false, has_android_auto: false, has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Tesla",      matchModel: "Cybertruck",     specs: { body_type: "truck",     seating_capacity: 5, has_heat_pump: true,  towing_capacity_lbs: 11000, drivetrain: "awd", cargo_volume_cuft: 58.0, charge_time_l2_hours: 10.0, front_legroom_in: 42.5, rear_legroom_in: 39.0, has_carplay: false, has_android_auto: false, has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Chevrolet",  matchModel: "Bolt EV",        specs: { body_type: "hatchback", seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 16.9, charge_time_l2_hours: 7.0, front_legroom_in: 43.1, rear_legroom_in: 36.5, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Chevrolet",  matchModel: "Bolt EUV",       specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 16.3, charge_time_l2_hours: 7.0, front_legroom_in: 43.1, rear_legroom_in: 39.1, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Chevrolet",  matchModel: "Equinox",        specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 57.0, charge_time_l2_hours: 7.5, front_legroom_in: 41.0, rear_legroom_in: 39.5, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Chevrolet",  matchModel: "Blazer",         specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 64.2, charge_time_l2_hours: 7.5, front_legroom_in: 41.5, rear_legroom_in: 39.0, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Ford",       matchModel: "Mustang Mach-E", specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, towing_capacity_lbs: 3500,  drivetrain: "rwd", cargo_volume_cuft: 29.7, charge_time_l2_hours: 8.5, front_legroom_in: 41.4, rear_legroom_in: 38.1, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Ford",       matchModel: "F-150 Lightning", specs: { body_type: "truck",    seating_capacity: 5, has_heat_pump: false, towing_capacity_lbs: 10000, drivetrain: "awd", cargo_volume_cuft: 55.0, charge_time_l2_hours: 10.0, front_legroom_in: 43.9, rear_legroom_in: 43.6, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Ford",       matchModel: "Focus Electric",  specs: { body_type: "hatchback", seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 14.7, charge_time_l2_hours: 6.0, front_legroom_in: 41.7, rear_legroom_in: 33.2, has_carplay: false, has_android_auto: false, has_alarm: false, has_satellite_radio: false } },
  { matchMake: "Hyundai",    matchModel: "Ioniq 5",        specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: true,  drivetrain: "awd", cargo_volume_cuft: 27.2, charge_time_l2_hours: 7.0, front_legroom_in: 42.3, rear_legroom_in: 42.0, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Hyundai",    matchModel: "Ioniq 6",        specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: true,  drivetrain: "awd", cargo_volume_cuft: 11.1, charge_time_l2_hours: 6.5, front_legroom_in: 44.0, rear_legroom_in: 38.5, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Hyundai",    matchModel: "Ioniq Electric", specs: { body_type: "hatchback", seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 23.0, charge_time_l2_hours: 4.5, front_legroom_in: 41.6, rear_legroom_in: 36.1, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: false } },
  { matchMake: "Hyundai",    matchModel: "Kona",           specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 19.2, charge_time_l2_hours: 6.5, front_legroom_in: 41.5, rear_legroom_in: 38.0, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Kia",        matchModel: "EV6",            specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: true,  towing_capacity_lbs: 2300,  drivetrain: "awd", cargo_volume_cuft: 24.4, charge_time_l2_hours: 6.5, front_legroom_in: 42.4, rear_legroom_in: 38.4, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Kia",        matchModel: "EV9",            specs: { body_type: "suv",       seating_capacity: 7, has_heat_pump: true,  towing_capacity_lbs: 5000,  drivetrain: "awd", cargo_volume_cuft: 20.0, charge_time_l2_hours: 8.5, front_legroom_in: 43.1, rear_legroom_in: 44.1, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Kia",        matchModel: "Soul EV",        specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 24.2, charge_time_l2_hours: 9.5, front_legroom_in: 41.5, rear_legroom_in: 37.8, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: false } },
  { matchMake: "Volkswagen", matchModel: "ID.4",           specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "rwd", cargo_volume_cuft: 30.3, charge_time_l2_hours: 7.5, front_legroom_in: 41.1, rear_legroom_in: 39.6, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Volkswagen", matchModel: "ID.Buzz",        specs: { body_type: "van",       seating_capacity: 7, has_heat_pump: false, drivetrain: "rwd", cargo_volume_cuft: 37.8, charge_time_l2_hours: 8.0, front_legroom_in: 41.5, rear_legroom_in: 38.5, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Volkswagen", matchModel: "e-Golf",         specs: { body_type: "hatchback", seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 22.8, charge_time_l2_hours: 5.0, front_legroom_in: 41.5, rear_legroom_in: 35.6, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: false } },
  { matchMake: "Nissan",     matchModel: "Leaf",           specs: { body_type: "hatchback", seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 23.6, charge_time_l2_hours: 8.0, front_legroom_in: 43.7, rear_legroom_in: 33.5, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Nissan",     matchModel: "Ariya",          specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 22.4, charge_time_l2_hours: 8.0, front_legroom_in: 42.5, rear_legroom_in: 40.4, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Rivian",     matchModel: "R1T",            specs: { body_type: "truck",     seating_capacity: 5, has_heat_pump: false, towing_capacity_lbs: 11000, drivetrain: "awd", cargo_volume_cuft: 53.0, charge_time_l2_hours: 10.0, front_legroom_in: 42.6, rear_legroom_in: 39.9, has_carplay: true,  has_android_auto: true,  has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Rivian",     matchModel: "R1S",            specs: { body_type: "suv",       seating_capacity: 7, has_heat_pump: false, towing_capacity_lbs: 7700,  drivetrain: "awd", cargo_volume_cuft: 105.0, charge_time_l2_hours: 10.0, front_legroom_in: 42.6, rear_legroom_in: 38.7, has_carplay: true,  has_android_auto: true,  has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "BMW",        matchModel: "iX",             specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 35.5, charge_time_l2_hours: 9.0, front_legroom_in: 41.4, rear_legroom_in: 37.6, has_carplay: true,  has_android_auto: false, has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "BMW",        matchModel: "i4",             specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: false, drivetrain: "rwd", cargo_volume_cuft: 16.5, charge_time_l2_hours: 8.5, front_legroom_in: 41.4, rear_legroom_in: 35.2, has_carplay: true,  has_android_auto: false, has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "BMW",        matchModel: "i5",             specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: false, drivetrain: "rwd", cargo_volume_cuft: 14.6, charge_time_l2_hours: 8.5, front_legroom_in: 42.0, rear_legroom_in: 37.0, has_carplay: true,  has_android_auto: false, has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Mercedes",   matchModel: "EQS",            specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 22.0, charge_time_l2_hours: 9.0, front_legroom_in: 44.3, rear_legroom_in: 40.5, has_carplay: true,  has_android_auto: true,  has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Mercedes",   matchModel: "EQE",            specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 13.0, charge_time_l2_hours: 9.0, front_legroom_in: 43.7, rear_legroom_in: 37.4, has_carplay: true,  has_android_auto: true,  has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Lucid",      matchModel: "Air",            specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 32.0, charge_time_l2_hours: 10.0, front_legroom_in: 44.5, rear_legroom_in: 38.0, has_carplay: true,  has_android_auto: true,  has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Polestar",   matchModel: "2",              specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 14.3, charge_time_l2_hours: 8.0, front_legroom_in: 42.5, rear_legroom_in: 35.4, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Polestar",   matchModel: "Polestar 2",     specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 14.3, charge_time_l2_hours: 8.0, front_legroom_in: 42.5, rear_legroom_in: 35.4, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Honda",      matchModel: "Prologue",       specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 40.5, charge_time_l2_hours: 7.5, front_legroom_in: 40.9, rear_legroom_in: 40.0, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Genesis",    matchModel: "GV60",           specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: true,  drivetrain: "awd", cargo_volume_cuft: 24.4, charge_time_l2_hours: 6.5, front_legroom_in: 42.0, rear_legroom_in: 38.5, has_carplay: true,  has_android_auto: true,  has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Genesis",    matchModel: "GV70",           specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: true,  towing_capacity_lbs: 2866,  drivetrain: "awd", cargo_volume_cuft: 29.0, charge_time_l2_hours: 7.0, front_legroom_in: 42.0, rear_legroom_in: 37.9, has_carplay: true,  has_android_auto: true,  has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Subaru",     matchModel: "Solterra",       specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 27.7, charge_time_l2_hours: 7.5, front_legroom_in: 41.4, rear_legroom_in: 37.4, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Toyota",     matchModel: "bZ4X",           specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 27.7, charge_time_l2_hours: 7.5, front_legroom_in: 41.9, rear_legroom_in: 38.6, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Cadillac",   matchModel: "Lyriq",          specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "rwd", cargo_volume_cuft: 28.6, charge_time_l2_hours: 8.0, front_legroom_in: 42.0, rear_legroom_in: 39.0, has_carplay: true,  has_android_auto: true,  has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Volvo",      matchModel: "XC40",           specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 20.0, charge_time_l2_hours: 8.0, front_legroom_in: 41.2, rear_legroom_in: 36.6, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Volvo",      matchModel: "C40",            specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 14.3, charge_time_l2_hours: 8.0, front_legroom_in: 41.2, rear_legroom_in: 34.7, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: true  } },
  { matchMake: "Porsche",    matchModel: "Taycan",         specs: { body_type: "sedan",     seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 16.6, charge_time_l2_hours: 9.5, front_legroom_in: 42.5, rear_legroom_in: 33.0, has_carplay: true,  has_android_auto: false, has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Audi",       matchModel: "Q4",             specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 25.0, charge_time_l2_hours: 8.5, front_legroom_in: 41.1, rear_legroom_in: 38.8, has_carplay: true,  has_android_auto: true,  has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Audi",       matchModel: "Q8",             specs: { body_type: "suv",       seating_capacity: 5, has_heat_pump: false, drivetrain: "awd", cargo_volume_cuft: 33.6, charge_time_l2_hours: 9.5, front_legroom_in: 41.9, rear_legroom_in: 38.6, has_carplay: true,  has_android_auto: true,  has_alarm: true,  has_satellite_radio: true  } },
  { matchMake: "Mini",       matchModel: "Cooper SE",      specs: { body_type: "hatchback", seating_capacity: 4, has_heat_pump: false, drivetrain: "fwd", cargo_volume_cuft: 8.7,  charge_time_l2_hours: 4.0, front_legroom_in: 41.5, rear_legroom_in: 31.0, has_carplay: true,  has_android_auto: true,  has_alarm: false, has_satellite_radio: false, doors: 2 } },
];

function resolveSpecOverride(make: string, model: string): SpecOverride {
  const match = SPEC_OVERRIDES.find(
    (o) => o.matchMake.toLowerCase() === make.toLowerCase() &&
           model.toLowerCase().startsWith(o.matchModel.toLowerCase())
  );
  return match?.specs ?? { body_type: "suv", seating_capacity: 5, has_heat_pump: false };
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
    const specs = resolveSpecOverride(make, model);

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
      // Phase 1 preference filter fields
      body_type: specs.body_type,
      seating_capacity: specs.seating_capacity,
      has_heat_pump: specs.has_heat_pump,
      ...(specs.towing_capacity_lbs ? { towing_capacity_lbs: specs.towing_capacity_lbs } : {}),
      // Phase 2 rich specs
      ...(specs.drivetrain             ? { drivetrain: specs.drivetrain }                         : {}),
      ...(specs.cargo_volume_cuft      ? { cargo_volume_cuft: specs.cargo_volume_cuft }           : {}),
      ...(specs.charge_time_l2_hours   ? { charge_time_l2_hours: specs.charge_time_l2_hours }     : {}),
      ...(specs.front_legroom_in       ? { front_legroom_in: specs.front_legroom_in }             : {}),
      ...(specs.rear_legroom_in        ? { rear_legroom_in: specs.rear_legroom_in }               : {}),
      has_ac: specs.has_ac ?? true,
      has_power_windows: specs.has_power_windows ?? true,
      has_power_locks: specs.has_power_locks ?? true,
      has_power_steering: specs.has_power_steering ?? true,
      has_keyless_entry: specs.has_keyless_entry ?? true,
      has_dual_airbags: specs.has_dual_airbags ?? true,
      has_side_airbags: specs.has_side_airbags ?? true,
      has_abs: specs.has_abs ?? true,
      has_alarm: specs.has_alarm ?? false,
      has_satellite_radio: specs.has_satellite_radio ?? false,
      has_carplay: specs.has_carplay ?? false,
      has_android_auto: specs.has_android_auto ?? false,
      // Phase 2b additional specs (all true by default for modern EVs)
      has_tilt_wheel: specs.has_tilt_wheel ?? true,
      has_am_fm_radio: specs.has_am_fm_radio ?? true,
      has_immobilizer: specs.has_immobilizer ?? true,
      has_active_seatbelts: specs.has_active_seatbelts ?? true,
      has_passenger_airbag: specs.has_passenger_airbag ?? true,
      doors: specs.doors ?? 4,
      ...bands,
    };

    if (force) {
      // Overwrite existing rows — select by (year, make, model) then update
      const { data: existing } = await supabase
        .from("vehicle_profiles")
        .select("id")
        .eq("year", record.year)
        .eq("make", record.make)
        .eq("model", record.model)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("vehicle_profiles")
          .update(record)
          .eq("id", existing.id);
        if (error) {
          console.error(`Error updating ${row.model}:`, error.message);
        } else {
          upserted++;
          console.log(`  [update] ${make} ${model} (${row.year})`);
        }
      } else {
        const { error } = await supabase.from("vehicle_profiles").insert(record);
        if (error) {
          console.error(`Error inserting ${row.model}:`, error.message);
        } else {
          upserted++;
          console.log(`  [new] ${make} ${model} (${row.year})`);
        }
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
