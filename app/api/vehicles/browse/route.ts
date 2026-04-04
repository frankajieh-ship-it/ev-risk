/**
 * GET /api/vehicles/browse
 *
 * Cross-dealer vehicle search. Queries active dealer_inventory joined with
 * dealerships for location context. No authentication required.
 *
 * Query params:
 *   make, model, year_min, year_max, price_max, state, category (EV|PHEV|ICE),
 *   page (default 1), limit (default 20, max 40)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";

const rateLimiter = new RateLimiter(60 * 1000, 60); // 60 req/min per IP

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  if (!rateLimiter.check(ip).allowed) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Service unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(40, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  const make = searchParams.get("make")?.trim();
  const model = searchParams.get("model")?.trim();
  const yearMin = searchParams.get("year_min") ? parseInt(searchParams.get("year_min")!, 10) : null;
  const yearMax = searchParams.get("year_max") ? parseInt(searchParams.get("year_max")!, 10) : null;
  const priceMax = searchParams.get("price_max") ? parseInt(searchParams.get("price_max")!, 10) : null;
  const state = searchParams.get("state")?.trim();
  const category = searchParams.get("category")?.trim(); // EV | PHEV | ICE

  // Build query with dealership join for city/state/slug/verified
  let query = supabase
    .from("dealer_inventory")
    .select(
      `id, make, model, year, trim, price_cents, mileage, exterior_color,
       photo_urls, classification, listing_url,
       dealerships!inner(name, slug, city, state, is_verified)`,
      { count: "exact" }
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (make) query = query.ilike("make", `%${make}%`);
  if (model) query = query.ilike("model", `%${model}%`);
  if (yearMin) query = query.gte("year", yearMin);
  if (yearMax) query = query.lte("year", yearMax);
  if (priceMax) query = query.lte("price_cents", priceMax * 100);
  if (category) query = query.contains("classification", { category });
  if (state) query = query.eq("dealerships.state", state);

  const { data, error, count } = await query;

  if (error) {
    console.error("[/api/vehicles/browse]", error.message);
    return NextResponse.json({ success: false, error: "Query failed" }, { status: 500 });
  }

  const pages = Math.ceil((count ?? 0) / limit);

  return NextResponse.json(
    {
      success: true,
      vehicles: data ?? [],
      total: count ?? 0,
      page,
      limit,
      pages,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    }
  );
}
