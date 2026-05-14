/**
 * POST /api/admin/deals-sync-local-photos
 *
 * Scans all active curated_deals and updates photo_url for any row that
 * has a match in data/vehicle-images.csv — regardless of whether the row
 * already has a photo. Local CSV images always win (quality_score: 100).
 *
 * Protected by ADMIN_API_KEY bearer token.
 * Safe to run multiple times (idempotent).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { lookupLocalImages } from "@/lib/vehicle-image-db";

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

  // Fetch all active deals (no photo filter — we overwrite stale ones too)
  const { data: rows, error: fetchError } = await supabase
    .from("curated_deals")
    .select("id, make, model, year, vehicle_label, photo_url")
    .eq("is_active", true)
    .order("year", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ success: true, updated: 0, skipped: 0, total: 0 });
  }

  let updated = 0;
  let skipped = 0;
  const details: Array<{ id: string; make: string; model: string; year: number; url: string }> = [];

  for (const row of rows) {
    if (!row.make) { skipped++; continue; }

    // Build best model string: prefer vehicle_label (has full name) over model column
    let model = row.model ?? "";
    if (row.vehicle_label && row.make) {
      const prefix = [row.year, row.make].filter(Boolean).join(" ") + " ";
      const fromLabel = (row.vehicle_label as string).startsWith(prefix)
        ? (row.vehicle_label as string).slice(prefix.length).trim()
        : null;
      if (fromLabel && fromLabel.length > model.length) model = fromLabel;
    }

    const result = lookupLocalImages(row.make, model, row.year ?? undefined);
    if (!result.matched || result.urls.length === 0) { skipped++; continue; }

    const newUrl = result.urls[0];

    // Skip if already set to this exact URL (already synced)
    if (row.photo_url === newUrl) { skipped++; continue; }

    const { error: updateError } = await supabase
      .from("curated_deals")
      .update({ photo_url: newUrl })
      .eq("id", row.id);

    if (!updateError) {
      updated++;
      details.push({ id: row.id, make: row.make, model, year: row.year, url: newUrl });
    } else {
      skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    updated,
    skipped,
    total: rows.length,
    updated_rows: details,
  });
}
