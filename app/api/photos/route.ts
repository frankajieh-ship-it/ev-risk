/**
 * GET /api/photos?make=Tesla&model=Model+3&year=2023&vin=...
 *
 * Fetches listing photos from Auto.dev for a given vehicle.
 * Used as a client-side fallback when extraction doesn't return photos.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchListings } from "@/lib/auto-dev-client";

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const vin = p.get("vin") || undefined;
  const make = p.get("make") || undefined;
  const model = p.get("model") || undefined;
  const year = p.get("year") ? Number(p.get("year")) : undefined;

  if (!vin && !make) {
    return NextResponse.json({ photo_urls: [] });
  }

  const result = await searchListings({ vin, make, model, year, limit: 8 });

  const photoUrls: string[] = [];
  if (result?.records) {
    for (const record of result.records) {
      if (record.primaryPhotoUrl && !photoUrls.includes(record.primaryPhotoUrl)) {
        photoUrls.push(record.primaryPhotoUrl);
      }
      if (photoUrls.length >= 6) break;
    }
  }

  return NextResponse.json({ photo_urls: photoUrls });
}
