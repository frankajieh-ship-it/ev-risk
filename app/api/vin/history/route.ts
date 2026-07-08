/**
 * POST /api/vin/history
 *
 * Fetches VIN history (theft, salvage, accident, sale records).
 * Uses the unified getVinHistory() waterfall: VinAudit → CarsXE → VehicleDatabases.
 *
 * Response shape mirrors VinAuditLiteResult so OwnershipHistoryCard works unchanged.
 */

import { NextResponse } from "next/server";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { validateVin } from "@/lib/vin-service";
import { getVinHistory } from "@/lib/vin-history-client";
import { auctionHistory } from "@/lib/vehicledatabases-client";
import type { VinAuditLiteResult, VinAuditSaleRecord } from "@/lib/vinaudit-client";

const historyRateLimiter = new RateLimiter(10 * 60 * 1000, 10);

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { result: VinAuditLiteResult; expiresAt: number }>();

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

    const clientIP = getClientIP(request);
    const rateCheck = historyRateLimiter.check(`${clientIP}:${receipt_token}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many history lookups. Please wait a few minutes.", resetAt: new Date(rateCheck.resetAt).toISOString() },
        { status: 429 }
      );
    }

    // In-process cache
    const cached = cache.get(cleanVin);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ ...cached.result, cached: true });
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

    // Extract sale records from CarsXE raw historyInformation if available
    type CarsXEHistoryRecord = {
      TitleIssueDate?: { Date?: string };
      TitleIssuingAuthorityName?: string;
      VehicleOdometerReadingMeasure?: string;
    };
    const rawHistory = (historyResult.raw as { history?: { historyInformation?: CarsXEHistoryRecord[] } } | null);
    const historyRecords: CarsXEHistoryRecord[] = rawHistory?.history?.historyInformation ?? [];
    const carsxeSales: VinAuditSaleRecord[] = historyRecords.map((r) => ({
      date: r.TitleIssueDate?.Date ? new Date(r.TitleIssueDate.Date).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : undefined,
      odometer: r.VehicleOdometerReadingMeasure ? String(parseInt(r.VehicleOdometerReadingMeasure, 10)) : undefined,
      seller: r.TitleIssuingAuthorityName ? `State: ${r.TitleIssuingAuthorityName}` : undefined,
      owner_type: "private" as const,
    }));

    // Merge auction records as sale records (most recent first)
    // All auction records = commercial/dealer transactions
    const auctionSales: VinAuditSaleRecord[] = (auctionResult?.success ? auctionResult.records : []).map((r) => ({
      date: r.auction_date,
      price: r.price.replace(/[^0-9.]/g, "") || undefined,
      odometer: r.odometer.replace(/[^0-9]/g, "") || undefined,
      seller: [r.location, r.title_type ? `Title: ${r.title_type}` : "", r.primary_damage ? `Damage: ${r.primary_damage}` : ""].filter(Boolean).join(" · ") || undefined,
      owner_type: "dealer" as const,
    }));

    const allSales = [...auctionSales, ...carsxeSales];

    // Fleet/rental pattern detection: 2+ consecutive sales each < 90 days apart
    // indicates rapid commercial turnover (fleet disposal, rental, dealer flipping)
    function detectFleetPattern(records: VinAuditSaleRecord[]): boolean {
      if (records.length < 2) return false;
      const dates = records
        .map((r) => (r.date ? new Date(r.date).getTime() : NaN))
        .filter((d) => !isNaN(d))
        .sort((a, b) => a - b);
      if (dates.length < 2) return false;
      let rapidPairs = 0;
      for (let i = 1; i < dates.length; i++) {
        const daysBetween = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
        if (daysBetween < 90) rapidPairs++;
      }
      return rapidPairs >= 2;
    }

    const possible_fleet_history = detectFleetPattern(allSales);

    // Build owner type breakdown
    const breakdown = { dealer: 0, fleet_rental: 0, private: 0, unknown: 0 };
    for (const s of allSales) {
      breakdown[s.owner_type ?? "unknown"]++;
    }

    // Map normalized result → VinAuditLiteResult shape the card expects
    const salvageFromAuction = auctionResult?.success
      ? auctionResult.records.some((r) => r.title_type?.toLowerCase().includes("salvage"))
      : false;

    const result: VinAuditLiteResult = {
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
      salvage: (historyResult.salvage_reported || salvageFromAuction) ? [{ source: historyResult.provider }] : [],
      accidents: [],
      sales: allSales,
    };

    cache.set(cleanVin, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    if (cache.size > 500) {
      const now = Date.now();
      for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt < now) cache.delete(key);
        if (cache.size <= 400) break;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[VIN History] Unexpected error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
