/**
 * Dealer Profile API
 *
 * GET /api/dealers/{slug} — get single dealer profile (public)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const { data: dealer, error } = await supabase
    .from("dealerships")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !dealer) {
    return NextResponse.json(
      { success: false, error: "Dealership not found" },
      { status: 404 }
    );
  }

  // Get active inventory count
  const { count: inventoryCount } = await supabase
    .from("dealer_inventory")
    .select("id", { count: "exact", head: true })
    .eq("dealership_id", dealer.id)
    .eq("status", "active");

  return NextResponse.json({
    success: true,
    dealer: {
      ...dealer,
      inventory_count: inventoryCount || 0,
    },
  });
}
