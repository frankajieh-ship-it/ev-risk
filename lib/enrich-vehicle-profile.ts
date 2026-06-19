/**
 * enrichVehicleProfile — fire-and-forget upsert to vehicle_profiles
 *
 * Called after a MarketCheck VIN decode to persist any new spec data we
 * don't already have. Designed to run non-blocking (never throws, never
 * awaited in the hot path).
 *
 * MarketCheck /decode/car/{VIN}/specs returns a flat object. Key names vary
 * by source; we defensively read all known aliases.
 */

import { decodeVin } from "./marketcheck-client";
import { getSupabaseAdmin } from "./api-auth";

type Specs = Record<string, unknown>;

function str(s: Specs, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = s[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function num(s: Specs, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = s[k];
    const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
    if (!isNaN(n) && n > 0) return n;
  }
  return undefined;
}

function bool(s: Specs, ...keys: string[]): boolean | undefined {
  for (const k of keys) {
    const v = s[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const l = v.toLowerCase();
      if (l === "yes" || l === "true" || l === "standard" || l === "opt") return true;
      if (l === "no" || l === "false" || l === "n/a" || l === "not available") return false;
    }
  }
  return undefined;
}

function mapDrivetrain(s: Specs): "awd" | "rwd" | "fwd" | undefined {
  const raw = str(s, "drivetrain", "drive_type", "driveline")?.toLowerCase() ?? "";
  if (raw.includes("all") || raw.includes("awd") || raw.includes("4wd") || raw.includes("4x4")) return "awd";
  if (raw.includes("rear") || raw.includes("rwd")) return "rwd";
  if (raw.includes("front") || raw.includes("fwd") || raw.includes("2wd")) return "fwd";
  return undefined;
}

/** Extract useful fields from a raw MarketCheck decode response */
function extractSpecs(raw: Specs): Partial<Record<string, unknown>> {
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

/**
 * Fire-and-forget: decode VIN via MarketCheck, upsert any new spec fields
 * into vehicle_profiles for the matching make/model/year row.
 *
 * Only writes fields that are currently NULL (never overwrites existing data).
 * Safe to call without awaiting — catches all errors internally.
 */
export function enrichVehicleProfileFromVin(
  vin: string,
  make: string,
  model: string,
  year: number
): void {
  // Run async in background — caller does NOT await this
  void (async () => {
    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) return;

      // Only bother if we have this vehicle in our profiles table
      const { data: existing } = await supabase
        .from("vehicle_profiles")
        .select("id, drivetrain, cargo_volume_cuft, has_carplay")
        .ilike("make", make)
        .ilike("model", `${model}%`)
        .eq("year", year)
        .limit(1)
        .maybeSingle();

      if (!existing) return; // Not a tracked model — skip

      // If key fields already populated, skip the API call entirely
      if (existing.drivetrain && existing.cargo_volume_cuft && existing.has_carplay !== null) return;

      const decoded = await decodeVin(vin);
      if (!decoded.success) return;

      const extracted = extractSpecs(decoded.specs);

      // Remove undefined values and fields that are already set
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(extracted)) {
        if (v === undefined || v === null) continue;
        // Don't overwrite existing non-null values (cast existing to allow index access)
        if ((existing as Record<string, unknown>)[k] !== null && (existing as Record<string, unknown>)[k] !== undefined) continue;
        updates[k] = v;
      }

      if (Object.keys(updates).length === 0) return;

      await supabase
        .from("vehicle_profiles")
        .update(updates)
        .eq("id", existing.id);
    } catch {
      // Intentionally silent — enrichment is best-effort
    }
  })();
}
