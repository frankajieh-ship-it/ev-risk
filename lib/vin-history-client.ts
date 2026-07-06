/**
 * VIN History Client — Unified waterfall across providers
 *
 * Priority order: VinAudit → CarsXE → VehicleDatabases
 * Returns a normalized result regardless of which provider succeeds.
 *
 * Env vars:
 *   VINAUDIT_KEY / VINAUDIT_USER / VINAUDIT_PASS  — VinAudit Lite Check
 *   Cars_XE                                        — CarsXE history API
 *   VEHICLEDATABASES_API_KEY                       — VehicleDatabases title-check
 */

import { liteCheck } from "@/lib/vinaudit-client";
import { titleCheck } from "@/lib/vehicledatabases-client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VinHistoryResult {
  success: true;
  provider: "vinaudit" | "carsxe" | "vehicledatabases";
  vin: string;
  title_status: "clean" | "salvage" | "rebuilt" | "unknown";
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
// CarsXE
// ---------------------------------------------------------------------------

// CarsXE brand codes indicating salvage title (applied brands only — ones with a `record` field)
const CARSXE_SALVAGE_CODES = new Set(["11", "49", "50", "16", "31", "32"]);
// CarsXE brand codes indicating rebuilt/reconstructed title
const CARSXE_REBUILT_CODES = new Set(["09", "10", "52"]);
// CarsXE brand code 00 = "Clear" (no brand)
const CARSXE_CLEAR_CODE = "00";

async function tryCarSXE(vin: string): Promise<VinHistoryResult | null> {
  const key = process.env.Cars_XE;
  if (!key) return null;

  // Run history + lien-theft in parallel
  let historyData: Record<string, unknown> | null = null;
  let lienTheftData: Record<string, unknown> | null = null;

  try {
    const [histRes, ltRes] = await Promise.all([
      fetch(`https://api.carsxe.com/history?key=${key}&vin=${vin}`, {
        signal: AbortSignal.timeout(12000),
      }).catch(() => null),
      fetch(`https://api.carsxe.com/v1/lien-theft?key=${key}&vin=${vin}`, {
        signal: AbortSignal.timeout(12000),
      }).catch(() => null),
    ]);

    if (histRes?.ok) {
      const d = await histRes.json().catch(() => null);
      if (d !== null) historyData = d;
    }

    if (ltRes?.ok) {
      const d = await ltRes.json().catch(() => null);
      if (d !== null) lienTheftData = d;
    }
  } catch {
    console.warn("[vin-history] CarsXE fetch failed (network/timeout)");
  }

  // Need at least one endpoint to succeed
  if (!historyData && !lienTheftData) return null;

  // If only lien-theft succeeded (history 500'd), default title to "clean" —
  // absence of brand records means no known title issue, not unknown.
  const historyUnavailable = !historyData;

  // --- Title status from /history ---
  // brandsInformation contains the full NHTSA codebook; only entries with a `record`
  // field are actually applied to this vehicle.
  // When history is unavailable, default to "clean" (no evidence of issue)
  let title_status: VinHistoryResult["title_status"] = historyUnavailable ? "clean" : "unknown";
  let salvage_reported = false;
  let ownership_count: number | null = null;

  if (historyData) {
    const brands = (historyData.brandsInformation as Array<{ code?: string; record?: unknown }>) ?? [];
    const appliedBrands = brands.filter((b) => b.record != null && b.code !== CARSXE_CLEAR_CODE);

    if ((historyData.brandsRecordCount as number) === 0 || appliedBrands.length === 0) {
      title_status = "clean";
    } else {
      const codes = new Set(appliedBrands.map((b) => b.code!));
      if ([...codes].some((c) => CARSXE_SALVAGE_CODES.has(c))) {
        title_status = "salvage";
      } else if ([...codes].some((c) => CARSXE_REBUILT_CODES.has(c))) {
        title_status = "rebuilt";
      } else {
        title_status = "clean"; // branded but not salvage/rebuilt (e.g. odometer, rental)
      }
    }

    const junkRecords = (historyData.junkAndSalvageInformation as unknown[]) ?? [];
    salvage_reported = junkRecords.length > 0 || title_status === "salvage";

    const historyRecords = (historyData.historyInformation as unknown[]) ?? [];
    ownership_count = historyRecords.length > 0 ? historyRecords.length : null;
  }

  // --- Theft + lien from /v1/lien-theft ---
  let theft_reported = false;
  let open_lien: boolean | null = null;

  if (lienTheftData) {
    const events = (lienTheftData.events as Array<{ event?: string }>) ?? [];
    const theftKeywords = ["theft", "stolen", "recovered theft"];
    theft_reported = events.some((e) =>
      theftKeywords.some((kw) => e.event?.toLowerCase().includes(kw))
    );

    const lienKeywords = ["lien", "repossession", "repo"];
    const hasLienEvent = events.some((e) =>
      lienKeywords.some((kw) => e.event?.toLowerCase().includes(kw))
    );
    open_lien = hasLienEvent ? true : false;
  }

  return {
    success: true,
    provider: "carsxe",
    vin,
    title_status,
    accident_count: 0, // CarsXE history doesn't return accident records
    theft_reported,
    salvage_reported,
    ownership_count,
    open_lien,
    raw: { history: historyData, lien_theft: lienTheftData },
  };
}

// ---------------------------------------------------------------------------
// VehicleDatabases
// ---------------------------------------------------------------------------

async function tryVehicleDatabases(vin: string): Promise<VinHistoryResult | null> {
  const r = await titleCheck(vin);
  if (!r.success) {
    if (r.code !== "not_configured") {
      console.warn(`[vin-history] VehicleDatabases title-check failed: ${r.error}`);
    }
    return null;
  }

  const title_status: VinHistoryResult["title_status"] = r.salvage ? "salvage" : "clean";

  return {
    success: true,
    provider: "vehicledatabases",
    vin: r.vin,
    title_status,
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
 * Fetch VIN history from the best available provider.
 * Tries VinAudit → CarsXE → VehicleDatabases in order.
 * Returns a normalized result or error — never throws.
 */
export async function getVinHistory(vin: string): Promise<VinHistoryResult | VinHistoryError> {
  const attempted: string[] = [];
  const vinUpper = vin.toUpperCase();

  // 1. VinAudit
  attempted.push("vinaudit");
  try {
    const r = await liteCheck(vinUpper);
    if (r.success) {
      console.log("[vin-history] succeeded via vinaudit");
      return {
        success: true,
        provider: "vinaudit",
        vin: vinUpper,
        title_status: r.summary.salvage_reported ? "salvage" : "clean",
        accident_count: r.summary.accident_count,
        theft_reported: r.summary.theft_reported,
        salvage_reported: r.summary.salvage_reported,
        ownership_count: r.summary.sale_count > 0 ? r.summary.sale_count : null,
        open_lien: null,
        raw: r as unknown as Record<string, unknown>,
      };
    }
    console.log(`[vin-history] VinAudit failed: ${r.error}`);
  } catch (err) {
    console.warn("[vin-history] VinAudit threw:", err instanceof Error ? err.message : err);
  }

  // 2. CarsXE
  attempted.push("carsxe");
  try {
    const r = await tryCarSXE(vinUpper);
    if (r) {
      console.log("[vin-history] succeeded via carsxe");
      return r;
    }
  } catch (err) {
    console.warn("[vin-history] CarsXE threw:", err instanceof Error ? err.message : err);
  }

  // 3. VehicleDatabases
  attempted.push("vehicledatabases");
  try {
    const r = await tryVehicleDatabases(vinUpper);
    if (r) {
      console.log("[vin-history] succeeded via vehicledatabases");
      return r;
    }
  } catch (err) {
    console.warn("[vin-history] VehicleDatabases threw:", err instanceof Error ? err.message : err);
  }

  console.warn(`[vin-history] all providers failed for VIN ${vinUpper}`);
  return {
    success: false,
    error: "VIN history unavailable — all providers failed or are not configured",
    providers_attempted: attempted,
  };
}
