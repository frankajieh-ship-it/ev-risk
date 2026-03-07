/**
 * Dealer Inventory API (Public)
 *
 * GET /api/dealers/{slug}/inventory — paginated inventory for a dealer
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  // Look up dealership by slug
  const { data: dealer } = await supabase
    .from("dealerships")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!dealer) {
    return NextResponse.json(
      { success: false, error: "Dealership not found" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;
  const make = searchParams.get("make");
  const category = searchParams.get("category"); // EV, PHEV, ICE

  let query = supabase
    .from("dealer_inventory")
    .select("id, make, model, year, trim, price_cents, mileage, exterior_color, listing_url, photo_urls, classification, status", { count: "exact" })
    .eq("dealership_id", dealer.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (make) query = query.ilike("make", `%${make}%`);
  if (category) query = query.contains("classification", { category });

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    inventory: data || [],
    total: count || 0,
    page,
    limit,
  });
}
