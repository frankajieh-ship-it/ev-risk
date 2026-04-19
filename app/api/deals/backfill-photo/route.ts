/**
 * POST /api/deals/backfill-photo
 *
 * Called by DealCard after a client-side photo fetch succeeds.
 * Persists the discovered photo_url back to curated_deals so future
 * page loads skip the external API call entirely.
 *
 * Only fills rows where photo_url IS NULL — never overwrites existing photos.
 * No auth required: only writes a photo URL, no sensitive data exposed.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: false });

  let body: { id?: string; photo_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false });
  }

  const { id, photo_url } = body;
  if (!id || !photo_url || typeof id !== "string" || typeof photo_url !== "string") {
    return NextResponse.json({ ok: false });
  }

  // Only fill nulls — never overwrite an existing photo
  const { error } = await supabase
    .from("curated_deals")
    .update({ photo_url })
    .eq("id", id)
    .is("photo_url", null);

  if (error) {
    console.warn("[deals/backfill-photo] Update failed:", error.message);
  }

  return NextResponse.json({ ok: !error });
}
