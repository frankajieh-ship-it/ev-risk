/**
 * GET /api/images/vehicle
 *
 * OFFO Image Extractor endpoint — cached, scored, source-attributed.
 *
 * Query params:
 *   make      (required)
 *   model     (required)
 *   year      (required)
 *   vin       (optional) — enables Tier 1 exact-VIN lookup
 *   trim      (optional) — improves YMM cache key specificity
 *
 * Response:
 *   { urls, primary_url, source, quality_score, cache_hit, extraction_ms }
 */

import { NextRequest, NextResponse } from "next/server";
import { extractVehicleImages } from "@/lib/image-extractor";

export const maxDuration = 15;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const make = p.get("make")?.trim();
  const model = p.get("model")?.trim();
  const yearRaw = p.get("year");
  const vin = p.get("vin")?.trim() || undefined;
  const trim = p.get("trim")?.trim() || undefined;

  if (!make || !model || !yearRaw) {
    return NextResponse.json(
      { error: "make, model, and year are required" },
      { status: 400 }
    );
  }

  const year = parseInt(yearRaw);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return NextResponse.json({ error: "invalid year" }, { status: 400 });
  }

  const result = await extractVehicleImages({ make, model, year, vin, trim });

  return NextResponse.json(result, {
    headers: {
      // Cache at CDN/browser: 5 min for misses, 1hr for hits
      "Cache-Control": result.cache_hit
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
