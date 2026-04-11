/**
 * POST /api/vin/history
 *
 * Fetches VIN history (theft, salvage, accident, sale records) via VinAudit
 * Lite Check API, with in-process caching to avoid repeated paid lookups.
 *
 * Auth: receipt_token required (same pattern as /api/vin/decode).
 * Rate limit: 5 lookups per 10 minutes per receipt_token.
 *
 * Response shape mirrors VinAuditLiteResult.summary + full arrays so the
 * client can show summary pills and optionally expand detail rows.
 */

import { NextResponse } from "next/server";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { validateVin } from "@/lib/vin-service";
import { liteCheck } from "@/lib/vinaudit-client";
import type { VinAuditLiteResult } from "@/lib/vinaudit-client";

// 5 history lookups per 10 minutes per identity (paid API — be conservative)
const historyRateLimiter = new RateLimiter(10 * 60 * 1000, 5);

// In-process cache: vin → result, keyed by uppercase VIN
// TTL: 24h (history doesn't change intraday)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { result: VinAuditLiteResult; expiresAt: number }>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vin, receipt_token } = body;

    if (!vin || typeof vin !== "string") {
      return NextResponse.json(
        { success: false, error: "VIN is required" },
        { status: 400 }
      );
    }

    if (!receipt_token || typeof receipt_token !== "string") {
      return NextResponse.json(
        { success: false, error: "receipt_token is required" },
        { status: 400 }
      );
    }

    const cleanVin = validateVin(vin);
    if (!cleanVin) {
      return NextResponse.json(
        { success: false, error: "Invalid VIN format" },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitKey = `${clientIP}:${receipt_token}`;
    const rateCheck = historyRateLimiter.check(rateLimitKey);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many history lookups. Please wait a few minutes.",
          resetAt: new Date(rateCheck.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    // In-process cache check
    const cached = cache.get(cleanVin);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ ...cached.result, cached: true });
    }

    // Call VinAudit
    const result = await liteCheck(cleanVin);

    if (!result.success) {
      // not_configured = VinAudit not set up in env — return graceful empty rather than 500
      if (result.code === "not_configured") {
        return NextResponse.json(
          { success: false, error: result.error, code: "not_configured" },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.code === "not_found" ? 404 : 502 }
      );
    }

    // Cache successful results
    cache.set(cleanVin, { result, expiresAt: Date.now() + CACHE_TTL_MS });

    // Evict oldest entries if cache grows large
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
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
