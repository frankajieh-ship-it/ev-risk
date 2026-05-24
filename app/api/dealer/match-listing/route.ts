/**
 * GET /api/dealer/match-listing?url=<listing_url>
 *
 * Checks whether a listing URL belongs to a verified dealer in the OFFO network.
 * Public endpoint — no auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ dealership: null });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ dealership: null });
  }

  const { data } = await supabase
    .from("dealer_inventory")
    .select("dealership_id, dealerships:dealership_id(id, name, slug, logo_url, is_verified, contact_email)")
    .eq("listing_url", url)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!data?.dealerships) {
    return NextResponse.json({ dealership: null });
  }

  const d = data.dealerships as unknown as {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    is_verified: boolean;
    contact_email: string | null;
  };

  return NextResponse.json({
    dealership: {
      id: d.id,
      name: d.name,
      slug: d.slug,
      logo_url: d.logo_url,
      is_verified: d.is_verified,
    },
  }, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
  });
}
