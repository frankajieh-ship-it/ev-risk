/**
 * POST /api/admin/deals-clear-bad-photos
 *
 * Nulls out photo_url for rows whose current photo_url contains a known-bad
 * Wikimedia filename (wrong car, deleted file, etc). Only touches those rows,
 * leaving all correct photos intact.
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 30;

const ADMIN_KEY = process.env.ADMIN_API_KEY;

// Wikimedia filenames confirmed to return wrong/broken images
const BAD_FRAGMENTS = [
  "2023_Nissan_Leaf_Tekna",       // UK police car photo
  "Nissan_Leaf_2013_%28front%29", // deleted file
  "Fiat_500e_in_San_Jose",        // deleted file
];

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let totalCleared = 0;
  const clearedFragments: string[] = [];

  for (const fragment of BAD_FRAGMENTS) {
    const { data, error } = await supabase
      .from("curated_deals")
      .update({ photo_url: null })
      .like("photo_url", `%${fragment}%`)
      .select("id");

    if (!error && data && data.length > 0) {
      totalCleared += data.length;
      clearedFragments.push(`${fragment} (${data.length})`);
    }
  }

  return NextResponse.json({ success: true, cleared: totalCleared, details: clearedFragments });
}
