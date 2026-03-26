/**
 * GET /api/photos?make=Tesla&model=Model+3&year=2023&vin=...
 *
 * Fetches listing photos from Auto.dev for a given vehicle.
 * Used as a client-side fallback when extraction doesn't return photos.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchListings } from "@/lib/auto-dev-client";

export const maxDuration = 10;

// Auto.dev uses specific model name formats that differ from our internal names.
// Map known problem cases: key = lowercase model (after stripping make prefix), value = Auto.dev model string.
const MODEL_NAME_MAP: Record<string, string> = {
  "leaf": "LEAF",
  "leaf s": "LEAF",
  "leaf sv": "LEAF",
  "leaf sl": "LEAF",
  "leaf plus s": "LEAF",
  "leaf plus sv": "LEAF",
  "leaf plus sl": "LEAF",
};

/**
 * Normalize a model name for Auto.dev search.
 * 1. Strip the make prefix if present (e.g. "Chevrolet Bolt EUV" → "Bolt EUV")
 * 2. Apply known model name overrides
 */
function normalizeModel(make: string | undefined, model: string | undefined): string | undefined {
  if (!model) return model;
  let m = model.trim();
  // Strip make prefix (e.g. "Chevrolet Bolt EUV" when make="Chevrolet")
  if (make && m.toLowerCase().startsWith(make.toLowerCase() + " ")) {
    m = m.slice(make.length + 1).trim();
  }
  // Apply known overrides
  const key = m.toLowerCase();
  return MODEL_NAME_MAP[key] ?? m;
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const vin = p.get("vin") || undefined;
  const make = p.get("make") || undefined;
  const rawModel = p.get("model") || undefined;
  const year = p.get("year") ? Number(p.get("year")) : undefined;

  if (!vin && !make) {
    return NextResponse.json({ photo_urls: [] });
  }

  const model = normalizeModel(make, rawModel);
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
