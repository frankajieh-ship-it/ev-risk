/**
 * POST /api/receipt/vin-lookup
 *
 * Decodes a VIN via Auto.dev and returns structured listing fields.
 * Used as the primary fallback when URL extraction fails.
 *
 * Body: { vin: string }
 * Returns: { success: boolean, fields: StructuredListingFields, vehicle_label?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { decodeVin, searchListings } from "@/lib/auto-dev-client";

export const maxDuration = 15;

// Static EV specs by "make|model" (lowercase). Used when Auto.dev VIN decode
// doesn't return battery/range/DC fast data (which is most of the time).
// battery_kwh = usable, range_mi = EPA combined, dc_fast_kw = peak CCS/CHAdeMO
interface EvSpecEntry {
  battery_kwh?: number;
  range_mi?: number;
  dc_fast_kw?: number;
  efficiency_mi_per_kwh?: number;
}
const EV_SPECS: Record<string, EvSpecEntry> = {
  // Tesla
  "tesla|model 3":           { battery_kwh: 57.5, range_mi: 272, dc_fast_kw: 170, efficiency_mi_per_kwh: 4.0 },
  "tesla|model 3 long range": { battery_kwh: 75,   range_mi: 341, dc_fast_kw: 250, efficiency_mi_per_kwh: 4.1 },
  "tesla|model y":           { battery_kwh: 57.5, range_mi: 260, dc_fast_kw: 170, efficiency_mi_per_kwh: 3.8 },
  "tesla|model y long range": { battery_kwh: 75,   range_mi: 330, dc_fast_kw: 250, efficiency_mi_per_kwh: 4.0 },
  "tesla|model s":           { battery_kwh: 100,  range_mi: 405, dc_fast_kw: 250, efficiency_mi_per_kwh: 3.8 },
  "tesla|model x":           { battery_kwh: 100,  range_mi: 348, dc_fast_kw: 250, efficiency_mi_per_kwh: 3.3 },
  "tesla|cybertruck":        { battery_kwh: 123,  range_mi: 340, dc_fast_kw: 250, efficiency_mi_per_kwh: 2.8 },
  // Kia
  "kia|ev6":                 { battery_kwh: 77.4, range_mi: 310, dc_fast_kw: 233, efficiency_mi_per_kwh: 3.7 },
  "kia|ev9":                 { battery_kwh: 99.8, range_mi: 304, dc_fast_kw: 233, efficiency_mi_per_kwh: 3.0 },
  "kia|niro ev":             { battery_kwh: 64.8, range_mi: 253, dc_fast_kw: 85,  efficiency_mi_per_kwh: 3.8 },
  // Hyundai
  "hyundai|ioniq 5":         { battery_kwh: 77.4, range_mi: 303, dc_fast_kw: 233, efficiency_mi_per_kwh: 3.6 },
  "hyundai|ioniq 6":         { battery_kwh: 77.4, range_mi: 361, dc_fast_kw: 233, efficiency_mi_per_kwh: 4.4 },
  "hyundai|kona electric":   { battery_kwh: 64.8, range_mi: 261, dc_fast_kw: 100, efficiency_mi_per_kwh: 3.9 },
  // Chevrolet
  "chevrolet|bolt ev":       { battery_kwh: 65,   range_mi: 259, dc_fast_kw: 55,  efficiency_mi_per_kwh: 3.5 },
  "chevrolet|bolt euv":      { battery_kwh: 65,   range_mi: 247, dc_fast_kw: 55,  efficiency_mi_per_kwh: 3.5 },
  "chevrolet|blazer ev":     { battery_kwh: 85,   range_mi: 320, dc_fast_kw: 190, efficiency_mi_per_kwh: 3.4 },
  "chevrolet|equinox ev":    { battery_kwh: 85,   range_mi: 319, dc_fast_kw: 150, efficiency_mi_per_kwh: 3.6 },
  // Ford
  "ford|mustang mach-e":     { battery_kwh: 91,   range_mi: 312, dc_fast_kw: 150, efficiency_mi_per_kwh: 3.1 },
  "ford|f-150 lightning":    { battery_kwh: 131,  range_mi: 320, dc_fast_kw: 150, efficiency_mi_per_kwh: 2.1 },
  // Nissan
  "nissan|leaf":             { battery_kwh: 40,   range_mi: 149, dc_fast_kw: 50,  efficiency_mi_per_kwh: 3.6 },
  "nissan|leaf plus":        { battery_kwh: 62,   range_mi: 212, dc_fast_kw: 100, efficiency_mi_per_kwh: 3.3 },
  "nissan|ariya":            { battery_kwh: 87,   range_mi: 304, dc_fast_kw: 130, efficiency_mi_per_kwh: 3.2 },
  // Volkswagen
  "volkswagen|id.4":         { battery_kwh: 82,   range_mi: 291, dc_fast_kw: 135, efficiency_mi_per_kwh: 3.4 },
  // BMW
  "bmw|i4":                  { battery_kwh: 83.9, range_mi: 301, dc_fast_kw: 205, efficiency_mi_per_kwh: 3.3 },
  "bmw|ix":                  { battery_kwh: 111,  range_mi: 324, dc_fast_kw: 200, efficiency_mi_per_kwh: 2.8 },
  // Mercedes
  "mercedes-benz|eqs":       { battery_kwh: 107.8,range_mi: 350, dc_fast_kw: 200, efficiency_mi_per_kwh: 3.0 },
  "mercedes-benz|eqe":       { battery_kwh: 90.6, range_mi: 305, dc_fast_kw: 170, efficiency_mi_per_kwh: 3.3 },
  // Rivian
  "rivian|r1t":              { battery_kwh: 135,  range_mi: 314, dc_fast_kw: 200, efficiency_mi_per_kwh: 2.3 },
  "rivian|r1s":              { battery_kwh: 135,  range_mi: 321, dc_fast_kw: 200, efficiency_mi_per_kwh: 2.3 },
  // Lucid
  "lucid|air":               { battery_kwh: 112,  range_mi: 516, dc_fast_kw: 300, efficiency_mi_per_kwh: 4.5 },
  // Polestar
  "polestar|2":              { battery_kwh: 78,   range_mi: 270, dc_fast_kw: 205, efficiency_mi_per_kwh: 3.3 },
  // GMC
  "gmc|hummer ev":           { battery_kwh: 212,  range_mi: 329, dc_fast_kw: 350, efficiency_mi_per_kwh: 1.6 },
  // Cadillac
  "cadillac|lyriq":          { battery_kwh: 102,  range_mi: 314, dc_fast_kw: 190, efficiency_mi_per_kwh: 2.9 },
};

/**
 * Look up static EV specs for a vehicle. Tries trim-aware key first,
 * then base model key.
 */
function lookupEvSpecs(make: string, model: string, trim?: string): EvSpecEntry | null {
  const mk = make.toLowerCase();
  const md = model.toLowerCase();
  // Try "make|model trim" first (e.g. "tesla|model 3 long range")
  if (trim) {
    const fullKey = `${mk}|${md} ${trim.toLowerCase()}`;
    if (EV_SPECS[fullKey]) return EV_SPECS[fullKey];
  }
  // Try "make|model" (e.g. "tesla|cybertruck")
  const baseKey = `${mk}|${md}`;
  return EV_SPECS[baseKey] ?? null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const vin = (body.vin as string | undefined)?.trim().toUpperCase();

  if (!vin || vin.length !== 17) {
    return NextResponse.json({ success: false, error: "A 17-character VIN is required" }, { status: 400 });
  }

  // Decode VIN and search listings in parallel
  const [vinData, listingsData] = await Promise.all([
    decodeVin(vin),
    searchListings({ vin, limit: 6 }),
  ]);

  if (!vinData) {
    return NextResponse.json(
      { success: false, error: "VIN not found — check it's correct and try again" },
      { status: 404 }
    );
  }

  // Auto.dev returns make/model as either a string or { name: string }
  const resolveName = (v: string | { name?: string } | undefined): string | undefined => {
    if (!v) return undefined;
    if (typeof v === "string") return v || undefined;
    return v.name || undefined;
  };

  // Build structured fields from VIN decode
  // Auto.dev sometimes returns year in years[0].year instead of top-level modelYear/year
  const resolvedYear = vinData.modelYear
    ? Number(vinData.modelYear)
    : (vinData.year ?? vinData.years?.[0]?.year ?? undefined);

  const fields: Record<string, unknown> = {
    vin,
    year: resolvedYear,
    make: resolveName(vinData.make),
    model: resolveName(vinData.model),
    trim: vinData.trim ?? undefined,
  };

  // EV spec extraction from VIN decode data
  // MPGe (city+highway combined) → efficiency in mi/kWh  (MPGe ÷ 33.7)
  if (vinData.mpg) {
    const cityMpg = vinData.mpg.city ? parseFloat(vinData.mpg.city) : null;
    const hwyMpg = vinData.mpg.highway ? parseFloat(vinData.mpg.highway) : null;
    // Only treat as MPGe if the value is suspiciously high for a normal ICE car (>50 MPG city)
    // Tesla Model 3 city MPGe ≈ 138; Kia EV6 ≈ 132 — ICE cars rarely exceed 50 city
    if (cityMpg && cityMpg > 50) {
      const combinedMpge = hwyMpg ? Math.round((cityMpg + hwyMpg) / 2) : cityMpg;
      const eff = Math.round((combinedMpge / 33.7) * 10) / 10;
      if (eff >= 2 && eff <= 10) fields.efficiency_mi_per_kwh = eff;
    }
  }

  // Body style from VIN decode
  if (vinData.categories?.vehicleStyle) {
    fields.body_style = vinData.categories.vehicleStyle;
  }

  // Fill missing EV specs from static lookup table
  const make = fields.make as string | undefined;
  const model = fields.model as string | undefined;
  const trim = fields.trim as string | undefined;
  if (make && model) {
    const evSpecs = lookupEvSpecs(make, model, trim);
    if (evSpecs) {
      if (!fields.battery_kwh && evSpecs.battery_kwh) fields.battery_kwh = evSpecs.battery_kwh;
      if (!fields.range_mi && evSpecs.range_mi) fields.range_mi = evSpecs.range_mi;
      if (!fields.dc_fast_kw && evSpecs.dc_fast_kw) fields.dc_fast_kw = evSpecs.dc_fast_kw;
      if (!fields.efficiency_mi_per_kwh && evSpecs.efficiency_mi_per_kwh) fields.efficiency_mi_per_kwh = evSpecs.efficiency_mi_per_kwh;
    }
  }

  // Pull photos from listings
  const photoUrls: string[] = [];
  if (listingsData?.records) {
    for (const record of listingsData.records) {
      if (record.primaryPhotoUrl && !photoUrls.includes(record.primaryPhotoUrl)) {
        photoUrls.push(record.primaryPhotoUrl);
      }
      if (photoUrls.length >= 6) break;
    }
  }

  // Build a market price range if listings available
  let market_price_range: { low: number; high: number; count: number } | undefined;
  if (listingsData?.records && listingsData.records.length >= 2) {
    const prices = listingsData.records
      .map((r) => r.priceUnformatted)
      .filter((p): p is number => typeof p === "number" && p > 0);
    if (prices.length >= 2) {
      market_price_range = {
        low: Math.min(...prices),
        high: Math.max(...prices),
        count: prices.length,
      };
    }
  }

  // Build auto_dev_specs for downstream consumers (engine, body style, MSRP)
  const engineParts = [
    vinData.engine?.cylinder ? `${vinData.engine.cylinder}-cyl` : null,
    vinData.engine?.size ? `${vinData.engine.size}L` : null,
    vinData.engine?.fuelType ?? null,
  ].filter(Boolean);
  const auto_dev_specs = {
    engine: engineParts.length ? engineParts.join(" ") : undefined,
    mpg_city: vinData.mpg?.city ? parseFloat(vinData.mpg.city) : undefined,
    mpg_highway: vinData.mpg?.highway ? parseFloat(vinData.mpg.highway) : undefined,
    drive: vinData.drivenWheels,
    body_style: vinData.categories?.vehicleStyle,
    msrp: vinData.price?.baseMsrp,
    used_tmv: vinData.price?.usedTmvRetail,
  };

  const vehicleLabel = [fields.year, fields.make, fields.model, fields.trim]
    .filter(Boolean)
    .join(" ") || undefined;

  return NextResponse.json({
    success: true,
    fields,
    photo_urls: photoUrls,
    market_price_range: market_price_range ?? null,
    vehicle_label: vehicleLabel ?? null,
    auto_dev_specs,
  });
}
