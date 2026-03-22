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

  const vehicleLabel = [fields.year, fields.make, fields.model, fields.trim]
    .filter(Boolean)
    .join(" ") || undefined;

  return NextResponse.json({
    success: true,
    fields,
    photo_urls: photoUrls,
    market_price_range: market_price_range ?? null,
    vehicle_label: vehicleLabel ?? null,
  });
}
