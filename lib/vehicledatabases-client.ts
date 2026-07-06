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

// Actual response shape from vehicledatabases.com /electric-vehicle endpoint:
// data.powertrain is a flat object with string keys like "Hybrid traction battery capacity (kWh)"
// data.features.mechanical_features is an array of strings containing range/battery text
type RawEvSpecs = {
  status?: string;
  data?: {
    basic?: { year?: number; make?: string; model?: string; trim?: string };
    powertrain?: Record<string, string>;
    features?: { mechanical_features?: string[] };
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

  let body: RawEvSpecs;
  try {
    body = await res.json();
  } catch {
    return { success: false, error: "EV specs: invalid response", code: "api_error" };
  }

  if (body.status !== "success" || !body.data) {
    return { success: false, error: "EV specs: no data returned", code: "not_found" };
  }

  const pt = body.data.powertrain ?? {};
  const mechFeatures = body.data.features?.mechanical_features ?? [];

  const toNum = (v: string | undefined): number | null => {
    if (!v || v.trim() === "") return null;
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  };

  // Battery kWh: from "Hybrid traction battery capacity (kWh)" field,
  // or parse from mechanical_features text like "11.5 kW Onboard Charger"
  let battery_capacity_kwh = toNum(pt["Hybrid traction battery capacity (kWh)"]);
  if (!battery_capacity_kwh) {
    // e.g. "Lithium Ion Traction Battery w/11.5 kW Onboard Charger and 10 Hrs Charge Time @ 220/240V"
    const batteryText = mechFeatures.find((f) => /traction battery/i.test(f));
    const kwhMatch = batteryText?.match(/(\d+\.?\d*)\s*kWh/i);
    battery_capacity_kwh = kwhMatch ? parseFloat(kwhMatch[1]) : null;
  }

  // Range: from "Hybrid traction battery all electric range" or mechanical features text
  // e.g. "325+ mi estimated range"
  let range_miles = toNum(pt["Hybrid traction battery all electric range"]);
  if (!range_miles) {
    const rangeText = mechFeatures.find((f) => /mi.*range|range.*mi/i.test(f));
    const rangeMatch = rangeText?.match(/(\d+)\+?\s*mi/i);
    range_miles = rangeMatch ? parseFloat(rangeMatch[1]) : null;
  }
  // Also try MPGe combined as MPGe ≈ mi/33.7kWh — skip, not meaningful for range

  // L2 charge time: "Hybrid traction battery charge time (hrs) @ 240V"
  // or from mechanical features text like "10 Hrs Charge Time @ 220/240V"
  let charge_time_l2_hours = toNum(pt["Hybrid traction battery charge time (hrs) @ 240V"]);
  if (!charge_time_l2_hours) {
    const chargeText = mechFeatures.find((f) => /hrs.*charge time|charge time.*hrs/i.test(f));
    const hrsMatch = chargeText?.match(/(\d+\.?\d*)\s*Hrs/i);
    charge_time_l2_hours = hrsMatch ? parseFloat(hrsMatch[1]) : null;
  }

  // DC fast charge time
  const charge_time_dc_fast_minutes = toNum(pt["Hybrid traction battery peak DC fast charge time (minutes)"]);

  // Horsepower: from specs or electric motor field
  const horsepower = toNum(pt["Horsepower"]) ?? toNum(pt["Electric motor horsepower"]);

  return {
    success: true,
    year,
    make,
    model,
    trim: body.data.basic?.trim ?? trim,
    battery_capacity_kwh,
    range_miles,
    charge_time_l2_hours,
    charge_time_dc_fast_minutes,
    horsepower,
    raw: body as unknown as Record<string, unknown>,
  };
}
