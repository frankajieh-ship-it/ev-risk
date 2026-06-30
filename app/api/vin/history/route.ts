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
import type { VinAuditLiteResult } from "@/lib/vinaudit-client";

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

    const historyResult = await getVinHistory(cleanVin);

    if (!historyResult.success) {
      // All providers failed — return not_configured so card hides gracefully
      return NextResponse.json(
        { success: false, error: historyResult.error, code: "not_configured" },
        { status: 503 }
      );
    }

    // Map normalized result → VinAuditLiteResult shape the card expects
    const result: VinAuditLiteResult = {
      success: true,
      vin: cleanVin,
      summary: {
        theft_reported: historyResult.theft_reported,
        salvage_reported: historyResult.salvage_reported,
        accident_count: historyResult.accident_count,
        sale_count: historyResult.ownership_count ?? 0,
      },
      theft: historyResult.theft_reported ? [{ status: "Reported" }] : [],
      salvage: historyResult.salvage_reported ? [{ source: historyResult.provider }] : [],
      accidents: [],
      sales: [],
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
