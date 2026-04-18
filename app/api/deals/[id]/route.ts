/**
 * GET /api/deals/[id]
 *
 * Returns a single curated deal by ID. Public endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

const rateLimiter = new RateLimiter(60 * 1000, 60);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request);
  if (!rateLimiter.check(ip).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: deal, error } = await supabase
    .from("curated_deals")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !deal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    { success: true, deal },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
  );
}
