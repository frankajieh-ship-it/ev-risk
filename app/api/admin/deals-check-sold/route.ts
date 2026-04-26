/**
 * POST /api/admin/deals-check-sold
 *
 * Checks all active curated_deals by fetching each listing URL via the
 * /api/receipt/fetch endpoint. Any listing that returns listing_sold or
 * a 404 is immediately set is_active=false.
 *
 * Runs fire-and-forget — returns 200 immediately, logs progress to console.
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 60;

const ADMIN_KEY = process.env.ADMIN_API_KEY;

async function checkSold() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("DB not configured");

  const { data: rows, error } = await supabase
    .from("curated_deals")
    .select("id, listing_url, vehicle_label")
    .eq("is_active", true)
    .not("listing_url", "is", null);

  if (error) throw new Error(`Fetch failed: ${error.message}`);
  if (!rows?.length) { console.log("[check-sold] No active deals to check"); return { deactivated: 0, checked: 0 }; }

  console.log(`[check-sold] Checking ${rows.length} active listings for sold status`);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  let deactivated = 0;

  for (const row of rows) {
    try {
      const res = await fetch(`${siteUrl}/api/receipt/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: row.listing_url }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await res.json() as { success: boolean; diagnostics?: { failureReason?: string } };

      if (!data.success && data.diagnostics?.failureReason === "listing_sold") {
        console.log(`[check-sold] Deactivating sold listing: ${row.vehicle_label} — ${row.listing_url}`);
        await supabase.from("curated_deals").update({ is_active: false }).eq("id", row.id);
        deactivated++;
      } else {
        console.log(`[check-sold] Still active: ${row.vehicle_label} (${data.diagnostics?.failureReason ?? "ok"})`);
      }
    } catch (err) {
      console.warn(`[check-sold] Error checking ${row.listing_url}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[check-sold] Done — deactivated ${deactivated} of ${rows.length} listings`);
  return { deactivated, checked: rows.length };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fire and forget — return immediately, work runs async
  checkSold().catch((err) => {
    console.error("[check-sold] failed:", err instanceof Error ? err.message : err);
  });

  return NextResponse.json({ ok: true, message: "Sold check started — refresh table in ~2 min" });
}
