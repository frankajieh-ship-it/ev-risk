/**
 * OFFO Listing Receipt — URL Fetch API
 *
 * POST /api/receipt/fetch
 * Extracts vehicle data from a listing URL using the existing scraper.
 * Returns structured fields, raw_text_excerpt, and diagnostics.
 *
 * SSRF protections:
 * - HTTPS only
 * - Block IP literals and private/reserved ranges
 * - Block localhost, .local, .internal hostnames
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getClientIP } from "@/lib/rate-limiter";
import { receiptBurstLimiter } from "@/lib/receipt-rate-limiter";
import { extractVehicleData } from "@/lib/listing-scraper";
import { extractFieldsFromText } from "@/lib/text-extractor";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { FetchedListingFields } from "@/types/receipt";
import type { FieldConfidence } from "@/types/receipt";
import { logApi, startTimer } from "@/lib/api-logger";
import { hashIP } from "@/lib/session-utils";

export const maxDuration = 30;

/**
 * SSRF protection: block private IPs, localhost, reserved ranges.
 * Returns error string if blocked, null if safe.
 */
function checkSSRF(hostname: string): string | null {
  const lower = hostname.toLowerCase();

  // Block localhost variants
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "[::1]" ||
    lower === "0.0.0.0"
  ) {
    return "Blocked: localhost";
  }

  // Block private/internal TLDs
  if (lower.endsWith(".local") || lower.endsWith(".internal") || lower.endsWith(".localhost")) {
    return "Blocked: internal hostname";
  }

  // Block IP literals (IPv4)
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    // 10.0.0.0/8
    if (a === 10) return "Blocked: private IP range";
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return "Blocked: private IP range";
    // 192.168.0.0/16
    if (a === 192 && b === 168) return "Blocked: private IP range";
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return "Blocked: link-local IP";
    // 127.0.0.0/8
    if (a === 127) return "Blocked: loopback IP";
    // 0.0.0.0/8
    if (a === 0) return "Blocked: reserved IP";
  }

  // Block IPv6 literals in brackets
  if (hostname.startsWith("[")) {
    return "Blocked: IPv6 literal";
  }

  return null; // Safe
}

export async function POST(request: NextRequest) {
  const elapsed = startTimer();
  const clientIP = getClientIP(request);

  // Rate limit
  const burst = receiptBurstLimiter.check(clientIP);
  if (!burst.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const url = body.url as string | undefined;
  const text = body.text as string | undefined;

  if (
    (!url || typeof url !== "string") &&
    (!text || typeof text !== "string" || text.trim().length < 20)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Provide a listing URL or paste at least 20 characters of listing text",
      },
      { status: 400 }
    );
  }

  const sessionId = (body.receipt_token as string) || null;

  // --- Text-mode extraction (no URL) ---
  if (text && !url) {
    try {
      const result = await extractFieldsFromText(text);
      const extraction_id = uuidv4();

      const field_confidence: Record<string, FieldConfidence> = {};
      const allFieldKeys = ["year", "make", "model", "trim", "mileage", "price", "vin", "location"];
      for (const key of allFieldKeys) {
        field_confidence[key] = result.extractedFields.includes(key) ? "extracted" : "missing";
      }

      // Log event
      if (isSupabaseConfigured() && sessionId) {
        try {
          await supabase.from("receipt_events").insert({
            session_id: sessionId,
            event_type: "fetch_success",
            url_domain: "text_paste",
          });
        } catch {
          // swallow
        }
      }

      // Log extraction attempt
      if (isSupabaseConfigured()) {
        try {
          await supabase.from("extraction_attempts").insert({
            session_id: sessionId,
            domain: "text_paste",
            input_mode: "text",
            success: true,
            extracted_field_count: result.extractedFields.length,
            duration_ms: elapsed(),
            ip_hash: hashIP(clientIP),
          });
        } catch { /* non-critical */ }
      }

      return NextResponse.json({
        success: true,
        fields: result.fields,
        field_confidence,
        extraction_id,
        listing_source: "text_paste",
        parse_confidence: result.confidence,
        extractedFields: result.extractedFields,
        missingFields: result.missingFields,
        warnings: [],
        diagnostics: null,
      });
    } catch (error) {
      logApi("error", "Text extraction failed", { endpoint: "/api/receipt/fetch", error_code: "text_extract_fail", elapsed_ms: elapsed() });

      if (isSupabaseConfigured() && sessionId) {
        try {
          await supabase.from("receipt_events").insert({
            session_id: sessionId,
            event_type: "fetch_fail",
            url_domain: "text_paste",
          });
        } catch {
          // swallow
        }
      }

      // Log failed extraction attempt
      if (isSupabaseConfigured()) {
        try {
          await supabase.from("extraction_attempts").insert({
            session_id: sessionId,
            domain: "text_paste",
            input_mode: "text",
            success: false,
            failure_reason: "parse_failure",
            duration_ms: elapsed(),
            error_message: error instanceof Error ? error.message : "Unknown error",
            ip_hash: hashIP(clientIP),
          });
        } catch { /* non-critical */ }
      }

      return NextResponse.json(
        { success: false, error: "Failed to extract details from text" },
        { status: 500 }
      );
    }
  }

  // --- URL-mode extraction ---

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url!);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid URL format" },
      { status: 400 }
    );
  }

  // SSRF: HTTPS only
  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json(
      { success: false, error: "Only HTTPS URLs are supported" },
      { status: 400 }
    );
  }

  // SSRF: Block private/reserved hosts
  const ssrfBlock = checkSSRF(parsedUrl.hostname);
  if (ssrfBlock) {
    return NextResponse.json(
      { success: false, error: "URL not allowed" },
      { status: 400 }
    );
  }

  const urlDomain = parsedUrl.hostname.replace("www.", "");

  try {
    const result = await extractVehicleData(url!);

    if (!result.success || !result.data) {
      // Log fetch_fail event
      if (isSupabaseConfigured() && sessionId) {
        try {
          await supabase.from("receipt_events").insert({
            session_id: sessionId,
            event_type: "fetch_fail",
            url_domain: urlDomain,
          });
        } catch {
          // swallow
        }
      }

      // Log extraction attempt (failure)
      if (isSupabaseConfigured()) {
        try {
          await supabase.from("extraction_attempts").insert({
            session_id: sessionId,
            domain: urlDomain,
            input_mode: "url",
            success: false,
            failure_reason: result.diagnostics?.failureReason || null,
            fetch_method: result.diagnostics?.fetchMethod || null,
            proxy_status: result.diagnostics?.proxyStatusCode || null,
            direct_status: result.diagnostics?.directStatusCode || null,
            bot_protection_detected: result.diagnostics?.botProtectionDetected || false,
            bot_protection_type: result.diagnostics?.botProtectionType || null,
            extracted_field_count: result.diagnostics?.extractedFieldCount || 0,
            duration_ms: result.diagnostics?.durationMs || 0,
            error_message: result.error || result.diagnostics?.errorMessage || null,
            ip_hash: hashIP(clientIP),
          });
        } catch { /* non-critical */ }
      }

      return NextResponse.json(
        {
          success: false,
          error: result.error || "Could not extract listing data from this URL",
          warnings: result.warnings,
          diagnostics: result.diagnostics || null,
        },
        { status: 422 }
      );
    }

    // Map to FetchedListingFields (including VIN)
    const fields: FetchedListingFields = {
      year: result.data.year,
      make: result.data.make,
      model: result.data.model,
      trim: result.data.trim,
      mileage: result.data.mileage,
      price: result.data.price,
      vin: result.data.vin,
      location: result.data.location,
      url_domain: urlDomain,
    };

    // Log fetch_success event
    if (isSupabaseConfigured() && sessionId) {
      try {
        await supabase.from("receipt_events").insert({
          session_id: sessionId,
          event_type: "fetch_success",
          url_domain: urlDomain,
        });
      } catch {
        // swallow
      }
    }

    // Log extraction attempt (success)
    if (isSupabaseConfigured()) {
      try {
        await supabase.from("extraction_attempts").insert({
          session_id: sessionId,
          domain: urlDomain,
          input_mode: "url",
          success: true,
          fetch_method: result.diagnostics?.fetchMethod || null,
          proxy_status: result.diagnostics?.proxyStatusCode || null,
          direct_status: result.diagnostics?.directStatusCode || null,
          bot_protection_detected: result.diagnostics?.botProtectionDetected || false,
          bot_protection_type: result.diagnostics?.botProtectionType || null,
          extracted_field_count: result.diagnostics?.extractedFieldCount || 0,
          duration_ms: result.diagnostics?.durationMs || 0,
          ip_hash: hashIP(clientIP),
        });
      } catch { /* non-critical */ }
    }

    // Build field confidence map
    const field_confidence: Record<string, FieldConfidence> = {};
    const allFieldKeys = ["year", "make", "model", "trim", "mileage", "price", "vin", "location"];
    for (const key of allFieldKeys) {
      field_confidence[key] = result.data.extractedFields.includes(key) ? "extracted" : "missing";
    }

    return NextResponse.json({
      success: true,
      fields,
      field_confidence,
      extraction_id: uuidv4(),
      listing_source: result.data.dataSource || null,
      parse_confidence: result.data.confidence,
      extractedFields: result.data.extractedFields,
      missingFields: result.data.missingFields,
      warnings: result.warnings,
      diagnostics: result.diagnostics || null,
    });
  } catch (error) {
    logApi("error", "URL fetch failed", { endpoint: "/api/receipt/fetch", error_code: "url_fetch_fail", elapsed_ms: elapsed() });

    // Log extraction attempt (unhandled error)
    if (isSupabaseConfigured()) {
      try {
        await supabase.from("extraction_attempts").insert({
          session_id: sessionId,
          domain: urlDomain,
          input_mode: "url",
          success: false,
          failure_reason: "unknown",
          duration_ms: elapsed(),
          error_message: error instanceof Error ? error.message : "Unhandled error",
          ip_hash: hashIP(clientIP),
        });
      } catch { /* non-critical */ }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch listing — try pasting the text instead",
      },
      { status: 500 }
    );
  }
}
