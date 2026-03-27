/**
 * GET /api/news
 *
 * Public endpoint — no auth required.
 * Returns scored EV routine-impact articles from daily_routine_news.
 * Only exposes a safe subset of fields (no generated social posts).
 *
 * Query params:
 *   hours     — look-back window in hours (default 48, max 168)
 *   limit     — max articles (default 20, max 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const revalidate = 60; // revalidate every 1 minute

const rateLimiter = new RateLimiter(60 * 1000, 30); // 30 req/min per IP

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const params = req.nextUrl.searchParams;
  const hours = Math.min(parseInt(params.get("hours") || "48", 10), 168);
  const limit = Math.min(parseInt(params.get("limit") || "20", 10), 50);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("daily_routine_news")
    .select(
      "id, title, url, source, published_at, impact_score, key_routine_effects, ai_summary, post_worthy, scored_at"
    )
    .gte("scored_at", since)
    .gte("impact_score", 65)
    .eq("is_routine_impact", true)
    .order("impact_score", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      articles: data || [],
      total: (data || []).length,
      since,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    }
  );
}
