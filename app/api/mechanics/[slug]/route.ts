/**
 * GET /api/mechanics/[slug]
 * Public endpoint — returns a single approved mechanic profile + recent reviews.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ success: false, error: "Slug required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { data: mechanic, error: mechError } = await supabase
    .from("mechanic_profiles")
    .select(
      "id, slug, business_name, bio, phone, website, address_line1, city, state, zip, " +
      "service_radius_miles, specialties, certifications, avatar_url, cover_photo_url, " +
      "is_verified, is_featured, avg_rating, review_count, response_rate, accepts_new_clients, " +
      "created_at"
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (mechError) {
    console.error("[mechanics/slug] DB error:", mechError.message);
    return NextResponse.json({ success: false, error: "Lookup failed" }, { status: 500 });
  }

  if (!mechanic) {
    return NextResponse.json({ success: false, error: "Mechanic not found" }, { status: 404 });
  }

  const { data: reviews } = await supabase
    .from("mechanic_reviews")
    .select("id, rating, comment, service_type, verified_service, created_at")
    .eq("mechanic_id", mechanic.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ success: true, mechanic, reviews: reviews ?? [] });
}
