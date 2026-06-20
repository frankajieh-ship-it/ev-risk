/**
 * POST /api/admin/deals-clear-image-cache
 *
 * Clears all rows from vehicle_images that are NOT safe Wikimedia/VinAudit
 * stock photos. Anything from a marketplace CDN (CarGurus, CarMax, MarketCheck,
 * Auto.dev, etc.) is deleted so the next /api/photos call re-derives from the
 * static Wikimedia map instead.
 *
 * Pass ?nuke=1 to delete the ENTIRE vehicle_images table (use when all cached
 * entries are known-bad, e.g. after a wrong-car-photo incident).
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 60;

const ADMIN_KEY = process.env.ADMIN_API_KEY;

// Safe domains — entries whose primary_url contains one of these are kept.
const SAFE_DOMAINS = [
  "upload.wikimedia.org",
  "/api/img?url=", // proxied Wikimedia
  "vinaudit.com",
  "static.vinaudit.com",
];

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const nuke = request.nextUrl.searchParams.get("nuke") === "1";

  if (nuke) {
    // Delete everything — PostgREST requires a filter, use neq on a column that's always set
    const { error } = await supabase
      .from("vehicle_images")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, cleared: "all", message: "Entire vehicle_images cache wiped" });
  }

  // Selective: fetch all rows, keep only safe-domain ones
  const { data: rows, error: fetchError } = await supabase
    .from("vehicle_images")
    .select("id, primary_url");

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const badIds = (rows ?? [])
    .filter((row) => !SAFE_DOMAINS.some((d) => (row.primary_url ?? "").includes(d)))
    .map((row) => row.id);

  if (badIds.length === 0) {
    return NextResponse.json({ success: true, cleared: 0, message: "No unsafe cache entries found" });
  }

  const { error: deleteError } = await supabase
    .from("vehicle_images")
    .delete()
    .in("id", badIds);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ success: true, cleared: badIds.length });
}
