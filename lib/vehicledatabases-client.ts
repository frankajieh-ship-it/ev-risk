/**
 * VehicleDatabases.com API Client
 *
 * Three selected endpoints for OFFO:
 *   1. titleCheck(vin)                      — salvage/title flags
 *   2. auctionHistory(vin)                  — past auction sale records
 *   3. evSpecs(year, make, model, trim)     — EV powertrain specs
 *
 * Auth: x-authkey header
 * Env var: VEHICLEDATABASES_API_KEY
 */

const BASE = "https://api.vehicledatabases.com";

function apiKey(): string | undefined {
  return process.env.VEHICLEDATABASES_API_KEY;
}

export function isConfigured(): boolean {
  return !!apiKey();
}

function authHeaders(): HeadersInit {
  return { "x-authkey": apiKey()! };
}

// ---------------------------------------------------------------------------
// Title Check
// ---------------------------------------------------------------------------

export interface TitleCheckResult {
  success: true;
  vin: string;
  salvage: boolean;
  salvage_details: Array<{ cause: string; date: string }>;
}

export interface TitleCheckError {
  success: false;
  error: string;
  code: "not_configured" | "api_error" | "not_found" | "timeout";
}

export async function titleCheck(vin: string): Promise<TitleCheckResult | TitleCheckError> {
  if (!isConfigured()) {
    return { success: false, error: "VehicleDatabases not configured", code: "not_configured" };
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/title-check/${vin.toUpperCase()}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    return { success: false, error: isAbort ? "Title check timed out" : "Title check unavailable", code: "timeout" };
  }

  if (!res.ok) {
    return { success: false, error: `Title check API error: ${res.status}`, code: "api_error" };
  }

  let body: { status?: string; vin?: string; data?: { salvage?: boolean; salvage_details?: Array<{ cause: string; date: string }> } };
  try {
    body = await res.json();
  } catch {
    return { success: false, error: "Title check: invalid response", code: "api_error" };
  }

  if (body.status !== "success") {
    return { success: false, error: "Title check returned non-success status", code: "not_found" };
  }

  const data = body.data ?? {};
  return {
    success: true,
    vin: vin.toUpperCase(),
    salvage: data.salvage ?? false,
    salvage_details: data.salvage_details ?? [],
  };
}

// ---------------------------------------------------------------------------
// Auction History
// ---------------------------------------------------------------------------

export interface AuctionRecord {
  sale_index: string;
  price: string;
  sale_status: string;
  title_type: string;
  primary_damage: string;
  odometer: string;
  estimated_repair_cost: string;
  auction_date: string;
  location: string;
  images: string[];
}

export interface AuctionHistoryResult {
  success: true;
  vin: string;
  records: AuctionRecord[];
}

export interface AuctionHistoryError {
  success: false;
  error: string;
  code: "not_configured" | "api_error" | "not_found" | "timeout";
}

type RawAuctionRecord = {
  sale_index?: string;
  price?: string;
  sale_status?: string;
  "title-and-condition"?: { "Title Type"?: string; "Primary Damage"?: string };
  "technical-specs"?: { "Odometer"?: string; "Estimated Repair Cost"?: string };
  "sale-date-location"?: { "Auction Date"?: string; "Location"?: string };
  images?: string[];
};

export async function auctionHistory(vin: string): Promise<AuctionHistoryResult | AuctionHistoryError> {
  if (!isConfigured()) {
    return { success: false, error: "VehicleDatabases not configured", code: "not_configured" };
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/auction/${vin.toUpperCase()}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    return { success: false, error: isAbort ? "Auction lookup timed out" : "Auction lookup unavailable", code: "timeout" };
  }

  if (!res.ok) {
    return { success: false, error: `Auction API error: ${res.status}`, code: "api_error" };
  }

  let body: { status?: string; vin?: string; data?: RawAuctionRecord[] };
  try {
    body = await res.json();
  } catch {
    return { success: false, error: "Auction: invalid response", code: "api_error" };
  }

  if (body.status !== "success") {
    return { success: false, error: "Auction lookup returned non-success status", code: "not_found" };
  }

  const records: AuctionRecord[] = (body.data ?? []).map((r) => ({
    sale_index: r.sale_index ?? "",
    price: r.price ?? "",
    sale_status: r.sale_status ?? "",
    title_type: r["title-and-condition"]?.["Title Type"] ?? "",
    primary_damage: r["title-and-condition"]?.["Primary Damage"] ?? "",
    odometer: r["technical-specs"]?.["Odometer"] ?? "",
    estimated_repair_cost: r["technical-specs"]?.["Estimated Repair Cost"] ?? "",
    auction_date: r["sale-date-location"]?.["Auction Date"] ?? "",
    location: r["sale-date-location"]?.["Location"] ?? "",
    images: r.images ?? [],
  }));

  return { success: true, vin: vin.toUpperCase(), records };
}

// ---------------------------------------------------------------------------
// EV Specs
// ---------------------------------------------------------------------------

export interface EvSpecsResult {
  success: true;
  year: number;
  make: string;
  model: string;
  trim: string;
  battery_capacity_kwh: number | null;
  range_miles: number | null;
  charge_time_l2_hours: number | null;
  charge_time_dc_fast_minutes: number | null;
  horsepower: number | null;
  raw: Record<string, unknown>;
}

export interface EvSpecsError {
  success: false;
  error: string;
  code: "not_configured" | "api_error" | "not_found" | "timeout";
}

type RawEvSpecs = {
  powertrain?: {
    battery_capacity_kwh?: number | string;
    range?: { city?: number | string; highway?: number | string; combined?: number | string };
    charging_times?: {
      level2_hours?: number | string;
      dc_fast_charge_minutes?: number | string;
    };
    horsepower?: number | string;
  };
};

export async function evSpecs(
  year: number,
  make: string,
  model: string,
  trim: string
): Promise<EvSpecsResult | EvSpecsError> {
  if (!isConfigured()) {
    return { success: false, error: "VehicleDatabases not configured", code: "not_configured" };
  }

  const path = [year, make, model, trim].map(encodeURIComponent).join("/");
  let res: Response;
  try {
    res = await fetch(`${BASE}/electric-vehicle/${path}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    return { success: false, error: isAbort ? "EV specs timed out" : "EV specs unavailable", code: "timeout" };
  }

  if (!res.ok) {
    return { success: false, error: `EV specs API error: ${res.status}`, code: res.status === 404 ? "not_found" : "api_error" };
  }

  let body: RawEvSpecs & Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    return { success: false, error: "EV specs: invalid response", code: "api_error" };
  }

  const pt = body.powertrain ?? {};
  const toNum = (v: number | string | undefined): number | null =>
    v !== undefined && v !== "" ? Number(v) || null : null;

  const range = pt.range;
  const range_miles = toNum(range?.combined ?? range?.highway ?? range?.city);

  return {
    success: true,
    year,
    make,
    model,
    trim,
    battery_capacity_kwh: toNum(pt.battery_capacity_kwh),
    range_miles,
    charge_time_l2_hours: toNum(pt.charging_times?.level2_hours),
    charge_time_dc_fast_minutes: toNum(pt.charging_times?.dc_fast_charge_minutes),
    horsepower: toNum(pt.horsepower),
    raw: body,
  };
}
