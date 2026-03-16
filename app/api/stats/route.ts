/**
 * Public Stats Endpoint
 *
 * GET /api/stats
 *
 * Returns aggregate usage counts for social proof display.
 * No auth required. Cached with a 1-hour revalidation window.
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Static fallback in case DB is unavailable
const FALLBACK = { total_checks: 1200, avg_rating: 4.5 };

// Cache for 1 hour at the edge
export const revalidate = 3600;

export async function GET() {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(FALLBACK);
  }

  try {
    const [receiptsRes, scenariosRes, feedbackRes] = await Promise.all([
      supabase.from("receipts").select("id", { count: "exact", head: true }),
      supabase.from("saved_scenarios").select("id", { count: "exact", head: true }),
      supabase
        .from("report_feedback")
        .select("rating")
        .not("rating", "is", null),
    ]);

    const receiptCount = receiptsRes.count ?? 0;
    const scenarioCount = scenariosRes.count ?? 0;
    const total_checks = receiptCount + scenarioCount;

    const ratings = (feedbackRes.data ?? [])
      .map((r: { rating: number }) => r.rating)
      .filter((r: number) => typeof r === "number" && r > 0);

    const avg_rating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10
        : 4.5;

    return NextResponse.json({ total_checks, avg_rating });
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
