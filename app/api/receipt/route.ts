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
import { receiptBurstLimiter, checkDailyLimit, incrementDailyCount, decrementReceiptCredit } from "@/lib/receipt-rate-limiter";
import { generateReceipt, fixReceiptFormatting, buildEnhancedFallbackReceipt } from "@/lib/receipt-openai";
import { extractSignalsFromText } from "@/lib/receipt-signal-extractor";
import { validateReceiptSchema } from "@/lib/receipt-schema-validator";
import type { LintError } from "@/lib/receipt-schema-validator";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { hashIP } from "@/lib/session-utils";
import { checkIsPro } from "@/lib/receipt-pro";
import { getFeatureFlags } from "@/lib/feature-flags";
import { computeInputHash, checkIdempotency, claimRequest, completeRequest, failRequest } from "@/lib/receipt-idempotency";
import { renderRedditDraft } from "@/lib/reddit-draft-renderer";
import { classifyVehicle } from "@/lib/vehicle-classifier";
import { scoreReceipt } from "@/lib/receipt-scoring";
import { scoreReceiptV2 } from "@/lib/receipt-scoring-v2";
import { isInternalTester } from "@/lib/rollout-flags";
import { guardTurnstile } from "@/lib/turnstile";
import type { ReceiptGenerateRequest } from "@/types/receipt";
import { findSimilarReceipt } from "@/lib/receipt-similarity";
import { logApi } from "@/lib/api-logger";
import { detectListingSource } from "@/lib/listing-scraper";

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

  // 1b. Bot protection — honeypot check is instant (no await)
  if (body.leave_this_empty) {
    return NextResponse.json(
      { success: false, error: "Request blocked", captcha_required: true },
      { status: 403 }
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

  // 5. Turnstile + Auth + idempotency ALL in parallel (saves 2-4s)
  const forceRegenerate = body.force_regenerate === true;
  const accessToken = request.cookies.get("sb-access-token")?.value;
  const serverSessionId = request.cookies.get("receipt_session")?.value;
  const ipHash = hashIP(clientIP);

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

  // Run Turnstile, auth chain, and idempotency check concurrently
  const turnstilePromise = guardTurnstile(body, clientIP, "/api/receipt");

  const authPromise = (async () => {
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
    return { userId, userEmail, isPro };
  })();

  const [blocked, authResult, idempotency] = await Promise.all([
    turnstilePromise,
    authPromise,
    checkIdempotency(inputHash, forceRegenerate),
  ]);

  // Turnstile rejection — return 403
  if (blocked) return blocked;

  const { isPro } = authResult;
  let { userId } = authResult;
  const features = getFeatureFlags(isPro);
  timings.auth = Date.now() - t0;

  // 5b. Idempotency early returns
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

  // 6. Daily free limit + claim request in parallel
  const [dailyLimit, requestRowId] = await Promise.all([
    checkDailyLimit(receiptToken as string, isPro, serverSessionId, ipHash || undefined),
    claimRequest(inputHash, receiptToken as string, ipHash || undefined),
  ]);

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
    region: body.region === "UK" ? "UK" : "US",
    mode: "single",
  };

  // 6b. Extract signals deterministically from text (< 5ms, no network)
  const ruleClassification = classifyVehicle(
    input.make || "", input.model || "", input.trim, input.listing_text
  );
  const ruleSignals = extractSignalsFromText(
    input.listing_text || null,
    {
      title_status: input.title_status,
      service_history: input.service_history,
      accidents_reported: input.accidents_reported,
      owners: input.owners,
      vin: input.vin,
      carfax_available: input.carfax_available,
    },
    ruleClassification
  );
  const ruleScoring = scoreReceipt(ruleSignals);
  timings.rules = Date.now() - t0;

  try {
    // 7. Call OpenAI with internal deadline (race against Netlify's 60s kill)
    const INTERNAL_DEADLINE_MS = 55_000; // 55s — leaves 5s buffer for fallback writes + response serialization
    const elapsed = Date.now() - t0;
    const remainingMs = INTERNAL_DEADLINE_MS - elapsed;

    const deadlineError = Symbol("deadline");
    const deadlinePromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(deadlineError), Math.max(remainingMs, 1000))
    );

    let receipt: Awaited<ReturnType<typeof generateReceipt>>["receipt"];
    let retried: boolean;

    try {
      const result = await Promise.race([
        generateReceipt(input),
        deadlinePromise,
      ]);
      receipt = result.receipt;
      retried = result.retried;
    } catch (raceErr) {
      if (raceErr === deadlineError) {
        console.log(`[Receipt API] Internal deadline hit at ${Date.now() - t0}ms, returning fallback`);
        throw new Error("Request timed out.");
      }
      throw raceErr;
    }

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
            event_name: "receipt_extract_succeeded",
            event_data: {
              receipt_token: receiptToken,
              vehicle_year: input.year || null,
              vehicle_model: `${input.make || ""} ${input.model || ""}`.trim() || null,
              lint_passed: false,
              is_fallback: true,
              error_code: "schema_fail",
              region: input.region || "US",
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
      const fallbackReceipt = buildEnhancedFallbackReceipt(input, ruleSignals, ruleScoring);
      incrementDailyCount(receiptToken as string);
      decrementReceiptCredit(receiptToken as string).catch(() => {});
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
            user_id: userId || null,
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
        region: input.region || "US",
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
        if (isSupabaseConfigured()) {
          supabase.from("receipt_events").insert({
            session_id: receiptToken,
            event_type: "schema_repair_attempted",
          }).then(() => {}, () => {});
        }

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

            if (isSupabaseConfigured()) {
              supabase.from("receipt_events").insert({
                session_id: receiptToken,
                event_type: "schema_repair_succeeded",
              }).then(() => {}, () => {});
            }
          } else {
            if (isSupabaseConfigured()) {
              supabase.from("receipt_events").insert({
                session_id: receiptToken,
                event_type: "schema_repair_failed",
              }).then(() => {}, () => {});
            }
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

    // 9b. Deterministic scoring post-processing
    const aiVerdict = finalReceipt.verdict;
    if (finalReceipt.listing_signals && Array.isArray(finalReceipt.listing_signals) && finalReceipt.listing_signals.length > 0) {
      try {
        if (features.scoringV2) {
          const v2Result = scoreReceiptV2(finalReceipt.listing_signals as string[]);
          finalReceipt = {
            ...finalReceipt,
            verdict: v2Result.verdict,
            fit_score: v2Result.fit_score,
            evidence_score: v2Result.evidence_score,
            evidence_label: v2Result.evidence_label,
            scoring_reasons: v2Result.scoring_reasons,
            why_not_green: v2Result.why_not_green.map(f => ({
              signal_id: f.signal_id,
              category: f.category,
              points: f.risk_points,
              label: f.ui_label,
            })),
            verify_before_visit: v2Result.verify_before_visit,
            scoring_version: "v2",
          } as typeof finalReceipt;
          console.log(`[Receipt API] Scoring V2: risk=${v2Result.risk_points} confidence=${v2Result.confidence_points} verdict=${v2Result.verdict} (AI said ${aiVerdict})`);
        } else {
          const scoringResult = scoreReceipt(finalReceipt.listing_signals as string[]);
          finalReceipt = {
            ...finalReceipt,
            verdict: scoringResult.verdict,
            fit_score: scoringResult.fit_score,
            evidence_score: scoringResult.evidence_score,
            evidence_label: scoringResult.evidence_label,
            scoring_reasons: scoringResult.scoring_reasons,
            why_not_green: scoringResult.why_not_green,
            verify_before_visit: scoringResult.verify_before_visit,
          };
          console.log(`[Receipt API] Scoring V1: fit=${scoringResult.fit_score} evidence=${scoringResult.evidence_score} verdict=${scoringResult.verdict} (AI said ${aiVerdict})`);
        }
      } catch (scoreErr) {
        console.error("[Receipt API] Scoring engine error, keeping AI verdict:", scoreErr);
      }
    }

    timings.validate = Date.now() - t0;

    // 10. Increment daily counter (in-memory fallback) + decrement Buyer Pass credit
    incrementDailyCount(receiptToken as string);
    const creditResult = await decrementReceiptCredit(receiptToken as string);
    if (creditResult >= 0 && isSupabaseConfigured()) {
      supabase.from("user_events").insert({
        event_name: "receipt_credit_used",
        event_data: {
          receipt_id: finalReceipt.receipt_id,
          receipt_token: receiptToken,
          credits_remaining: creditResult,
        },
        page_path: "/api/receipt",
        timestamp: new Date().toISOString(),
      }).then(() => {}, () => {});
    }

    // 10b. Log to Supabase
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
          user_id: userId || null,
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
            listing_source: urlDomain ? detectListingSource(urlDomain) : "text_paste",
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
            event_name: "receipt_extract_succeeded",
            event_data: {
              receipt_id: finalReceipt.receipt_id,
              receipt_token: receiptToken,
              vehicle_year: input.year || null,
              vehicle_model: `${input.make || ""} ${input.model || ""}`.trim() || null,
              lint_passed: lintPassed,
              is_fallback: false,
              region: input.region || "US",
              fit_score: finalReceipt.fit_score ?? null,
              evidence_score: finalReceipt.evidence_score ?? null,
              evidence_label: finalReceipt.evidence_label ?? null,
              ai_verdict: aiVerdict ?? null,
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

        // Update email funnel stage → receipt_completed (fire-and-forget)
        if (receiptToken) {
          supabase
            .from("checklist_email_captures")
            .update({ funnel_stage: "receipt_completed", updated_at: new Date().toISOString() })
            .eq("anon_id", receiptToken as string)
            .eq("funnel_stage", "lead")
            .then(() => {});
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
      region: input.region || "US",
      fit_score: finalReceipt.fit_score ?? null,
      evidence_score: finalReceipt.evidence_score ?? null,
      evidence_label: finalReceipt.evidence_label ?? null,
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
        error.message.includes("timed out") ||
        error.message.includes("Connection error") ||
        error.message.includes("503") ||
        error.message.includes("429") ||
        error.message.includes("APIConnectionError") ||
        error.message.includes("aborted") ||
        error.name === "AbortError" ||
        error.name === "APIConnectionError" ||
        error.name === "APIConnectionTimeoutError" ||
        error.name === "APIError");

    logApi("error", "Receipt generation failed", {
      endpoint: "/api/receipt",
      anon_id: receiptToken as string,
      error_code: isTimeoutOrAIError ? "generate_timeout" : "generate_fail",
      elapsed_ms: Date.now() - t0,
      error_message: error instanceof Error ? error.message : "Unknown",
    });

    // Log events fire-and-forget (don't block response with DB writes on timeout path)
    if (isSupabaseConfigured()) {
      supabase.from("receipt_events").insert({
        session_id: receiptToken,
        event_type: isTimeoutOrAIError ? "generate_timeout" : "generate_fail",
      }).then(() => {}, () => {});

      supabase.from("user_events").insert({
        event_name: "receipt_extract_failed",
        event_data: {
          receipt_token: receiptToken,
          error_code: isTimeoutOrAIError ? "generate_timeout" : "generate_fail",
          message_safe: isTimeoutOrAIError ? "AI generation timed out" : "Generation failed",
          failure_reason: isTimeoutOrAIError ? "timeout_or_ai_error" : "generation_error",
          input_length: (input.listing_text || "").length,
          region: input.region || "US",
          rule_signal_count: ruleSignals.length,
          rule_verdict: ruleScoring.verdict,
          rule_fit_score: ruleScoring.fit_score,
        },
        ip_address: clientIP,
        page_path: "/api/receipt",
        timestamp: new Date().toISOString(),
      }).then(() => {}, () => {});
    }

    // On timeout/AI errors, try similarity match first, then fall back to deterministic receipt
    if (isTimeoutOrAIError) {
      // Still increment daily counter + decrement credit
      incrementDailyCount(receiptToken as string);
      decrementReceiptCredit(receiptToken as string).catch(() => {});

      // Try to find a similar successful receipt from the database
      const similarResult = await findSimilarReceipt(input).catch(() => null);

      if (similarResult) {
        // Use the similar receipt's AI analysis with current vehicle's details overlaid
        const { v4: uuidv4 } = await import("uuid");
        const newReceiptId = uuidv4();
        const similarReceipt = {
          ...similarResult.receipt,
          receipt_id: newReceiptId,
          listing_summary: {
            ...similarResult.receipt.listing_summary,
            listing_url: input.listing_url || "",
            url_domain: input.listing_url ? (() => { try { return new URL(input.listing_url!).hostname.replace("www.", ""); } catch { return ""; } })() : "",
            year: input.year || similarResult.receipt.listing_summary?.year || 0,
            make: input.make || similarResult.receipt.listing_summary?.make || "Unknown",
            model: input.model || similarResult.receipt.listing_summary?.model || "Vehicle",
            trim: input.trim || similarResult.receipt.listing_summary?.trim || null,
            price: input.price || similarResult.receipt.listing_summary?.price || 0,
            mileage: input.mileage || similarResult.receipt.listing_summary?.mileage || 0,
          },
          verdict_reason: `Based on analysis of a similar ${input.year || ""} ${input.make || ""} ${input.model || "vehicle"}. ${similarResult.confidence >= 0.7 ? "High" : "Medium"} confidence match. Regenerate for a vehicle-specific analysis.`.trim().replace(/\s+/g, " "),
        };

        timings.total = Date.now() - t0;
        console.log(`[Receipt API] Returning similarity-matched receipt (confidence=${similarResult.confidence.toFixed(2)}, matched=${similarResult.matchedReceiptId}) after ${timings.total}ms`);

        // Log similarity match events fire-and-forget
        if (isSupabaseConfigured()) {
          const urlDomain = input.listing_url
            ? (() => { try { return new URL(input.listing_url!).hostname.replace("www.", ""); } catch { return null; } })()
            : null;

          supabase.from("receipts").insert({
            id: newReceiptId,
            session_id: receiptToken,
            user_id: userId || null,
            source: "receipt_page",
            page_source: (body.page_source as string) || null,
            listing_url: input.listing_url || null,
            url_domain: urlDomain,
            listing_text: input.listing_text ? input.listing_text.substring(0, 5000) : null,
            input_json: input,
            output_json: similarReceipt,
            mode: "single",
            is_pro: isPro,
          }).then(
            ({ error: e }) => { if (e) console.error("[Receipt API] Similarity DB insert failed:", e.message); },
            () => {}
          );

          supabase.from("receipt_events").insert({
            receipt_id: newReceiptId,
            session_id: receiptToken,
            event_type: "similarity_match",
          }).then(() => {}, () => {});

          supabase.from("user_events").insert({
            event_name: "receipt_similarity_match",
            event_data: {
              receipt_id: newReceiptId,
              receipt_token: receiptToken,
              matched_receipt_id: similarResult.matchedReceiptId,
              similarity_confidence: similarResult.confidence,
              match_details: similarResult.matchDetails,
            },
            ip_address: clientIP,
            page_path: "/api/receipt",
            timestamp: new Date().toISOString(),
          }).then(() => {}, () => {});
        }

        const similarPayload = {
          success: true,
          receipt: similarReceipt,
          db_saved: false,
          lint_passed: true,
          lint_errors: [],
          lint_error_codes: [],
          remaining_free: Math.max(0, dailyLimit.remaining - 1),
          is_pro: isPro,
          features,
          fallback: true,
          similarity_match: true,
          similarity_confidence: similarResult.confidence,
          region: input.region || "US",
        };

        if (requestRowId) {
          completeRequest(requestRowId, newReceiptId, similarPayload).catch(() => {});
        }

        return NextResponse.json(similarPayload);
      }

      // No similarity match found — use deterministic fallback
      const fallbackReceipt = buildEnhancedFallbackReceipt(input, ruleSignals, ruleScoring);
      timings.total = Date.now() - t0;
      console.log(`[Receipt API] Returning fallback receipt after error (${timings.total}ms)`);

      // Save fallback receipt to DB fire-and-forget (don't block the response)
      if (isSupabaseConfigured()) {
        const urlDomain = input.listing_url
          ? (() => { try { return new URL(input.listing_url!).hostname.replace("www.", ""); } catch { return null; } })()
          : null;
        supabase.from("receipts").insert({
          id: fallbackReceipt.receipt_id,
          session_id: receiptToken,
          user_id: userId || null,
          source: "receipt_page",
          page_source: (body.page_source as string) || null,
          listing_url: input.listing_url || null,
          url_domain: urlDomain,
          listing_text: input.listing_text ? input.listing_text.substring(0, 5000) : null,
          input_json: input,
          output_json: fallbackReceipt,
          mode: "single",
          is_pro: isPro,
        }).then(
          ({ error: e }) => { if (e) console.error("[Receipt API] Error-fallback DB insert failed:", e.message); },
          () => {}
        );
      }

      const fallbackPayload = {
        success: true,
        receipt: fallbackReceipt,
        db_saved: false,
        lint_passed: true,
        lint_errors: [],
        lint_error_codes: [],
        remaining_free: Math.max(0, dailyLimit.remaining - 1),
        is_pro: isPro,
        features,
        fallback: true,
        region: input.region || "US",
      };

      // Cache fallback for idempotency fire-and-forget
      if (requestRowId) {
        completeRequest(requestRowId, fallbackReceipt.receipt_id, fallbackPayload)
          .catch(() => {});
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
    if (isSupabaseConfigured()) {
      supabase.from("receipt_events").insert({
        session_id: receiptToken,
        event_type: "schema_repair_attempted",
      }).then(() => {}, () => {});
    }

    const patched = await fixReceiptFormatting(
      receiptJson as Record<string, unknown>,
      lintErrors
    );

    if (!patched) {
      if (isSupabaseConfigured()) {
        supabase.from("receipt_events").insert({
          session_id: receiptToken,
          event_type: "schema_repair_failed",
        }).then(() => {}, () => {});
      }
      return NextResponse.json({
        success: true,
        receipt: validation.sanitized,
        lint_passed: false,
        lint_errors: validation.errors,
        lint_error_codes: validation.lintErrors,
      });
    }

    const revalidation = validateReceiptSchema(patched);

    // Log regen + repair result events
    if (isSupabaseConfigured()) {
      try {
        const receiptId =
          (receiptJson as Record<string, unknown>)?.receipt_id || null;
        await supabase.from("receipt_events").insert({
          receipt_id: receiptId,
          session_id: receiptToken,
          event_type: "regen",
        });
        await supabase.from("receipt_events").insert({
          session_id: receiptToken,
          event_type: revalidation.valid || revalidation.lintErrors.length < lintErrors.length
            ? "schema_repair_succeeded"
            : "schema_repair_failed",
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
