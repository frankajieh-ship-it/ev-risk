/**
 * GET /api/deals
 *
 * Public endpoint — returns OFFO-curated pre-analyzed EV deals.
 * Sorted by deal_quality_score DESC. Supports filtering and pagination.
 *
 * Query params:
 *   verdict     = GREEN | YELLOW | RED (comma-separated, default: GREEN,YELLOW)
 *   make        = e.g. Tesla
 *   model       = e.g. Model 3
 *   price_max   = max price in USD
 *   mileage_max = max mileage
 *   year_min    = min year
 *   sort        = quality | price_asc | price_desc | mileage | newest (default: quality)
 *   page        = page number (default: 1)
 *   per_page    = results per page (default: 20, max: 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

const rateLimiter = new RateLimiter(60 * 1000, 30); // 30 req/min per IP

const VALID_VERDICTS = new Set(["GREEN", "YELLOW", "RED"]);

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  if (!rateLimiter.check(ip).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;

  // Parse filters
  const verdictParam = params.get("verdict") ?? "GREEN,YELLOW";
  const verdicts = verdictParam.split(",").map((v) => v.trim().toUpperCase()).filter((v) => VALID_VERDICTS.has(v));
  const make = params.get("make")?.trim() ?? null;
  const model = params.get("model")?.trim() ?? null;
  const priceMax = params.get("price_max") ? parseInt(params.get("price_max")!) : null;
  const mileageMax = params.get("mileage_max") ? parseInt(params.get("mileage_max")!) : null;
  const yearMin = params.get("year_min") ? parseInt(params.get("year_min")!) : null;
  const location = params.get("location")?.trim() ?? null;
  const sort = params.get("sort") ?? "quality";

  // Pagination
  const page = Math.max(1, parseInt(params.get("page") ?? "1"));
  const perPage = Math.min(50, Math.max(1, parseInt(params.get("per_page") ?? "20")));
  const offset = (page - 1) * perPage;

  // Determine sort column + direction
  const sortMap: Record<string, { col: string; asc: boolean }> = {
    quality:    { col: "deal_quality_score", asc: false },
    price_asc:  { col: "price",              asc: true  },
    price_desc: { col: "price",              asc: false },
    mileage:    { col: "mileage",            asc: true  },
    newest:     { col: "year",               asc: false },
  };
  const { col: sortCol, asc: sortAsc } = sortMap[sort] ?? sortMap.quality;

  let query = supabase
    .from("curated_deals")
    .select("id, listing_url, url_domain, vehicle_label, year, make, model, trim, price, mileage, location, verdict, evidence_score, fit_score, risk_points, deal_quality_score, risk_flags, receipt_id, photo_url, last_analyzed_at", { count: "exact" })
    .eq("is_active", true)
    .not("vehicle_label", "is", null)
    .not("make", "is", null)
    .not("price", "is", null)
    .order(sortCol, { ascending: sortAsc, nullsFirst: false })
    .range(offset, offset + perPage - 1);

  if (verdicts.length > 0) {
    query = query.in("verdict", verdicts);
  }
  if (make) {
    query = query.ilike("make", `%${make}%`);
  }
  if (model) {
    query = query.ilike("model", `%${model}%`);
  }
  if (priceMax && !isNaN(priceMax)) {
    query = query.lte("price", priceMax);
  }
  if (mileageMax && !isNaN(mileageMax)) {
    query = query.lte("mileage", mileageMax);
  }
  if (yearMin && !isNaN(yearMin)) {
    query = query.gte("year", yearMin);
  }
  if (location) {
    query = query.ilike("location", `%${location}%`);
  }

  const { data: deals, count, error } = await query;

  if (error) {
    console.error("[/api/deals] Query failed:", error.message);
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }

  // Deduplicate by (make, model, year, trim) — keep highest deal_quality_score per spec.
  // This prevents near-identical listings of the same vehicle from flooding results.
  const seen = new Map<string, (typeof deals)[0]>();
  for (const deal of deals ?? []) {
    const key = [
      (deal.make ?? "").toLowerCase().trim(),
      (deal.model ?? "").toLowerCase().trim(),
      deal.year ?? 0,
      (deal.trim ?? "").toLowerCase().trim(),
    ].join("|");
    const existing = seen.get(key);
    if (!existing || (deal.deal_quality_score ?? 0) > (existing.deal_quality_score ?? 0)) {
      seen.set(key, deal);
    }
  }
  const deduped = Array.from(seen.values());

  return NextResponse.json(
    {
      success: true,
      deals: deduped,
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
