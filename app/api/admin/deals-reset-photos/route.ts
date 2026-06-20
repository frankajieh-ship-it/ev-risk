/**
 * POST /api/admin/deals-reset-photos
 *
 * Clears photo_url on all curated_deals rows and immediately re-resolves
 * each one from the static Wikimedia map (sync, no external HTTP calls).
 * Use this when the DB has cached wrong-car photos.
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getStaticPhotoUrl, MAKE_FALLBACK_MAP } from "@/lib/vehicle-photo";
import { lookupLocalImages } from "@/lib/vehicle-image-db";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export const maxDuration = 60;

function proxyIfWikimedia(url: string): string {
  return url.includes("upload.wikimedia.org")
    ? `/api/img?url=${encodeURIComponent(url)}`
    : url;
}

function resolvePhotoSync(make: string, model: string | null, year: number | null): string | null {
  if (model) {
    const local = lookupLocalImages(make, model, year ?? undefined);
    if (local.matched && local.urls.length > 0) return proxyIfWikimedia(local.urls[0]);
  }
  const staticUrl = getStaticPhotoUrl(make, model ?? undefined, year ?? undefined);
  if (staticUrl) return proxyIfWikimedia(staticUrl);
  const fallback = MAKE_FALLBACK_MAP[make.toLowerCase()];
  return fallback ? proxyIfWikimedia(fallback) : null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Fetch all deals
  const { data: deals, error: fetchErr } = await supabase
    .from("curated_deals")
    .select("id, make, model, year, photo_url");

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!deals?.length) return NextResponse.json({ success: true, updated: 0, message: "No deals found" });

  let updated = 0;
  let unchanged = 0;
  let nulled = 0;

  for (const deal of deals) {
    if (!deal.make) { nulled++; continue; }
    const resolved = resolvePhotoSync(deal.make, deal.model, deal.year);
    if (!resolved) { nulled++; continue; }

    // Only write if the resolved URL differs from what's stored
    if (deal.photo_url === resolved) { unchanged++; continue; }

    const { error: updateErr } = await supabase
      .from("curated_deals")
      .update({ photo_url: resolved })
      .eq("id", deal.id);

    if (!updateErr) updated++;
  }

  return NextResponse.json({
    success: true,
    total: deals.length,
    updated,
    unchanged,
    nulled,
    message: `Reset ${updated} deal photos to correct static map URLs`,
  });
}
