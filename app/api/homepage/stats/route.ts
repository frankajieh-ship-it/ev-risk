/**
 * GET /api/homepage/stats
 *
 * Returns live social proof stats for the homepage:
 * - Total receipt count (all-time)
 * - Top makes/models analyzed in the last 7 days
 *
 * Cached at the CDN layer for 5 minutes so it's fast and doesn't
 * hammer the DB on every page load.
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const CACHE_SECONDS = 300; // 5 min CDN cache

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Run in parallel: total count + recent top models
    const [countResult, recentResult] = await Promise.all([
      supabase.from("receipts").select("id", { count: "exact", head: true }),
      supabase
        .from("receipts")
        .select("input_json")
        .gte("created_at", sevenDaysAgo)
        .not("input_json", "is", null)
        .limit(500),
    ]);

    const totalCount = countResult.count ?? 0;

    // Tally make/model from recent input_json
    const tally: Record<string, { make: string; model: string; count: number }> = {};
    for (const row of recentResult.data ?? []) {
      const input = row.input_json as Record<string, unknown> | null;
      if (!input) continue;
      const make = typeof input.make === "string" ? input.make : null;
      const model = typeof input.model === "string" ? input.model : null;
      if (!make || !model) continue;
      const key = `${make}|${model}`;
      if (!tally[key]) tally[key] = { make, model, count: 0 };
      tally[key].count++;
    }

    const topModels = Object.values(tally)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(({ make, model, count }) => ({ make, model, count }));

    return NextResponse.json(
      {
        success: true,
        total_receipts: totalCount,
        top_models: topModels,
        generated_at: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
        },
      }
    );
  } catch (err) {
    console.error("[/api/homepage/stats] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
