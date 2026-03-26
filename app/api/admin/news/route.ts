/**
 * GET /api/admin/news
 *
 * Fetches scored articles from daily_routine_news for the admin dashboard.
 *
 * Query params:
 *   hours      — look back N hours (default 48)
 *   min_score  — minimum impact score filter (default 0)
 *   limit      — max articles to return (default 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const params = req.nextUrl.searchParams;
  const hours = Math.min(parseInt(params.get("hours") || "48", 10), 168);
  const minScore = parseInt(params.get("min_score") || "0", 10);
  const limit = Math.min(parseInt(params.get("limit") || "50", 10), 100);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("daily_routine_news")
    .select("*")
    .gte("scored_at", since)
    .gte("impact_score", minScore)
    .order("impact_score", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    articles: data || [],
    total: (data || []).length,
    since,
  });
}
