"use server";
/**
 * POST /api/vin/history
 *
 * Fetches VIN ownership history via VehicleDatabases.
 * No in-process cache — caching stale failure results was causing cards to disappear.
 * VehicleDatabases /title-check can take 8-20s; maxDuration=30 ensures it completes.
 */

import { NextResponse } from "next/server";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { validateVin } from "@/lib/vin-service";
import { getVinHistory } from "@/lib/vin-history-client";
import { auctionHistory } from "@/lib/vehicledatabases-client";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 30;

const PAID_STATUSES = new Set(["full", "paid_full_risk"]);

interface SaleRecord {
  date?: string;
  price?: string;
  odometer?: string;
  seller?: string;
  owner_type?: "dealer" | "fleet_rental" | "private" | "unknown";
}

const historyRateLimiter = new RateLimiter(10 * 60 * 1000, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vin, receipt_token } = body;

    if (!vin || typeof vin !== "string") {
      return NextResponse.json({ success: false, error: "VIN is required" }, { status: 400 });
    }
    if (!receipt_token || typeof receipt_token !== "string") {
      return NextResponse.json({ success: false, error: "receipt_token is required" }, { status: 400 });
    }

    const cleanVin = validateVin(vin);
    if (!cleanVin) {
      return NextResponse.json({ success: false, error: "Invalid VIN format" }, { status: 400 });
    }

    // Verify the receipt_token corresponds to a paid receipt
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: receipt } = await supabase
        .from("receipts")
        .select("generation_status, is_pro")
        .eq("session_id", receipt_token)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const isPaid =
        receipt?.is_pro === true ||
        PAID_STATUSES.has(receipt?.generation_status ?? "");

      if (!isPaid) {
        return NextResponse.json(
          { success: false, error: "Ownership history requires a paid report", code: "unpaid" },
          { status: 403 }
        );
      }
    }

    const clientIP = getClientIP(request);
    const rateCheck = historyRateLimiter.check(`${clientIP}:${receipt_token}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many history lookups. Please wait a few minutes.", resetAt: new Date(rateCheck.resetAt).toISOString() },
        { status: 429 }
      );
    }

    // Fetch VIN history + auction records in parallel
    const [historyResult, auctionResult] = await Promise.all([
      getVinHistory(cleanVin),
      auctionHistory(cleanVin).catch(() => null),
    ]);

    if (!historyResult.success) {
      console.error("[VIN History] Provider failed:", {
        vin: cleanVin,
        error: historyResult.error,
        providers: historyResult.providers_attempted,
      });
      return NextResponse.json(
        { success: false, error: historyResult.error, code: "unavailable" },
        { status: 503 }
      );
    }

    // Merge auction records as sale records
    const auctionSales: SaleRecord[] = (auctionResult?.success ? auctionResult.records : []).map((r) => ({
      date: r.auction_date,
      price: r.price.replace(/[^0-9.]/g, "") || undefined,
      odometer: r.odometer.replace(/[^0-9]/g, "") || undefined,
      seller: [r.location, r.title_type ? `Title: ${r.title_type}` : "", r.primary_damage ? `Damage: ${r.primary_damage}` : ""].filter(Boolean).join(" · ") || undefined,
      owner_type: "dealer" as const,
    }));

    // Fleet/rental pattern: 2+ consecutive sales each < 90 days apart
    function detectFleetPattern(records: SaleRecord[]): boolean {
      if (records.length < 2) return false;
      const dates = records
        .map((r) => (r.date ? new Date(r.date).getTime() : NaN))
        .filter((d) => !isNaN(d))
        .sort((a, b) => a - b);
      if (dates.length < 2) return false;
      let rapidPairs = 0;
      for (let i = 1; i < dates.length; i++) {
        if ((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24) < 90) rapidPairs++;
      }
      return rapidPairs >= 2;
    }

    const allSales = auctionSales;
    const possible_fleet_history = detectFleetPattern(allSales);

    const breakdown = { dealer: 0, fleet_rental: 0, private: 0, unknown: 0 };
    for (const s of allSales) {
      breakdown[s.owner_type ?? "unknown"]++;
    }

    const salvageFromAuction = auctionResult?.success
      ? auctionResult.records.some((r) => r.title_type?.toLowerCase().includes("salvage"))
      : false;

    return NextResponse.json({
      success: true,
      vin: cleanVin,
      summary: {
        theft_reported: historyResult.theft_reported,
        salvage_reported: historyResult.salvage_reported || salvageFromAuction,
        accident_count: historyResult.accident_count,
        sale_count: historyResult.ownership_count ?? allSales.length,
        owner_type_breakdown: breakdown,
        possible_fleet_history,
      },
      theft: historyResult.theft_reported ? [{ status: "Reported" }] : [],
      salvage: (historyResult.salvage_reported || salvageFromAuction) ? [{ source: "VehicleDatabases" }] : [],
      accidents: [],
      sales: allSales,
    });
  } catch (err) {
    console.error("[VIN History] Unexpected error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
