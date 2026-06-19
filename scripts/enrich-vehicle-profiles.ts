/**
 * Bulk vehicle_profiles enricher
 *
 * Loops all active vehicle_profiles rows that are missing key Phase 2 spec
 * fields, calls MarketCheck decodeVin() using a representative VIN for each
 * make/model/year, and upserts any new data.
 *
 * Usage:
 *   npx tsx scripts/enrich-vehicle-profiles.ts             # dry run (no writes)
 *   npx tsx scripts/enrich-vehicle-profiles.ts --write     # actually write to DB
 *   npx tsx scripts/enrich-vehicle-profiles.ts --write --limit 10  # first 10 rows only
 *
 * Requires MARKETCHECK_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 * in .env.local
 *
 * Rate limit: 1 request/sec to stay well under MarketCheck free tier (50 req/day).
 * At 1/sec, enriching 70 rows takes ~70 seconds.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase client (service role — bypasses RLS)
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// MarketCheck decode (inline — avoids Next.js module resolution issues)
// ---------------------------------------------------------------------------
const MC_BASE = "https://mc-api.marketcheck.com/v2";

async function decodeVinRaw(vin: string): Promise<Record<string, unknown> | null> {
  const key = process.env.MARKETCHECK_API_KEY;
  if (!key) throw new Error("MARKETCHECK_API_KEY not set");

  const url = `${MC_BASE}/decode/car/${vin.toUpperCase()}/specs?api_key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    console.warn(`  ✗ decode ${vin}: HTTP ${res.status}`);
    return null;
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Spec field extraction (mirrors lib/enrich-vehicle-profile.ts)
// ---------------------------------------------------------------------------
type Specs = Record<string, unknown>;

function str(s: Specs, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = s[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
}

function num(s: Specs, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = s[k];
    const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
    if (!isNaN(n) && n > 0) return n;
  }
}

function bool(s: Specs, ...keys: string[]): boolean | undefined {
  for (const k of keys) {
    const v = s[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const l = v.toLowerCase();
      if (["yes", "true", "standard", "opt"].includes(l)) return true;
      if (["no", "false", "n/a", "not available"].includes(l)) return false;
    }
  }
}

function mapDrivetrain(s: Specs): "awd" | "rwd" | "fwd" | undefined {
  const raw = str(s, "drivetrain", "drive_type", "driveline")?.toLowerCase() ?? "";
  if (raw.includes("all") || raw.includes("awd") || raw.includes("4wd")) return "awd";
  if (raw.includes("rear") || raw.includes("rwd")) return "rwd";
  if (raw.includes("front") || raw.includes("fwd") || raw.includes("2wd")) return "fwd";
}

function extractSpecs(raw: Specs): Record<string, unknown> {
  return {
    drivetrain:           mapDrivetrain(raw),
    cargo_volume_cuft:    num(raw, "cargo_volume", "cargo_volume_to_seat_3", "cargo_volume_min_seat"),
    charge_time_l2_hours: num(raw, "charge_time_120v_hours", "charge_240v_hours", "l2_charge_time"),
    front_legroom_in:     num(raw, "front_legroom", "front_leg_room"),
    rear_legroom_in:      num(raw, "rear_legroom", "rear_leg_room", "second_row_legroom"),
    doors:                num(raw, "doors", "num_doors"),
    has_ac:               bool(raw, "air_conditioning", "climate_control", "ac"),
    has_power_windows:    bool(raw, "power_windows"),
    has_power_locks:      bool(raw, "power_door_locks", "power_locks"),
    has_power_steering:   bool(raw, "power_steering"),
    has_keyless_entry:    bool(raw, "keyless_entry", "remote_keyless_entry"),
    has_alarm:            bool(raw, "alarm", "security_system", "anti_theft"),
    has_carplay:          bool(raw, "apple_carplay", "carplay"),
    has_android_auto:     bool(raw, "android_auto"),
    has_satellite_radio:  bool(raw, "satellite_radio", "sirius_xm", "xm_radio"),
    has_dual_airbags:     bool(raw, "front_airbags", "dual_front_airbags", "driver_airbag"),
    has_side_airbags:     bool(raw, "side_airbags", "curtain_airbags", "side_curtain_airbags"),
    has_abs:              bool(raw, "abs", "anti_lock_brakes", "antilock_brakes"),
    has_tilt_wheel:       bool(raw, "tilt_steering_wheel", "tilt_wheel"),
    has_am_fm_radio:      bool(raw, "am_fm_radio", "am_fm_stereo", "radio"),
    has_immobilizer:      bool(raw, "immobilizer", "engine_immobilizer", "sentry_key"),
    has_active_seatbelts: bool(raw, "active_seatbelts", "motorized_seatbelts"),
    has_passenger_airbag: bool(raw, "passenger_airbag", "front_passenger_airbag"),
    exterior_colors: (() => {
      const c = str(raw, "exterior_color", "color", "ext_color_generic");
      return c ? [c] : undefined;
    })(),
    interior_colors: (() => {
      const c = str(raw, "interior_color", "int_color_generic");
      return c ? [c] : undefined;
    })(),
  };
}

// ---------------------------------------------------------------------------
// VIN lookup: find a representative VIN for a make/model/year from active
// MarketCheck listings (so we can call decodeVin on it)
// ---------------------------------------------------------------------------
async function findSampleVin(make: string, model: string, year: number): Promise<string | null> {
  const key = process.env.MARKETCHECK_API_KEY;
  if (!key) throw new Error("MARKETCHECK_API_KEY not set");

  // Strip year from model name if present
  const cleanModel = model.replace(/^\d{4}\s*/, "").trim();

  const url = new URL(`${MC_BASE}/search/car/active`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("make", make);
  url.searchParams.set("model", cleanModel);
  url.searchParams.set("year", String(year));
  url.searchParams.set("rows", "1");
  url.searchParams.set("fields", "vin");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;

  const data = await res.json() as { listings?: Array<{ vin?: string }> };
  return data.listings?.[0]?.vin ?? null;
}

// ---------------------------------------------------------------------------
// Sleep helper for rate limiting
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const doWrite = process.argv.includes("--write");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : 9999;

  console.log(`\nMode: ${doWrite ? "WRITE" : "DRY RUN"} · limit: ${limit}`);
  if (!doWrite) console.log("(pass --write to actually update the database)\n");

  // Fetch all active profiles missing key spec fields
  const { data: profiles, error } = await supabase
    .from("vehicle_profiles")
    .select("id, year, make, model, drivetrain, cargo_volume_cuft, has_carplay")
    .eq("is_active", true)
    .or("drivetrain.is.null,cargo_volume_cuft.is.null,has_carplay.is.null")
    .order("year", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch profiles:", error.message);
    process.exit(1);
  }

  console.log(`Found ${profiles?.length ?? 0} profiles with missing specs\n`);
  if (!profiles?.length) {
    console.log("Nothing to enrich. All done!");
    return;
  }

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const profile of profiles) {
    const label = `${profile.year} ${profile.make} ${profile.model}`;
    process.stdout.write(`[${profiles.indexOf(profile) + 1}/${profiles.length}] ${label} … `);

    // Find a sample VIN for this make/model/year
    const vin = await findSampleVin(profile.make, profile.model, profile.year);
    await sleep(1100); // stay under MarketCheck rate limit

    if (!vin) {
      console.log("no VIN found, skipping");
      skipped++;
      continue;
    }

    // Decode that VIN
    const raw = await decodeVinRaw(vin);
    await sleep(1100);

    if (!raw) {
      failed++;
      continue;
    }

    const extracted = extractSpecs(raw);

    // Only keep fields that are new (not already populated)
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(extracted)) {
      if (v === undefined || v === null) continue;
      const existing = (profile as Record<string, unknown>)[k];
      if (existing !== null && existing !== undefined) continue;
      updates[k] = v;
    }

    if (Object.keys(updates).length === 0) {
      console.log("no new data");
      skipped++;
      continue;
    }

    console.log(`→ ${Object.keys(updates).join(", ")}`);

    if (doWrite) {
      const { error: upsertErr } = await supabase
        .from("vehicle_profiles")
        .update(updates)
        .eq("id", profile.id);

      if (upsertErr) {
        console.error(`  ✗ update failed: ${upsertErr.message}`);
        failed++;
      } else {
        enriched++;
      }
    } else {
      enriched++;
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`Enriched: ${enriched}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
  if (!doWrite && enriched > 0) {
    console.log(`\nRe-run with --write to apply changes.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
