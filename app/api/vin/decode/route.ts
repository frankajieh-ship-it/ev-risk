/**
 * POST /api/vin/decode
 *
 * Validates a VIN, calls NHTSA vPIC to decode it, detects mismatches
 * against the listing data, and caches results on the receipts row.
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

// 10 VIN decodes per 10 minutes per identity
const vinRateLimiter = new RateLimiter(10 * 60 * 1000, 10);

// VIN validation: 17 alphanumeric chars, no I/O/Q
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

// Common make aliases for fuzzy mismatch detection
const MAKE_ALIASES: Record<string, string[]> = {
  chevrolet: ["chevy"],
  volkswagen: ["vw"],
  "mercedes-benz": ["mercedes", "mb"],
  "land rover": ["landrover"],
  bmw: ["bayerische motoren werke"],
};

function normalizeMake(make: string): string {
  const lower = make.toLowerCase().trim();
  // Check if it's an alias
  for (const [canonical, aliases] of Object.entries(MAKE_ALIASES)) {
    if (lower === canonical || aliases.includes(lower)) {
      return canonical;
    }
  }
  return lower;
}

interface DecodedVin {
  year: number;
  make: string;
  model: string;
  trim: string;
  engine: string;
  drive_type: string;
  fuel_type: string;
  body_class: string;
  plant_country: string;
}

interface VinMismatch {
  field: string;
  listing_value: string;
  decoded_value: string;
}

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

    const cleanVin = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, "");

    if (!VIN_REGEX.test(cleanVin)) {
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
          // Re-compute mismatches against current listing data
          const mismatches = detectMismatches(cached.vin_decode, { year, make, model });
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

    // --- Call NHTSA vPIC ---
    const nhtsaUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${cleanVin}?format=json`;

    let nhtsaResponse: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      nhtsaResponse = await fetch(nhtsaUrl, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (err) {
      // Update status to failed if Supabase is configured
      if (isSupabaseConfigured()) {
        await supabase
          .from("receipts")
          .update({
            vin: cleanVin,
            vin_decode_status: "failed",
            vin_checked_at: new Date().toISOString(),
          })
          .eq("id", receipt_id)
          .then(() => {});
      }

      const isAbort = err instanceof DOMException && err.name === "AbortError";
      return NextResponse.json(
        {
          success: false,
          error: isAbort
            ? "NHTSA service timed out. Try again in a minute."
            : "NHTSA service unavailable. Try again in a minute.",
        },
        { status: 502 }
      );
    }

    if (!nhtsaResponse.ok) {
      return NextResponse.json(
        { success: false, error: "NHTSA service returned an error. Try again later." },
        { status: 502 }
      );
    }

    const nhtsaData = await nhtsaResponse.json();
    const result = nhtsaData?.Results?.[0];

    if (!result) {
      return NextResponse.json(
        { success: false, error: "VIN not found in NHTSA database." },
        { status: 404 }
      );
    }

    // Check error codes — "0" = success, "1" = partial (still usable)
    const errorCode = result.ErrorCode?.toString() || "";
    const errorCodes = errorCode.split(",").map((c: string) => c.trim());
    const hasOnlySuccessCodes = errorCodes.every(
      (c: string) => c === "0" || c === "1" || c === ""
    );

    if (!hasOnlySuccessCodes && !result.Make && !result.ModelYear) {
      if (isSupabaseConfigured()) {
        await supabase
          .from("receipts")
          .update({
            vin: cleanVin,
            vin_decode_status: "invalid_vin",
            vin_checked_at: new Date().toISOString(),
          })
          .eq("id", receipt_id)
          .then(() => {});
      }

      return NextResponse.json(
        { success: false, error: "VIN not recognized by NHTSA. Please double-check the VIN." },
        { status: 400 }
      );
    }

    // --- Parse decoded fields ---
    const engineParts = [
      result.DisplacementL ? `${parseFloat(result.DisplacementL).toFixed(1)}L` : null,
      result.EngineCylinders ? `${result.EngineCylinders}-Cylinder` : null,
      result.EngineModel || null,
    ].filter(Boolean);

    const decoded: DecodedVin = {
      year: parseInt(result.ModelYear, 10) || 0,
      make: result.Make || "",
      model: result.Model || "",
      trim: result.Trim || "",
      engine: engineParts.join(" ") || "",
      drive_type: result.DriveType || "",
      fuel_type: result.FuelTypePrimary || "",
      body_class: result.BodyClass || "",
      plant_country: result.PlantCountry || "",
    };

    // --- Detect mismatches ---
    const mismatches = detectMismatches(decoded, { year, make, model });

    // --- Persist to Supabase ---
    if (isSupabaseConfigured()) {
      await supabase
        .from("receipts")
        .update({
          vin: cleanVin,
          vin_decode_status: "success",
          vin_decode: decoded,
          vin_checked_at: new Date().toISOString(),
          vin_mismatch_flags: mismatches.length > 0 ? mismatches : null,
        })
        .eq("id", receipt_id)
        .then(() => {});
    }

    return NextResponse.json({
      success: true,
      decoded,
      mismatches,
      recall_url: `https://www.nhtsa.gov/recalls?vin=${cleanVin}`,
    });
  } catch (err) {
    console.error("[VIN Decode] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

function detectMismatches(
  decoded: DecodedVin,
  listing: { year?: number; make?: string; model?: string }
): VinMismatch[] {
  const mismatches: VinMismatch[] = [];

  // Year mismatch
  if (listing.year && decoded.year && listing.year !== decoded.year) {
    mismatches.push({
      field: "year",
      listing_value: String(listing.year),
      decoded_value: String(decoded.year),
    });
  }

  // Make mismatch (fuzzy via aliases)
  if (listing.make && decoded.make) {
    const normalizedListing = normalizeMake(listing.make);
    const normalizedDecoded = normalizeMake(decoded.make);
    if (normalizedListing !== normalizedDecoded) {
      mismatches.push({
        field: "make",
        listing_value: listing.make,
        decoded_value: decoded.make,
      });
    }
  }

  // Model mismatch (case-insensitive)
  if (listing.model && decoded.model) {
    const listingModel = listing.model.toLowerCase().trim();
    const decodedModel = decoded.model.toLowerCase().trim();
    // Only flag if they don't share a common prefix (e.g., "RAV4 Prime" vs "RAV4")
    if (listingModel !== decodedModel && !listingModel.startsWith(decodedModel) && !decodedModel.startsWith(listingModel)) {
      mismatches.push({
        field: "model",
        listing_value: listing.model,
        decoded_value: decoded.model,
      });
    }
  }

  return mismatches;
}
