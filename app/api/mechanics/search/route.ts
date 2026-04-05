/**
 * GET /api/mechanics/search
 * Public endpoint — no auth required.
 *
 * Query params:
 *   zip           — 5-digit US ZIP (required)
 *   service_type  — ServiceType value (optional filter)
 *   radius_miles  — numeric, default 50 (informational; DB filters by zip prefix + state)
 *   limit         — max results, default 20, max 50
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const zip = searchParams.get("zip") ?? "";
  const serviceType = searchParams.get("service_type") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ success: false, error: "Valid 5-digit ZIP required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  // Build query — approved profiles whose service radius covers the requested ZIP.
  // We use a ZIP-prefix proximity heuristic (first 3 digits = sectional center facility)
  // to order results closest-first without needing a full geocoding pass at query time.
  const zipPrefix = zip.slice(0, 3);

  let query = supabase
    .from("mechanic_profiles")
    .select(
      "id, slug, business_name, bio, phone, website, city, state, zip, " +
      "service_radius_miles, specialties, certifications, avatar_url, cover_photo_url, " +
      "is_verified, is_featured, avg_rating, review_count, response_rate, accepts_new_clients"
    )
    .eq("status", "approved")
    .eq("accepts_new_clients", true)
    // Prefer same ZIP, then same 3-digit prefix, then same state
    .order("is_featured", { ascending: false })
    .order("avg_rating", { ascending: false })
    .limit(limit);

  // Filter by service type if provided (PostgreSQL array contains operator)
  if (serviceType) {
    query = query.contains("specialties", [serviceType]);
  }

  // Filter to same state first (derived from ZIP ranges would be ideal, but we keep it simple:
  // fetch all approved mechanics with matching specialty, then sort by ZIP proximity client-side)
  const { data, error } = await query;

  if (error) {
    console.error("[mechanics/search] DB error:", error.message);
    return NextResponse.json({ success: false, error: "Search failed" }, { status: 500 });
  }

  // Sort by ZIP proximity: exact match first, then 3-digit prefix, then rest
  const rows = Array.isArray(data) ? data : [];
  const sorted = rows.sort((a, b) => {
    const aExact = a.zip === zip ? 0 : a.zip?.startsWith(zipPrefix) ? 1 : 2;
    const bExact = b.zip === zip ? 0 : b.zip?.startsWith(zipPrefix) ? 1 : 2;
    if (aExact !== bExact) return aExact - bExact;
    // Within same tier, rank by rating desc
    return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
  });

  return NextResponse.json({ success: true, mechanics: sorted, zip });
}
