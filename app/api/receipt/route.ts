/**
 * OFFO Listing Receipt — Generate API
 *
 * POST /api/receipt
 * Accepts listing URL/text, calls OpenAI, returns structured receipt JSON.
 *
 * Pipeline: Generate → Zod parse → Lint → Format fix → Return
 *
 * Modes:
 * - Default: full generation pipeline
 * - fix_only: skip generation, just fix lint issues on provided receipt
 *
 * Rate limits:
 * - Burst: 5 requests/hour per IP
 * - Daily: 1 free receipt/day per receipt_token (Pro unlimited)
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP } from "@/lib/rate-limiter";
import { receiptBurstLimiter, checkDailyLimit, incrementDailyCount } from "@/lib/receipt-rate-limiter";
import { generateReceipt, fixReceiptFormatting, buildFallbackReceipt } from "@/lib/receipt-openai";
import { validateReceiptSchema } from "@/lib/receipt-schema-validator";
import type { LintError } from "@/lib/receipt-schema-validator";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { hashIP } from "@/lib/session-utils";
import { checkIsPro } from "@/lib/receipt-pro";
import { getFeatureFlags } from "@/lib/feature-flags";
import { computeInputHash, checkIdempotency, claimRequest, completeRequest, failRequest } from "@/lib/receipt-idempotency";
import { renderRedditDraft } from "@/lib/reddit-draft-renderer";
import { classifyVehicle } from "@/lib/vehicle-classifier";
import { isInternalTester } from "@/lib/rollout-flags";
import type { ReceiptGenerateRequest } from "@/types/receipt";
import { logApi } from "@/lib/api-logger";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const clientIP = getClientIP(request);

  // 1. Parse body (before rate limit so we can check tester bypass)
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  // 2. Validate receipt_token
  const receiptToken = body.receipt_token;
  if (!receiptToken || typeof receiptToken !== "string" || receiptToken.length < 5) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid receipt_token" },
      { status: 400 }
    );
  }

  // 3. Burst rate limit (testers bypass)
  if (!isInternalTester(receiptToken as string)) {
    const burst = receiptBurstLimiter.check(clientIP);
    if (!burst.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((burst.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests. Please try again later.",
          resetAt: new Date(burst.resetAt).toISOString(),
          retryAfter: retryAfterSec,
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.min(retryAfterSec, 3600)) },
        }
      );
    }
  }

  timings.parse = Date.now() - t0;

  // --- Fix-only mode ---
  if (body.mode === "fix_only" && body.receipt_json) {
    return handleFixOnly(body.receipt_json, body.lint_errors as LintError[] | undefined, receiptToken);
  }

  // 4. Validate actual content (bare URLs are not enough — OpenAI can't visit them)
  const hasText =
    body.listing_text &&
    typeof body.listing_text === "string" &&
    (body.listing_text as string).trim().length > 20;
  const hasStructuredFields =
    [body.year, body.make, body.model].filter(Boolean).length >= 2;

  if (!hasText && !hasStructuredFields) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Not enough listing data. Paste the listing text or fetch a supported URL first.",
      },
      { status: 400 }
    );
  }

  // 5. Pro access check
  const accessToken = request.cookies.get("sb-access-token")?.value;
  let userId: string | undefined;
  let userEmail: string | undefined;
  if (accessToken && isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser(accessToken);
      userId = user?.id;
      userEmail = user?.email || undefined;
    } catch {
      // not authenticated
    }
  }
  const isPro = await checkIsPro(userId, userEmail);
  const features = getFeatureFlags(isPro);
  timings.auth = Date.now() - t0;

  // 5b. Server-side rate limiting anchors
  const serverSessionId = request.cookies.get("receipt_session")?.value;
  const ipHash = hashIP(clientIP);

  // 6. Daily free limit check
  const dailyLimit = await checkDailyLimit(receiptToken as string, isPro, serverSessionId, ipHash || undefined);
  if (!dailyLimit.allowed) {
    const resetDate = new Date(dailyLimit.resetAt);
    const retryAfterSec = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      {
        success: false,
        error: "Daily limit reached. Resets at midnight UTC — come back tomorrow!",
        remaining_free: 0,
        resetAt: dailyLimit.resetAt,
        retryAfter: retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }

  // 6b. Idempotency check — same input within 5 min returns cached response
  const inputHash = computeInputHash({
    anon_id: receiptToken as string,
    year: typeof body.year === "number" ? body.year : undefined,
    make: (body.make as string) || undefined,
    model: (body.model as string) || undefined,
    trim: (body.trim as string) || undefined,
    mileage: typeof body.mileage === "number" ? body.mileage : undefined,
    price: typeof body.price === "number" ? body.price : undefined,
    vin: (body.vin as string) || undefined,
    listing_text: (body.listing_text as string) || null,
  });

  const idempotency = await checkIdempotency(inputHash);

  if (idempotency.status === "cached" && idempotency.cachedResponse) {
    console.log(`[Receipt API] Returning cached response for hash ${inputHash.substring(0, 8)}`);
    return NextResponse.json(idempotency.cachedResponse);
  }

  if (idempotency.status === "processing") {
    return NextResponse.json(
      {
        success: false,
        error: "Your receipt is still being generated. Please wait a moment.",
        retryAfter: 10,
      },
      {
        status: 409,
        headers: { "Retry-After": "10" },
      }
    );
  }

  const requestRowId = await claimRequest(inputHash, receiptToken as string, ipHash || undefined);

  // 7. Build request
  const input: ReceiptGenerateRequest = {
    listing_url: (body.listing_url as string) || null,
    listing_text: (body.listing_text as string) || null,
    year: typeof body.year === "number" ? body.year : undefined,
    make: (body.make as string) || undefined,
    model: (body.model as string) || undefined,
    trim: (body.trim as string) || undefined,
    mileage: typeof body.mileage === "number" ? body.mileage : undefined,
    price: typeof body.price === "number" ? body.price : undefined,
    vin: (body.vin as string) || undefined,
    location: (body.location as string) || undefined,
    seller_type: (body.seller_type as string as ReceiptGenerateRequest["seller_type"]) || undefined,
    title_status: (body.title_status as string as ReceiptGenerateRequest["title_status"]) || undefined,
    accidents_reported: (body.accidents_reported as string as ReceiptGenerateRequest["accidents_reported"]) || undefined,
    service_history: (body.service_history as string as ReceiptGenerateRequest["service_history"]) || undefined,
    owners: typeof body.owners === "number" ? body.owners : undefined,
    carfax_available: (body.carfax_available as string as ReceiptGenerateRequest["carfax_available"]) || undefined,
    financing_vs_cash: (body.financing_vs_cash as string as ReceiptGenerateRequest["financing_vs_cash"]) || undefined,
    country: (body.country as string as ReceiptGenerateRequest["country"]) || undefined,
    zip_or_postcode: (body.zip_or_postcode as string) || undefined,
    receipt_token: receiptToken as string,
    session_id: (body.session_id as string) || undefined,
    extraction_id: (body.extraction_id as string) || undefined,
    mode: "single",
  };

  try {
    // 7. Call OpenAI
    const { receipt, retried } = await generateReceipt(input);
    timings.openai = Date.now() - t0;

    // 8. Validate receipt (Zod parse + lint)
    let validation = validateReceiptSchema(receipt);
    let lintPassed = validation.valid;
    let lintErrors = validation.lintErrors;
    let finalReceipt = validation.sanitized || receipt;

    // 8a. If Zod parse failed (schema_fail), use fallback receipt instead of hard 422
    if (!validation.sanitized && validation.errors.length > 0 && validation.lintErrors.length === 0) {
      logApi("error", "Schema validation failed", {
        endpoint: "/api/receipt",
        anon_id: receiptToken as string,
        error_code: "schema_fail",
        elapsed_ms: Date.now() - t0,
        retried,
        errors: validation.errors,
      });

      // Log schema_fail event
      if (isSupabaseConfigured()) {
        try {
          await supabase.from("receipt_events").insert({
            session_id: receiptToken,
            event_type: "schema_fail",
          });
        } catch {
          // swallow
        }
      }

      // Log receipt_extract_success (fallback) to user_events
      if (isSupabaseConfigured()) {
        try {
          await supabase.from("user_events").insert({
            event_name: "receipt_extract_success",
            event_data: {
              receipt_token: receiptToken,
              vehicle_year: input.year || null,
              vehicle_model: `${input.make || ""} ${input.model || ""}`.trim() || null,
              lint_passed: false,
              is_fallback: true,
              error_code: "schema_fail",
            },
            ip_address: clientIP,
            page_path: "/api/receipt",
            timestamp: new Date().toISOString(),
          });
        } catch {
          // swallow
        }
      }

      // Return a fallback receipt so the user always gets a result
      const fallbackReceipt = buildFallbackReceipt(input);
      incrementDailyCount(receiptToken as string);
      timings.total = Date.now() - t0;
      console.log(`[Receipt API] Returning fallback receipt after schema fail (${timings.total}ms)`);

      // Save fallback receipt to DB so checkout can find it
      let fallbackDbSaved = false;
      if (isSupabaseConfigured()) {
        try {
          const urlDomain = input.listing_url
            ? new URL(input.listing_url).hostname.replace("www.", "")
            : null;
          const { error: fbInsertErr } = await supabase.from("receipts").insert({
            id: fallbackReceipt.receipt_id,
            session_id: receiptToken,
            source: "receipt_page",
            page_source: (body.page_source as string) || null,
            listing_url: input.listing_url || null,
            url_domain: urlDomain,
            listing_text: input.listing_text ? input.listing_text.substring(0, 5000) : null,
            input_json: input,
            output_json: fallbackReceipt,
            mode: "single",
            is_pro: isPro,
          });
          if (fbInsertErr) {
            console.error("[Receipt API] Fallback DB insert failed:", fbInsertErr.message, fbInsertErr.code);
          } else {
            fallbackDbSaved = true;
          }
        } catch {
          // non-critical
        }
      }

      const fallbackPayload = {
        success: true,
        receipt: fallbackReceipt,
        db_saved: fallbackDbSaved,
        lint_passed: true,
        lint_errors: [],
        lint_error_codes: [],
        remaining_free: Math.max(0, dailyLimit.remaining - 1),
        is_pro: isPro,
        features,
        fallback: true,
      };

      if (requestRowId) {
        await completeRequest(requestRowId, fallbackReceipt.receipt_id, fallbackPayload);
      }

      return NextResponse.json(fallbackPayload);
    }

    // 8b. If lint failed, try formatting fixer
    if (!lintPassed && lintErrors.length > 0) {
      console.log(
        `[Receipt API] Lint errors after ${retried ? "retry" : "first attempt"}:`,
        lintErrors.map((e) => e.code)
      );

      try {
        const patched = await fixReceiptFormatting(
          finalReceipt as unknown as Record<string, unknown>,
          lintErrors
        );
        if (patched) {
          const revalidation = validateReceiptSchema(patched);
          if (revalidation.valid || revalidation.lintErrors.length < lintErrors.length) {
            finalReceipt = (revalidation.sanitized || patched) as typeof finalReceipt;
            validation = revalidation;
            lintPassed = revalidation.valid;
            lintErrors = revalidation.lintErrors;
            console.log("[Receipt API] Formatting fixer improved result");
          }
        }
      } catch (fixErr) {
        logApi("warn", "Formatting fixer error", {
          endpoint: "/api/receipt",
          anon_id: receiptToken as string,
          error_code: "format_fix_fail",
          elapsed_ms: Date.now() - t0,
        });
      }
    }

    // 9. Post-gen rendering: if reddit_draft exists, render receipt_reddit_text deterministically
    if (
      finalReceipt.reddit_draft &&
      typeof finalReceipt.reddit_draft === "object" &&
      (finalReceipt.reddit_draft as Record<string, unknown>).title
    ) {
      try {
        const rendered = renderRedditDraft(
          finalReceipt.reddit_draft as Parameters<typeof renderRedditDraft>[0]
        );
        if (rendered.length >= 40 && rendered.length <= 1200) {
          finalReceipt = { ...finalReceipt, receipt_reddit_text: rendered };
        }
      } catch {
        // Keep AI-generated receipt_reddit_text as fallback
      }
    }

    timings.validate = Date.now() - t0;

    // 10. Increment daily counter (in-memory fallback)
    incrementDailyCount(receiptToken as string);

    // 10. Log to Supabase
    let dbSaved = false;
    if (isSupabaseConfigured()) {
      try {
        // Insert receipt record
        const urlDomain = input.listing_url
          ? new URL(input.listing_url).hostname.replace("www.", "")
          : null;

        const { error: receiptError } = await supabase.from("receipts").insert({
          id: finalReceipt.receipt_id,
          session_id: receiptToken,
          source: "receipt_page",
          page_source: (body.page_source as string) || null,
          listing_url: input.listing_url || null,
          url_domain: urlDomain,
          listing_text: input.listing_text
            ? input.listing_text.substring(0, 5000)
            : null,
          input_json: input,
          output_json: finalReceipt,
          mode: "single",
          is_pro: isPro,
        });

        if (receiptError) {
          console.error("[Receipt API] DB insert failed:", receiptError.message, receiptError.code);
          logApi("warn", "Failed to log receipt to DB", {
            endpoint: "/api/receipt",
            anon_id: receiptToken as string,
            error_code: "db_receipt_insert",
            error_message: receiptError.message,
            receipt_id: finalReceipt.receipt_id,
          });
        } else {
          dbSaved = true;
        }

        // Insert generate event
        const { error: eventError } = await supabase
          .from("receipt_events")
          .insert({
            receipt_id: finalReceipt.receipt_id,
            session_id: receiptToken,
            event_type: "generate",
            url_domain: urlDomain,
            verdict: finalReceipt.verdict,
            price_label: finalReceipt.price_sanity?.label || null,
            ip_hash: ipHash || null,
          });

        if (eventError) {
          logApi("warn", "Failed to log receipt event", {
            endpoint: "/api/receipt",
            anon_id: receiptToken as string,
            error_code: "db_event_insert",
            receipt_id: finalReceipt.receipt_id,
          });
        }

        // Log receipt_extract_success to user_events
        try {
          await supabase.from("user_events").insert({
            event_name: "receipt_extract_success",
            event_data: {
              receipt_id: finalReceipt.receipt_id,
              receipt_token: receiptToken,
              vehicle_year: input.year || null,
              vehicle_model: `${input.make || ""} ${input.model || ""}`.trim() || null,
              lint_passed: lintPassed,
              is_fallback: false,
            },
            ip_address: clientIP,
            page_path: "/api/receipt",
            timestamp: new Date().toISOString(),
          });
        } catch {
          // swallow — non-critical
        }

        // Log lint_fail event if applicable
        if (!lintPassed) {
          await supabase.from("receipt_events").insert({
            receipt_id: finalReceipt.receipt_id,
            session_id: receiptToken,
            event_type: "lint_fail",
          });
        }
      } catch (logErr) {
        logApi("warn", "DB logging failed", { endpoint: "/api/receipt", anon_id: receiptToken as string, error_code: "db_log_fail" });
      }
    }

    timings.db = Date.now() - t0;

    // 12. Vehicle classification
    const vehicleClassification = classifyVehicle(
      input.make || "",
      input.model || "",
      input.trim,
      input.listing_text
    );

    // 13. Build vehicle_used echo
    const vehicle_used: Record<string, unknown> = {};
    for (const key of [
      "year", "make", "model", "trim", "mileage", "price", "vin", "location",
      "seller_type", "title_status", "country", "zip_or_postcode",
    ]) {
      if ((input as unknown as Record<string, unknown>)[key] !== undefined) {
        vehicle_used[key] = (input as unknown as Record<string, unknown>)[key];
      }
    }

    // 13. Return response
    timings.total = Date.now() - t0;
    console.log(`[Receipt API] timings: parse=${timings.parse}ms auth=${timings.auth}ms openai=${timings.openai}ms validate=${timings.validate}ms db=${timings.db}ms total=${timings.total}ms retried=${retried}`);

    const responsePayload = {
      success: true,
      receipt: finalReceipt,
      db_saved: dbSaved,
      lint_passed: lintPassed,
      lint_errors: validation.errors,
      lint_error_codes: lintErrors,
      remaining_free: Math.max(0, dailyLimit.remaining - 1),
      is_pro: isPro,
      features,
      vehicle_used,
      vehicle_category: vehicleClassification.category,
      extraction_id: input.extraction_id || null,
    };

    // Cache for idempotency
    if (requestRowId) {
      await completeRequest(requestRowId, finalReceipt.receipt_id, responsePayload);
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    // Differentiate error codes
    const isTimeoutOrAIError =
      error instanceof Error &&
      (error.message.includes("timeout") ||
        error.message.includes("Connection error") ||
        error.message.includes("503") ||
        error.message.includes("429") ||
        error.message.includes("APIConnectionError") ||
        error.message.includes("aborted") ||
        error.name === "AbortError" ||
        error.name === "APIConnectionError" ||
        error.name === "APIError");

    logApi("error", "Receipt generation failed", {
      endpoint: "/api/receipt",
      anon_id: receiptToken as string,
      error_code: isTimeoutOrAIError ? "generate_timeout" : "generate_fail",
      elapsed_ms: Date.now() - t0,
      error_message: error instanceof Error ? error.message : "Unknown",
    });

    // Log generate_fail event
    if (isSupabaseConfigured()) {
      try {
        await supabase.from("receipt_events").insert({
          session_id: receiptToken,
          event_type: isTimeoutOrAIError ? "generate_timeout" : "generate_fail",
        });
      } catch {
        // swallow logging errors
      }
    }

    // Log receipt_extract_failed to user_events
    if (isSupabaseConfigured()) {
      try {
        await supabase.from("user_events").insert({
          event_name: "receipt_extract_failed",
          event_data: {
            receipt_token: receiptToken,
            error_code: isTimeoutOrAIError ? "generate_timeout" : "generate_fail",
            message_safe: isTimeoutOrAIError ? "AI generation timed out" : "Generation failed",
            failure_reason: isTimeoutOrAIError ? "timeout_or_ai_error" : "generation_error",
            input_length: (input.listing_text || "").length,
          },
          ip_address: clientIP,
          page_path: "/api/receipt",
          timestamp: new Date().toISOString(),
        });
      } catch {
        // swallow
      }
    }

    // On timeout/AI errors, return a fallback receipt instead of an error
    if (isTimeoutOrAIError) {
      const fallbackReceipt = buildFallbackReceipt(input);
      timings.total = Date.now() - t0;
      console.log(`[Receipt API] Returning fallback receipt after error (${timings.total}ms)`);

      // Still increment daily counter
      incrementDailyCount(receiptToken as string);

      // Save fallback receipt to DB so checkout can find it
      let errorFallbackDbSaved = false;
      if (isSupabaseConfigured()) {
        try {
          const urlDomain = input.listing_url
            ? new URL(input.listing_url).hostname.replace("www.", "")
            : null;
          const { error: fbInsertErr } = await supabase.from("receipts").insert({
            id: fallbackReceipt.receipt_id,
            session_id: receiptToken,
            source: "receipt_page",
            page_source: (body.page_source as string) || null,
            listing_url: input.listing_url || null,
            url_domain: urlDomain,
            listing_text: input.listing_text ? input.listing_text.substring(0, 5000) : null,
            input_json: input,
            output_json: fallbackReceipt,
            mode: "single",
            is_pro: isPro,
          });
          if (fbInsertErr) {
            console.error("[Receipt API] Error-fallback DB insert failed:", fbInsertErr.message, fbInsertErr.code);
          } else {
            errorFallbackDbSaved = true;
          }
        } catch {
          // non-critical
        }
      }

      const fallbackPayload = {
        success: true,
        receipt: fallbackReceipt,
        db_saved: errorFallbackDbSaved,
        lint_passed: true,
        lint_errors: [],
        lint_error_codes: [],
        remaining_free: Math.max(0, dailyLimit.remaining - 1),
        is_pro: isPro,
        features,
        fallback: true,
      };

      // Cache fallback for idempotency (still a valid response)
      if (requestRowId) {
        await completeRequest(requestRowId, fallbackReceipt.receipt_id, fallbackPayload);
      }

      return NextResponse.json(fallbackPayload);
    }

    // Non-recoverable error — mark request as failed so retry is allowed
    if (requestRowId) {
      await failRequest(requestRowId, error instanceof Error ? error.message : "Unknown error");
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to generate receipt",
      },
      { status: 500 }
    );
  }
}

// --- Fix-only handler ---

async function handleFixOnly(
  receiptJson: unknown,
  clientLintErrors: LintError[] | undefined,
  receiptToken: string
) {
  // Validate the incoming receipt first
  const validation = validateReceiptSchema(receiptJson);

  // If schema fails, can't fix
  if (!validation.sanitized) {
    return NextResponse.json(
      { success: false, error: "Invalid receipt structure" },
      { status: 400 }
    );
  }

  const lintErrors = clientLintErrors?.length
    ? clientLintErrors
    : validation.lintErrors;

  if (lintErrors.length === 0) {
    // Already clean
    return NextResponse.json({
      success: true,
      receipt: validation.sanitized,
      lint_passed: true,
      lint_errors: [],
      lint_error_codes: [],
    });
  }

  try {
    const patched = await fixReceiptFormatting(
      receiptJson as Record<string, unknown>,
      lintErrors
    );

    if (!patched) {
      return NextResponse.json({
        success: true,
        receipt: validation.sanitized,
        lint_passed: false,
        lint_errors: validation.errors,
        lint_error_codes: validation.lintErrors,
      });
    }

    const revalidation = validateReceiptSchema(patched);

    // Log regen event
    if (isSupabaseConfigured()) {
      try {
        const receiptId =
          (receiptJson as Record<string, unknown>)?.receipt_id || null;
        await supabase.from("receipt_events").insert({
          receipt_id: receiptId,
          session_id: receiptToken,
          event_type: "regen",
        });
      } catch {
        // swallow
      }
    }

    return NextResponse.json({
      success: true,
      receipt: revalidation.sanitized || patched,
      lint_passed: revalidation.valid,
      lint_errors: revalidation.errors,
      lint_error_codes: revalidation.lintErrors,
    });
  } catch (err) {
    logApi("error", "Fix-only failed", { endpoint: "/api/receipt", anon_id: receiptToken, error_code: "fix_only_fail" });
    return NextResponse.json(
      { success: false, error: "Auto-fix failed" },
      { status: 500 }
    );
  }
}
