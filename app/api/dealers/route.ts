/**
 * Dealer Directory API
 *
 * GET /api/dealers — search/list dealerships (public, no auth required)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const state = searchParams.get("state");
  const specialty = searchParams.get("specialty");
  const search = searchParams.get("q");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  let query = supabase
    .from("dealerships")
    .select("id, name, slug, city, state, country, description, is_verified, ev_specialties, logo_url", { count: "exact" })
    .order("is_verified", { ascending: false })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (city) query = query.ilike("city", `%${city}%`);
  if (state) query = query.eq("state", state);
  if (specialty) query = query.contains("ev_specialties", [specialty]);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    dealers: data || [],
    total: count || 0,
    page,
    limit,
  });
}
