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
  const fields: Record<string, unknown> = {
    vin,
    year: vinData.modelYear ? Number(vinData.modelYear) : (vinData.year ?? undefined),
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
