/**
 * ETL Job 2a: Charging Performance → data_v2/charging_profiles.json
 *
 * Compiles 10–80% charging time, peak DC kW, and curve shape for major BEV models.
 * This is a semi-manual script: data is hardcoded from published third-party test results.
 *
 * Sources:
 * - Fastned charging test reports (fastned.nl/en/press)
 * - ABRP ChargeDB community measurements (abetterrouteplanner.com)
 * - Recurrent Auto blog posts (recurrentauto.com/research)
 * - InsideEVs charging tests (insideevs.com)
 * - Electrify America / ChargePoint published station compatibility data
 *
 * Run: npx tsx scripts/etl/compile-charging-profiles.ts
 * Refresh cadence: add rows as new models arrive; existing rows rarely change
 */

import fs from "fs";
import path from "path";

const OUT_PATH = path.join(process.cwd(), "data_v2", "charging_profiles.json");

interface ChargingProfile {
  make: string;
  model: string;
  year_start: number;
  year_end: number | null;
  // Rated spec (from manufacturer)
  peak_dc_kw: number;
  // Measured peak (from third-party tests; null = only rated data available)
  real_peak_dc_kw: number | null;
  // Charging time (minutes) at a real-world 150–350 kW DCFC
  time_10_to_80_min: number | null;
  time_20_to_80_min: number | null;
  // Shape of the charging curve
  // flat = holds peak kW to ~70–80% SoC (e.g. Tesla, Kia EV6)
  // tapered = gradual ramp-down from ~50% SoC (most EVs)
  // steep_taper = sharp drop at ~50% SoC (e.g. older Nissan Leaf)
  curve_shape: "flat" | "tapered" | "steep_taper";
  // % reduction in peak DC kW when battery is at 32°F
  cold_derate_percent: number;
  data_source: string;
  notes: string | null;
  last_updated: string;
}

const TODAY = new Date().toISOString().substring(0, 10);

// ---------------------------------------------------------------------------
// Hardcoded data compiled from published tests
// Sources cited inline per vehicle
// ---------------------------------------------------------------------------
const PROFILES: Omit<ChargingProfile, "last_updated">[] = [
  // ----- Tesla -----
  {
    make: "Tesla",
    model: "Model 3",
    year_start: 2021,
    year_end: null,
    peak_dc_kw: 250,           // V3 Supercharger rated
    real_peak_dc_kw: 225,      // InsideEVs: ~225 kW sustained on LR
    time_10_to_80_min: 25,     // Tesla official; InsideEVs measured 23–27
    time_20_to_80_min: 20,
    curve_shape: "flat",       // Holds near-peak to ~80% SoC
    cold_derate_percent: 30,   // Recurrent: ~30% peak reduction at 32°F; preconditioning recovers ~50%
    data_source: "InsideEVs + Recurrent Auto",
    notes: "LR AWD. V2 Supercharger caps at 150 kW. Preconditioning critical in cold.",
  },
  {
    make: "Tesla",
    model: "Model Y",
    year_start: 2021,
    year_end: null,
    peak_dc_kw: 250,
    real_peak_dc_kw: 220,
    time_10_to_80_min: 28,
    time_20_to_80_min: 22,
    curve_shape: "flat",
    cold_derate_percent: 30,
    data_source: "InsideEVs + Recurrent Auto",
    notes: "LR AWD. RWD variant slightly faster (lighter). Similar curve to Model 3.",
  },
  {
    make: "Tesla",
    model: "Model S",
    year_start: 2021,
    year_end: null,
    peak_dc_kw: 250,
    real_peak_dc_kw: 230,
    time_10_to_80_min: 30,     // Larger 100 kWh pack; more kWh to move
    time_20_to_80_min: 24,
    curve_shape: "flat",
    cold_derate_percent: 25,
    data_source: "InsideEVs + Tesla",
    notes: "Plaid rated 250 kW. Older 2021+ models updated to V3 charge profile.",
  },
  {
    make: "Tesla",
    model: "Model X",
    year_start: 2021,
    year_end: null,
    peak_dc_kw: 250,
    real_peak_dc_kw: 210,      // Heavier; slightly slower
    time_10_to_80_min: 35,
    time_20_to_80_min: 27,
    curve_shape: "flat",
    cold_derate_percent: 25,
    data_source: "InsideEVs",
    notes: "100 kWh pack. Heavier SUV body reduces effective charge rate vs Model S.",
  },
  {
    make: "Tesla",
    model: "Cybertruck",
    year_start: 2024,
    year_end: null,
    peak_dc_kw: 350,
    real_peak_dc_kw: 306,      // Motor Trend measured 306 kW peak
    time_10_to_80_min: 25,     // 123 kWh usable; 25min at 300+ kW is plausible
    time_20_to_80_min: 19,
    curve_shape: "flat",
    cold_derate_percent: 35,   // Estimated; large pack in cold climates
    data_source: "Motor Trend + Tesla",
    notes: "Foundation Series 123 kWh pack. V4 Supercharger required for 350 kW.",
  },

  // ----- Hyundai / Kia (800V architecture) -----
  {
    make: "Hyundai",
    model: "IONIQ 5",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 233,
    real_peak_dc_kw: 226,      // Fastned: 226 kW measured peak (77.4 kWh pack)
    time_10_to_80_min: 18,     // Hyundai official; 800V + flat curve = very fast
    time_20_to_80_min: 14,
    curve_shape: "flat",       // Holds near-peak to ~80% SoC (flat curve, best in class)
    cold_derate_percent: 40,   // AAA test: ~40% reduction at 20°F
    data_source: "Fastned + Hyundai + AAA",
    notes: "RWD 77.4 kWh pack. AWD 72.6 kWh pack slightly slower. 800V natively.",
  },
  {
    make: "Hyundai",
    model: "IONIQ 6",
    year_start: 2023,
    year_end: null,
    peak_dc_kw: 233,
    real_peak_dc_kw: 220,      // Fastned: 221 kW peak
    time_10_to_80_min: 18,
    time_20_to_80_min: 14,
    curve_shape: "flat",
    cold_derate_percent: 40,
    data_source: "Fastned + Hyundai",
    notes: "RWD 77.4 kWh. Sedan aerodynamics give better real-world range vs IONIQ 5.",
  },
  {
    make: "Kia",
    model: "EV6",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 233,
    real_peak_dc_kw: 222,      // Fastned: 222 kW measured
    time_10_to_80_min: 18,
    time_20_to_80_min: 14,
    curve_shape: "flat",
    cold_derate_percent: 40,
    data_source: "Fastned + Kia",
    notes: "E-GMP platform (same as IONIQ 5). GT variant same charge speed.",
  },
  {
    make: "Kia",
    model: "EV9",
    year_start: 2024,
    year_end: null,
    peak_dc_kw: 233,
    real_peak_dc_kw: 215,      // Larger 99.8 kWh pack
    time_10_to_80_min: 24,
    time_20_to_80_min: 19,
    curve_shape: "flat",
    cold_derate_percent: 38,
    data_source: "InsideEVs + Kia",
    notes: "99.8 kWh usable. 3-row SUV. V2L and 800V native.",
  },
  {
    make: "Genesis",
    model: "GV60",
    year_start: 2023,
    year_end: null,
    peak_dc_kw: 233,
    real_peak_dc_kw: 218,
    time_10_to_80_min: 18,
    time_20_to_80_min: 14,
    curve_shape: "flat",
    cold_derate_percent: 40,
    data_source: "Fastned + Genesis",
    notes: "E-GMP platform. Same charge profile as EV6/IONIQ 5.",
  },

  // ----- Chevrolet -----
  {
    make: "Chevrolet",
    model: "Bolt EV",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 55,            // Limited to 55 kW (CCS; older 50 kW DCFC)
    real_peak_dc_kw: 52,       // InsideEVs: 52 kW actual
    time_10_to_80_min: 60,     // ~60min at 50 kW station
    time_20_to_80_min: 48,
    curve_shape: "tapered",    // Drops after ~55% SoC
    cold_derate_percent: 45,   // Significant cold weather impact (NMC, no preconditioning)
    data_source: "InsideEVs + Recurrent Auto",
    notes: "65 kWh usable. Slowest DCFC of any new BEV. Best for level 2 overnight use.",
  },
  {
    make: "Chevrolet",
    model: "Bolt EUV",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 55,
    real_peak_dc_kw: 52,
    time_10_to_80_min: 60,
    time_20_to_80_min: 48,
    curve_shape: "tapered",
    cold_derate_percent: 45,
    data_source: "InsideEVs",
    notes: "Same 65 kWh pack and charger as Bolt EV.",
  },
  {
    make: "Chevrolet",
    model: "Equinox EV",
    year_start: 2024,
    year_end: null,
    peak_dc_kw: 150,
    real_peak_dc_kw: 145,
    time_10_to_80_min: 38,
    time_20_to_80_min: 29,
    curve_shape: "tapered",
    cold_derate_percent: 35,
    data_source: "GM + InsideEVs",
    notes: "78 kWh usable (LT/RS). Ultium platform.",
  },

  // ----- Ford -----
  {
    make: "Ford",
    model: "Mustang Mach-E",
    year_start: 2021,
    year_end: null,
    peak_dc_kw: 150,
    real_peak_dc_kw: 130,      // InsideEVs: 130 kW observed peak
    time_10_to_80_min: 38,
    time_20_to_80_min: 29,
    curve_shape: "tapered",
    cold_derate_percent: 38,
    data_source: "InsideEVs + Fastned",
    notes: "Extended Range 91 kWh pack. Standard Range 72 kWh. Similar curve.",
  },
  {
    make: "Ford",
    model: "F-150 Lightning",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 150,
    real_peak_dc_kw: 145,
    time_10_to_80_min: 41,     // Extended Range 131 kWh pack
    time_20_to_80_min: 32,
    curve_shape: "tapered",
    cold_derate_percent: 40,
    data_source: "InsideEVs + Car and Driver",
    notes: "Extended Range 131 kWh. Standard Range 98 kWh (~30min to 80%). Truck weight impacts range.",
  },

  // ----- Volkswagen -----
  {
    make: "Volkswagen",
    model: "ID.4",
    year_start: 2021,
    year_end: null,
    peak_dc_kw: 135,
    real_peak_dc_kw: 130,      // Fastned: ~130 kW peak
    time_10_to_80_min: 38,
    time_20_to_80_min: 29,
    curve_shape: "tapered",
    cold_derate_percent: 35,
    data_source: "Fastned + InsideEVs",
    notes: "82 kWh usable (Pro/Pro S). MEB platform. 2023+ US models assembled in Chattanooga.",
  },

  // ----- Rivian -----
  {
    make: "Rivian",
    model: "R1T",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 220,           // 2024 Max Pack; Standard/Large Pack = 140 kW
    real_peak_dc_kw: 200,      // InsideEVs: ~200 kW peak on Large Pack
    time_10_to_80_min: 38,     // Large Pack 135 kWh
    time_20_to_80_min: 30,
    curve_shape: "tapered",
    cold_derate_percent: 35,
    data_source: "InsideEVs + Rivian",
    notes: "Max Pack (149 kWh): 220 kW rated. Large Pack (135 kWh): 140 kW. Standard Pack (105 kWh): 140 kW.",
  },
  {
    make: "Rivian",
    model: "R1S",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 220,
    real_peak_dc_kw: 195,
    time_10_to_80_min: 40,
    time_20_to_80_min: 32,
    curve_shape: "tapered",
    cold_derate_percent: 35,
    data_source: "InsideEVs + Rivian",
    notes: "Heavier 3-row SUV; slightly slower than R1T despite same pack options.",
  },

  // ----- BMW -----
  {
    make: "BMW",
    model: "i4",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 205,
    real_peak_dc_kw: 195,      // Fastned: 196 kW peak
    time_10_to_80_min: 31,
    time_20_to_80_min: 24,
    curve_shape: "flat",
    cold_derate_percent: 30,
    data_source: "Fastned + BMW",
    notes: "83.9 kWh usable (eDrive40). M50 same pack. Gen5 drivetrain.",
  },
  {
    make: "BMW",
    model: "iX",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 195,
    real_peak_dc_kw: 185,
    time_10_to_80_min: 35,
    time_20_to_80_min: 27,
    curve_shape: "flat",
    cold_derate_percent: 28,
    data_source: "Fastned + BMW",
    notes: "xDrive50: 105.2 kWh usable. M60: same pack.",
  },

  // ----- Nissan -----
  {
    make: "Nissan",
    model: "LEAF",
    year_start: 2019,
    year_end: null,
    peak_dc_kw: 50,            // LEAF e+ (62 kWh): 100 kW CHAdeMO; base 40 kWh: 50 kW
    real_peak_dc_kw: 48,
    time_10_to_80_min: 60,     // 40 kWh; e+ 62 kWh at 100 kW = ~45min
    time_20_to_80_min: 47,
    curve_shape: "steep_taper", // Well-documented rapid taper after 50% due to no TMS
    cold_derate_percent: 50,    // No active thermal management; severe cold impact
    data_source: "InsideEVs + Recurrent Auto",
    notes: "No active battery thermal management. CHAdeMO (not CCS). e+ variant has 100 kW DC. " +
           "DCFC rate limiting when hot is well-documented.",
  },

  // ----- Lucid -----
  {
    make: "Lucid",
    model: "Air",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 300,           // Pure rated; Grand Touring 300 kW
    real_peak_dc_kw: 280,      // InsideEVs: 285 kW observed
    time_10_to_80_min: 22,     // 112 kWh usable pack; very fast
    time_20_to_80_min: 17,
    curve_shape: "flat",
    cold_derate_percent: 25,   // Best-in-class thermal management
    data_source: "InsideEVs + Lucid",
    notes: "Pure: 112 kWh, 300 kW. Grand Touring: 112 kWh, 300 kW. Sapphire: 118 kWh.",
  },

  // ----- Mercedes -----
  {
    make: "Mercedes-Benz",
    model: "EQS",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 200,
    real_peak_dc_kw: 195,      // Fastned: 196 kW
    time_10_to_80_min: 35,
    time_20_to_80_min: 27,
    curve_shape: "flat",
    cold_derate_percent: 28,
    data_source: "Fastned + Mercedes",
    notes: "107.8 kWh usable. Flat curve to ~80%.",
  },

  // ----- Audi -----
  {
    make: "Audi",
    model: "Q8 e-tron",
    year_start: 2023,
    year_end: null,
    peak_dc_kw: 170,
    real_peak_dc_kw: 160,
    time_10_to_80_min: 38,
    time_20_to_80_min: 29,
    curve_shape: "tapered",
    cold_derate_percent: 32,
    data_source: "Fastned + Audi",
    notes: "114 kWh gross / 106 kWh usable. Formerly e-tron Sportback.",
  },

  // ----- GMC -----
  {
    make: "GMC",
    model: "Hummer EV",
    year_start: 2022,
    year_end: null,
    peak_dc_kw: 350,
    real_peak_dc_kw: 295,      // Car and Driver: ~295 kW peak
    time_10_to_80_min: 32,     // 212 kWh gross / 180 kWh usable
    time_20_to_80_min: 25,
    curve_shape: "tapered",
    cold_derate_percent: 40,   // Massive pack, still derate in cold
    data_source: "Car and Driver + GM",
    notes: "EV3X variant 180 kWh usable. Ultium platform. 800V architecture.",
  },

  // ----- Volvo -----
  {
    make: "Volvo",
    model: "EX90",
    year_start: 2024,
    year_end: null,
    peak_dc_kw: 250,
    real_peak_dc_kw: null,     // Limited test data available at time of writing
    time_10_to_80_min: 30,     // Volvo official
    time_20_to_80_min: 23,
    curve_shape: "flat",
    cold_derate_percent: 35,
    data_source: "Volvo official",
    notes: "111 kWh gross / 107 kWh usable. SPA2 platform.",
  },

  // ----- Porsche -----
  {
    make: "Porsche",
    model: "Taycan",
    year_start: 2021,
    year_end: null,
    peak_dc_kw: 270,
    real_peak_dc_kw: 265,      // Fastned: 268 kW peak
    time_10_to_80_min: 23,
    time_20_to_80_min: 18,
    curve_shape: "flat",
    cold_derate_percent: 25,
    data_source: "Fastned + Porsche",
    notes: "93.4 kWh usable (Performance Battery Plus). 800V J1 architecture. Best charging curve in class.",
  },

  // ----- Polestar -----
  {
    make: "Polestar",
    model: "Polestar 2",
    year_start: 2021,
    year_end: null,
    peak_dc_kw: 205,
    real_peak_dc_kw: 190,      // Fastned: ~192 kW peak on 78 kWh pack
    time_10_to_80_min: 30,
    time_20_to_80_min: 23,
    curve_shape: "flat",
    cold_derate_percent: 38,
    data_source: "Fastned + Polestar",
    notes: "78 kWh usable (Long Range). Single motor 69 kWh limited to 130 kW.",
  },
];

async function main() {
  const output: ChargingProfile[] = PROFILES.map(p => ({ ...p, last_updated: TODAY }));

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`✅ Wrote ${output.length} charging profiles → ${OUT_PATH}`);
  console.log(`\nCoverage summary:`);
  const byMake = new Map<string, number>();
  for (const p of output) {
    byMake.set(p.make, (byMake.get(p.make) ?? 0) + 1);
  }
  for (const [make, count] of [...byMake.entries()].sort()) {
    console.log(`  ${make}: ${count} model${count > 1 ? "s" : ""}`);
  }
  console.log(`\nTo add more profiles, edit the PROFILES array in this script and re-run.`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
