/**
 * POST /api/admin/deals-backfill-photos
 *
 * Batch-fills photo_url for all active curated_deals rows where photo_url IS NULL.
 * Fetches photos via local CSV → static Wikimedia map → make fallback → VinAudit.
 * Does NOT call Auto.dev (returns wrong-car images for non-matching vehicles).
 * Rows that still have no photo stay NULL; the client DealCard fallback handles them.
 * Processes up to 50 rows per call to avoid timeouts.
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getVehicleImages } from "@/lib/vinaudit-client";
import { getStaticPhotoUrl, MAKE_FALLBACK_MAP } from "@/lib/vehicle-photo";
import { lookupLocalImages } from "@/lib/vehicle-image-db";

export const maxDuration = 60;

const ADMIN_KEY = process.env.ADMIN_API_KEY;

function proxyIfWikimedia(url: string): string {
  if (url.includes("upload.wikimedia.org")) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function fetchPhoto(row: { id: string; make: string | null; model: string | null; year: number | null; trim: string | null }): Promise<string | null> {
  const make = row.make ?? undefined;
  const rawModel = [row.model, row.trim].filter(Boolean).join(" ") || undefined;

  // Tier 0a: OFFO local CSV — year-aware, handles trim variants (e.g. "Blazer EV LT RWD" → "Blazer EV")
  if (make && rawModel) {
    const local = lookupLocalImages(make, rawModel, row.year ?? undefined);
    if (local.matched && local.urls.length > 0) return proxyIfWikimedia(local.urls[0]);
  }

  // Tier 0b: static curated photo map — zero latency, most reliable for common EVs
  const staticUrl = getStaticPhotoUrl(make, rawModel, row.year ?? undefined);
  if (staticUrl) return proxyIfWikimedia(staticUrl);

  // Tier 0b: make-level fallback
  const makeFallback = make ? MAKE_FALLBACK_MAP[make.toLowerCase()] : undefined;
  if (makeFallback) return proxyIfWikimedia(makeFallback);

  // Tier 1: VinAudit
  const vinauditResult = await getVehicleImages({ year: row.year ?? undefined, make, model: rawModel, limit: 1 });
  if (vinauditResult.success && vinauditResult.photo_urls.length > 0) {
    return vinauditResult.photo_urls[0];
  }

  // No Auto.dev here — it returns wrong-car results for vehicles it can't match
  // (e.g. returns Audi e-tron for everything). Rows with no photo stay NULL;
  // the client-side DealCard fallback handles them with no_market=1.
  return null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Fetch up to 50 active rows with no photo
  const { data: rows, error: fetchError } = await supabase
    .from("curated_deals")
    .select("id, make, model, year, trim")
    .eq("is_active", true)
    .is("photo_url", null)
    .limit(50);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ success: true, updated: 0, failed: 0, message: "No rows need photos" });
  }

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const photoUrl = await fetchPhoto(row);
      if (photoUrl) {
        const { error: updateError } = await supabase
          .from("curated_deals")
          .update({ photo_url: photoUrl })
          .eq("id", row.id)
          .is("photo_url", null);
        if (!updateError) {
          updated++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    // Small delay between rows to avoid hammering external APIs
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({ success: true, updated, failed, total: rows.length });
}
