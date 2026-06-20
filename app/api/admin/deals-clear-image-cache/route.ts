/**
 * POST /api/admin/deals-clear-image-cache
 *
 * Deletes all rows from vehicle_images where the cached URL is from a
 * marketplace listing CDN (CarGurus, CarMax, Auto.dev, etc.) rather than
 * a reliable stock image source. This forces the next /api/photos call to
 * re-derive from the static Wikimedia map or VinAudit instead.
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 60;

const ADMIN_KEY = process.env.ADMIN_API_KEY;

// CDN domains that indicate a marketplace listing photo (unreliable, may show wrong car)
const BAD_DOMAINS = [
  "static.cargurus.com",
  "media.cargurus.com",
  "img.cargurus.com",
  "cdn.cargurus.com",
  "carmax.scene7.com",
  "photos.dealer.com",
  "pictures.dealer.com",
  "img.dealer.com",
  "auto.dev",
  "img.autodev.com",
  "images.autodev.com",
  "photos.autodev.com",
  "photon.vroom.com",
  "img.carvana.com",
  "img.autotrader.com",
  "images.autotrader.com",
  "images.cars.com",
  "i.cars.com",
];

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Fetch all vehicle_images rows and filter client-side (PostgREST can't do OR-contains on text)
  const { data: rows, error: fetchError } = await supabase
    .from("vehicle_images")
    .select("id, primary_url");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const badIds = (rows ?? [])
    .filter((row) => BAD_DOMAINS.some((domain) => (row.primary_url ?? "").includes(domain)))
    .map((row) => row.id);

  if (badIds.length === 0) {
    return NextResponse.json({ success: true, cleared: 0, message: "No stale marketplace cache entries found" });
  }

  const { error: deleteError } = await supabase
    .from("vehicle_images")
    .delete()
    .in("id", badIds);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, cleared: badIds.length });
}
