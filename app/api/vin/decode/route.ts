/**
 * POST /api/vin/decode
 *
 * Validates a VIN, calls NHTSA vPIC to decode it, detects mismatches
 * against the listing data, and caches results on the receipts row.
 *
 * Core decode logic lives in lib/vin-service.ts.
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { validateVin, decodeVin, detectMismatches } from "@/lib/vin-service";
import type { DecodedVin } from "@/lib/vin-service";

// 10 VIN decodes per 10 minutes per identity
const vinRateLimiter = new RateLimiter(10 * 60 * 1000, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vin, receipt_id, receipt_token, year, make, model } = body;

    // --- Validation ---
    if (!vin || typeof vin !== "string") {
      return NextResponse.json(
        { success: false, error: "VIN is required" },
        { status: 400 }
      );
    }

    const cleanVin = validateVin(vin);

    if (!cleanVin) {
      return NextResponse.json(
        { success: false, error: "Invalid VIN. Must be 17 characters (letters A-H, J-N, P, R-Z and digits 0-9)." },
        { status: 400 }
      );
    }

    if (!receipt_id || typeof receipt_id !== "string") {
      return NextResponse.json(
        { success: false, error: "receipt_id is required" },
        { status: 400 }
      );
    }

    if (!receipt_token || typeof receipt_token !== "string") {
      return NextResponse.json(
        { success: false, error: "receipt_token is required" },
        { status: 400 }
      );
    }

    // --- Rate limiting ---
    const clientIP = getClientIP(request);
    const rateLimitKey = `${clientIP}:${receipt_token}`;
    const rateCheck = vinRateLimiter.check(rateLimitKey);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many VIN checks. Please wait a few minutes.",
          resetAt: new Date(rateCheck.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    // --- Check Supabase cache (7-day) ---
    if (isSupabaseConfigured()) {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: cached } = await supabase
          .from("receipts")
          .select("vin_decode, vin_mismatch_flags, vin_checked_at")
          .eq("id", receipt_id)
          .eq("vin", cleanVin)
          .eq("vin_decode_status", "success")
          .gte("vin_checked_at", sevenDaysAgo)
          .single();

        if (cached?.vin_decode) {
          const mismatches = detectMismatches(cached.vin_decode as DecodedVin, { year, make, model });
          return NextResponse.json({
            success: true,
            decoded: cached.vin_decode,
            mismatches,
            recall_url: `https://www.nhtsa.gov/recalls?vin=${cleanVin}`,
            cached: true,
          });
        }
      } catch {
        // Cache miss or query error — proceed to NHTSA
      }
    }

    // --- Decode via shared service ---
    const result = await decodeVin(cleanVin, { year, make, model });

    if (!result.success) {
      // Persist failure status
      if (isSupabaseConfigured()) {
        const status = result.code === "unrecognized" ? "invalid_vin" : "failed";
        await supabase
          .from("receipts")
          .update({
            vin: cleanVin,
            vin_decode_status: status,
            vin_checked_at: new Date().toISOString(),
          })
          .eq("id", receipt_id)
          .then(() => {});
      }

      const httpStatus =
        result.code === "unrecognized" ? 400 :
        result.code === "not_found" ? 404 : 502;

      return NextResponse.json(
        { success: false, error: result.error },
        { status: httpStatus }
      );
    }

    // --- Persist success to Supabase ---
    if (isSupabaseConfigured()) {
      await supabase
        .from("receipts")
        .update({
          vin: cleanVin,
          vin_decode_status: "success",
          vin_decode: result.decoded,
          vin_checked_at: new Date().toISOString(),
          vin_mismatch_flags: result.mismatches.length > 0 ? result.mismatches : null,
        })
        .eq("id", receipt_id)
        .then(() => {});
    }

    return NextResponse.json({
      success: true,
      decoded: result.decoded,
      mismatches: result.mismatches,
      recall_url: result.recall_url,
    });
  } catch (err) {
    console.error("[VIN Decode] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
