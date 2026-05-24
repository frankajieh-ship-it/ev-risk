/**
 * POST /api/admin/sync-dealer-inventory
 *
 * Syncs active dealer inventory into curated_deals so dealer listings
 * appear on the public /deals page with a verified dealer badge.
 *
 * For each approved dealership with active inventory:
 * - Upserts a curated_deals row keyed on listing_url
 * - Sets dealership_id so the /deals API can JOIN and show the badge
 * - Uses dealer's own photo, price, and vehicle label
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 60;

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Fetch all approved dealerships
  const { data: dealerships, error: dealerError } = await supabase
    .from("dealerships")
    .select("id, name, slug, city, state")
    .eq("status", "approved");

  if (dealerError) {
    return NextResponse.json({ error: dealerError.message }, { status: 500 });
  }
  if (!dealerships || dealerships.length === 0) {
    return NextResponse.json({ success: true, upserted: 0, message: "No approved dealerships" });
  }

  let upserted = 0;
  let skipped = 0;

  for (const dealer of dealerships) {
    // Fetch active inventory for this dealer
    const { data: inventory, error: invError } = await supabase
      .from("dealer_inventory")
      .select("id, make, model, year, trim, price_cents, mileage, listing_url, photo_urls")
      .eq("dealership_id", dealer.id)
      .eq("status", "active");

    if (invError || !inventory?.length) continue;

    for (const item of inventory) {
      if (!item.make || !item.model) { skipped++; continue; }

      // Use the dealer's own listing_url, or construct a canonical OFFO URL
      const listingUrl = item.listing_url?.trim() ||
        `https://offolab.com/dealers/${dealer.slug}/inventory/${item.id}`;

      const vehicleLabel = [item.year, item.make, item.model, item.trim]
        .filter(Boolean).join(" ");

      const price = item.price_cents ? Math.round(item.price_cents / 100) : null;
      const photoUrl = Array.isArray(item.photo_urls) && item.photo_urls.length > 0
        ? item.photo_urls[0]
        : null;

      const location = [dealer.city, dealer.state].filter(Boolean).join(", ") || null;

      const { error: upsertError } = await supabase
        .from("curated_deals")
        .upsert(
          {
            listing_url: listingUrl,
            url_domain: "offo.dealer",
            vehicle_label: vehicleLabel,
            year: item.year ?? null,
            make: item.make,
            model: item.model,
            trim: item.trim ?? null,
            price,
            mileage: item.mileage ?? null,
            location,
            photo_url: photoUrl,
            dealership_id: dealer.id,
            is_active: true,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "listing_url", ignoreDuplicates: false }
        );

      if (upsertError) {
        console.error(`[sync-dealer-inventory] upsert failed for ${listingUrl}:`, upsertError.message);
        skipped++;
      } else {
        upserted++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    upserted,
    skipped,
    dealerships: dealerships.length,
  });
}
