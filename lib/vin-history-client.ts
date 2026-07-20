/**
 * VIN History Client — VehicleDatabases primary source
 *
 * Uses VehicleDatabases /vehicle-history endpoint for full ownership
 * history: theft, salvage, accidents, title status, ownership count.
 *
 * Env vars:
 *   VEHICLEDATABASES_API_KEY  — VehicleDatabases API key (x-authkey header)
 */

import { titleCheck } from "@/lib/vehicledatabases-client";
import { auctionHistory } from "@/lib/vehicledatabases-client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VinHistoryResult {
  success: true;
  provider: "vehicledatabases";
  vin: string;
  title_status: "clean" | "salvage" | "rebuilt" | "lemon" | "unknown";
  accident_count: number;
  theft_reported: boolean;
  salvage_reported: boolean;
  ownership_count: number | null;
  open_lien: boolean | null;
  /** Raw provider response — for debugging and future field expansion */
  raw: Record<string, unknown>;
}

export interface VinHistoryError {
  success: false;
  error: string;
  providers_attempted: string[];
}

// ---------------------------------------------------------------------------
// VehicleDatabases — full vehicle history endpoint
// ---------------------------------------------------------------------------

interface VehicleHistoryRaw {
  status?: string;
  data?: {
    theft?: { records?: Array<{ date?: string; status?: string }> };
    salvage?: { records?: Array<{ date?: string; source?: string; disposition?: string }> };
    accidents?: { count?: number; records?: Array<{ date?: string; severity?: string }> };
    ownership?: { count?: number };
    title?: { status?: string };
    lien?: { open?: boolean };
  };
}

async function tryVehicleDatabases(vin: string): Promise<VinHistoryResult | null> {
  const key = process.env.VEHICLEDATABASES_API_KEY;
  if (!key) return null;

  let res: Response;
  try {
    res = await fetch(`https://api.vehicledatabases.com/vehicle-history/${vin.toUpperCase()}`, {
      headers: { "x-authkey": key },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.warn("[vin-history] VehicleDatabases /vehicle-history fetch failed:", err instanceof Error ? err.message : err);
    return null;
  }

  if (!res.ok) {
    console.warn(`[vin-history] VehicleDatabases /vehicle-history ${res.status} for ${vin}`);
    // Fall through to titleCheck fallback
    return null;
  }

  let body: VehicleHistoryRaw;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  if (body.status !== "success" || !body.data) {
    console.warn(`[vin-history] VehicleDatabases /vehicle-history non-success for ${vin}:`, body.status);
    return null;
  }

  const d = body.data;
  const titleStatus = d.title?.status?.toLowerCase() ?? "";
  const title_status: VinHistoryResult["title_status"] =
    titleStatus.includes("lemon") ? "lemon" :
    titleStatus.includes("salvage") ? "salvage" :
    titleStatus.includes("rebuilt") || titleStatus.includes("reconstructed") ? "rebuilt" :
    titleStatus.includes("clean") ? "clean" : "unknown";

  return {
    success: true,
    provider: "vehicledatabases",
    vin: vin.toUpperCase(),
    title_status,
    accident_count: d.accidents?.count ?? (d.accidents?.records?.length ?? 0),
    theft_reported: (d.theft?.records?.length ?? 0) > 0,
    salvage_reported: title_status === "salvage" || (d.salvage?.records?.length ?? 0) > 0,
    ownership_count: d.ownership?.count ?? null,
    open_lien: d.lien?.open ?? null,
    raw: body as unknown as Record<string, unknown>,
  };
}

// Fallback: title-check only (salvage flag, no ownership/accident detail)
async function tryTitleCheckOnly(vin: string): Promise<VinHistoryResult | null> {
  const r = await titleCheck(vin);
  if (!r.success) return null;
  return {
    success: true,
    provider: "vehicledatabases",
    vin: r.vin,
    title_status: r.salvage ? "salvage" : "clean",
    accident_count: 0,
    theft_reported: false,
    salvage_reported: r.salvage,
    ownership_count: null,
    open_lien: null,
    raw: { salvage: r.salvage, salvage_details: r.salvage_details },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch VIN history from VehicleDatabases.
 * Tries /vehicle-history first (full data), falls back to /title-check (salvage only).
 * Returns a normalized result or error — never throws.
 */
export async function getVinHistory(vin: string): Promise<VinHistoryResult | VinHistoryError> {
  const vinUpper = vin.toUpperCase();
  const attempted: string[] = ["vehicledatabases"];

  try {
    const full = await tryVehicleDatabases(vinUpper);
    if (full) {
      console.log("[vin-history] succeeded via vehicledatabases /vehicle-history");
      return full;
    }
  } catch (err) {
    console.warn("[vin-history] VehicleDatabases /vehicle-history threw:", err instanceof Error ? err.message : err);
  }

  // Fallback: title-check only
  try {
    const titleOnly = await tryTitleCheckOnly(vinUpper);
    if (titleOnly) {
      console.log("[vin-history] succeeded via vehicledatabases /title-check (fallback)");
      return titleOnly;
    }
  } catch (err) {
    console.warn("[vin-history] VehicleDatabases /title-check threw:", err instanceof Error ? err.message : err);
  }

  console.warn(`[vin-history] VehicleDatabases unavailable for VIN ${vinUpper}`);
  return {
    success: false,
    error: "Ownership history unavailable — VehicleDatabases did not return data for this VIN",
    providers_attempted: attempted,
  };
}
