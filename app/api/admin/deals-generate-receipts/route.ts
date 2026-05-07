/**
 * POST /api/admin/deals-generate-receipts
 *
 * Batch-generates full receipts for curated deals that have receipt_id = null.
 * Uses DEAL_WATCH_TOKEN to call /api/receipt internally — bypasses rate limits
 * and Turnstile. On success, updates curated_deals.receipt_id.
 *
 * Query params:
 *   ?batch=N  — number of deals to process per run (default 10, max 20)
 *
 * Returns { generated, skipped, failed, total } inline (not fire-and-forget).
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
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const dealWatchToken = process.env.DEAL_WATCH_TOKEN;
  if (!dealWatchToken) {
    return NextResponse.json({ error: "DEAL_WATCH_TOKEN not set" }, { status: 500 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

  const { searchParams } = new URL(request.url);
  const batch = Math.min(20, Math.max(1, parseInt(searchParams.get("batch") || "10", 10)));

  // Fetch deals with no receipt yet
  const { data: rows, error } = await supabase
    .from("curated_deals")
    .select("id, listing_url, make, model, year, trim, price, mileage, location, vin")
    .is("receipt_id", null)
    .eq("is_active", true)
    .not("listing_url", "is", null)
    .not("make", "is", null)
    .limit(batch);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ generated: 0, skipped: 0, failed: 0, total: 0 });

  let generated = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    try {
      const body: Record<string, unknown> = {
        receipt_token: dealWatchToken,
        listing_url: row.listing_url,
        mode: "single",
        region: "US",
        input_mode: "deal_watch",
      };

      // Pass all structured fields we have so the AI doesn't need to extract
      if (row.make) body.make = row.make;
      if (row.model) body.model = row.model;
      if (row.year) body.year = row.year;
      if (row.trim) body.trim = row.trim;
      if (row.price) body.price = row.price;
      if (row.mileage) body.mileage = row.mileage;
      if (row.location) body.location = row.location;
      if (row.vin) body.vin = row.vin;

      const res = await fetch(`${siteUrl}/api/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      });

      const data = await res.json() as {
        success: boolean;
        receipt_id?: string;
        source?: string;
        generation_status?: string;
        receipt?: { verdict?: string };
      };

      if (!data.success || !data.receipt_id) {
        console.warn(`[deals-generate-receipts] No receipt for ${row.listing_url}:`, data);
        failed++;
        continue;
      }

      // On cache hit the receipt_id is already correct — still write it back if missing
      if (data.source === "deal_cache") {
        skipped++;
        continue;
      }

      const receiptVerdict = data.receipt?.verdict;
      const { error: updateErr } = await supabase
        .from("curated_deals")
        .update({
          receipt_id: data.receipt_id,
          ...(receiptVerdict ? { verdict: receiptVerdict } : {}),
        })
        .eq("id", row.id);

      if (updateErr) {
        console.warn(`[deals-generate-receipts] Failed to update receipt_id for ${row.id}:`, updateErr.message);
        failed++;
      } else {
        console.log(`[deals-generate-receipts] Linked receipt ${data.receipt_id} → deal ${row.id}`);
        generated++;
      }
    } catch (err) {
      console.warn(`[deals-generate-receipts] Error for ${row.listing_url}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    generated,
    skipped,
    failed,
    total: rows.length,
  });
}
