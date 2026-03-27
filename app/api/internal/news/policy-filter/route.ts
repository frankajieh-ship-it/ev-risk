/**
 * POST /api/internal/news/policy-filter
 *
 * Stub endpoint for routine-only news policy filtering.
 * Filters a list of article IDs by whether their key_routine_effects
 * overlap with the provided routine_tags. Pure JS — no LLM call.
 *
 * Used by future scheduled job to pre-filter news daily.
 * Internal server-to-server only (INTERNAL_API_SECRET required).
 *
 * Body: { article_ids: string[], routine_tags: string[] }
 * Returns: { filtered_ids: string[], total: number, matched: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 10;

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;
  if (expected && secret === expected) return true;
  const serviceKey = req.headers.get("x-service-role-key");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { article_ids?: string[]; routine_tags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { article_ids = [], routine_tags = [] } = body;

  if (!article_ids.length) {
    return NextResponse.json({ filtered_ids: [], total: 0, matched: 0 });
  }

  if (!routine_tags.length) {
    // No filter — return all
    return NextResponse.json({ filtered_ids: article_ids, total: article_ids.length, matched: article_ids.length });
  }

  // Fetch the articles' key_routine_effects
  const { data: articles, error } = await supabase
    .from("daily_routine_news")
    .select("id, key_routine_effects")
    .in("id", article_ids.slice(0, 200));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const routineTagsLower = routine_tags.map((t) => t.toLowerCase());

  const filteredIds: string[] = [];
  for (const article of articles || []) {
    const effects: string[] = Array.isArray(article.key_routine_effects)
      ? article.key_routine_effects.map((e: string) => e.toLowerCase())
      : [];

    const matches = effects.some((e) =>
      routineTagsLower.some((tag) => e.includes(tag) || tag.includes(e))
    );

    if (matches) filteredIds.push(article.id);
  }

  return NextResponse.json({
    filtered_ids: filteredIds,
    total: article_ids.length,
    matched: filteredIds.length,
  });
}
