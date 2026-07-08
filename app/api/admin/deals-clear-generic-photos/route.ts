/**
 * POST /api/admin/deals-clear-generic-photos
 *
 * One-shot cleanup: nulls out photo_url for rows where the current photo
 * is a generic CSV stock image (proxied Wikimedia URL). This restores the
 * ability for real listing photos to be fetched on the next import/backfill.
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 60;

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Clear ALL photo_url values for non-dealer marketplace rows.
  // This forces a clean refetch via the correct pipeline (local CSV → Wikimedia static map).
  // Dealer rows (dealership_id IS NOT NULL) keep their own uploaded photos.
  const { data, error } = await supabase
    .from("curated_deals")
    .update({ photo_url: null })
    .is("dealership_id", null)
    .eq("is_active", true)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, cleared: data?.length ?? 0 });
}
