/**
 * GET /api/news
 *
 * Public endpoint — no auth required.
 * Returns scored EV news articles from daily_routine_news.
 * Only exposes a safe subset of fields (no generated social posts).
 *
 * Query params:
 *   hours     — look-back window in hours (default 48, max 168)
 *   limit     — max articles (default 20, max 50)
 *   category  — filter by category: routine_impact | recall | used_market | charging_network | all (default: all)
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const revalidate = 60; // revalidate every 1 minute

const rateLimiter = new RateLimiter(60 * 1000, 30); // 30 req/min per IP

const VALID_CATEGORIES = new Set(["routine_impact", "recall", "used_market", "charging_network"]);

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
  const hours = Math.min(parseInt(params.get("hours") || "168", 10), 168);
  const limit = Math.min(parseInt(params.get("limit") || "20", 10), 50);
  const categoryParam = params.get("category") || "all";
  const category = VALID_CATEGORIES.has(categoryParam) ? categoryParam : "all";

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("daily_routine_news")
    .select(
      "id, title, url, source, published_at, impact_score, category, key_routine_effects, ai_summary, post_worthy, scored_at"
    )
    .gte("scored_at", since)
    .order("impact_score", { ascending: false })
    .limit(limit);

  if (category !== "all") {
    // Specific category — use that category's minimum threshold
    const minScore = category === "recall" ? 50 : 60;
    query = query.eq("category", category).gte("impact_score", minScore);
  } else {
    // All categories — use 60 as the floor (recalls at 50-59 are included per-category only)
    query = query.gte("impact_score", 60);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      articles: data || [],
      total: (data || []).length,
      since,
      category,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    }
  );
}
