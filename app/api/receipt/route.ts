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
import { hashIP, isValidReceiptToken } from "@/lib/session-utils";
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

  // 2. Validate receipt_token (format + age check)
  const receiptToken = body.receipt_token;
  const tokenIsInternal = isInternalTester(receiptToken as string);
  if (!receiptToken || typeof receiptToken !== "string" ||
      (!tokenIsInternal && !isValidReceiptToken(receiptToken))) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid receipt_token" },
      { status: 400 }
    );
  }

  // 3. Burst rate limit (testers bypass)
  if (!tokenIsInternal) {
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

  // --- RECEIPT LITE: Return deterministic receipt immediately (<2s) ---
  const liteReceipt = buildEnhancedFallbackReceipt(input, ruleSignals, ruleScoring);

  // Save lite receipt to DB
  let liteDbSaved = false;
  if (isSupabaseConfigured()) {
    const urlDomain = input.listing_url
      ? (() => { try { return new URL(input.listing_url!).hostname.replace("www.", ""); } catch { return null; } })()
      : null;
    const { error: insertErr } = await supabase.from("receipts").insert({
      id: liteReceipt.receipt_id,
      session_id: receiptToken,
      user_id: userId || null,
      source: "receipt_page",
      page_source: (body.page_source as string) || null,
      listing_url: input.listing_url || null,
      url_domain: urlDomain,
      listing_text: input.listing_text ? input.listing_text.substring(0, 5000) : null,
      input_json: input,
      output_json: liteReceipt,
      mode: "single",
      is_pro: isPro,
      generation_status: "lite",
    });
    if (insertErr) {
      console.error("[Receipt API] Lite DB insert failed:", insertErr.message, insertErr.code);
    } else {
      liteDbSaved = true;
    }

    // Log generate event
    supabase.from("receipt_events").insert({
      receipt_id: liteReceipt.receipt_id,
      session_id: receiptToken,
      event_type: "generate",
      url_domain: urlDomain,
      listing_source: urlDomain ? detectListingSource(urlDomain) : "text_paste",
      verdict: liteReceipt.verdict,
      price_label: liteReceipt.price_sanity?.label || null,
      ip_hash: ipHash || null,
    }).then(() => {}, () => {});

    // Log user event
    supabase.from("user_events").insert({
      event_name: "receipt_extract_succeeded",
      event_data: {
        receipt_id: liteReceipt.receipt_id,
        receipt_token: receiptToken,
        vehicle_year: input.year || null,
        vehicle_model: `${input.make || ""} ${input.model || ""}`.trim() || null,
        lint_passed: true,
        is_fallback: false,
        is_lite: true,
        region: input.region || "US",
        fit_score: liteReceipt.fit_score ?? null,
        evidence_score: liteReceipt.evidence_score ?? null,
        evidence_label: liteReceipt.evidence_label ?? null,
      },
      ip_address: clientIP,
      page_path: "/api/receipt",
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});

    // Update email funnel stage (fire-and-forget)
    if (receiptToken) {
      supabase
        .from("checklist_email_captures")
        .update({ funnel_stage: "receipt_completed", updated_at: new Date().toISOString() })
        .eq("anon_id", receiptToken as string)
        .eq("funnel_stage", "lead")
        .then(() => {});
    }
  }

  incrementDailyCount(receiptToken as string);
  decrementReceiptCredit(receiptToken as string).catch(() => {});

  timings.total = Date.now() - t0;
  console.log(`[Receipt API] Returning Receipt Lite in ${timings.total}ms (signals=${ruleSignals.length} verdict=${ruleScoring.verdict} fit=${ruleScoring.fit_score})`);

  const litePayload = {
    success: true,
    receipt: liteReceipt,
    receipt_id: liteReceipt.receipt_id,
    generation_status: "lite" as const,
    db_saved: liteDbSaved,
    lint_passed: true,
    lint_errors: [],
    lint_error_codes: [] as LintError[],
    remaining_free: Math.max(0, dailyLimit.remaining - 1),
    is_pro: isPro,
    features,
    fallback: false,
    region: input.region || "US",
    vehicle_category: ruleClassification.category,
  };

  // Cache for idempotency
  if (requestRowId) {
    await completeRequest(requestRowId, liteReceipt.receipt_id, litePayload);
  }

  // Fire-and-forget: trigger async upgrade in the same invocation
  upgradeReceiptAsync({
    receiptId: liteReceipt.receipt_id,
    input,
    features,
    receiptToken: receiptToken as string,
    userId,
    clientIP,
    ipHash,
    t0,
    ruleSignals,
    ruleScoring,
    ruleClassification,
    isPro,
    body,
  }).catch((err) => {
    console.error("[Receipt API] Async upgrade error:", err instanceof Error ? err.message : err);

    // Log the outer error too (this shouldn't normally happen since upgradeReceiptAsync handles its own errors)
    if (isSupabaseConfigured()) {
      supabase.from("receipt_events").insert({
        receipt_id: liteReceipt.receipt_id,
        session_id: receiptToken as string,
        event_type: "upgrade_exception",
      }).then(() => {}, () => {});

      logApi("error", "Unhandled upgrade exception", {
        endpoint: "/api/receipt",
        anon_id: receiptToken as string,
        error_code: "upgrade_exception",
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return NextResponse.json(litePayload);
}

// --- Async AI Upgrade (fire-and-forget after lite response) ---

interface UpgradeParams {
  receiptId: string;
  input: ReceiptGenerateRequest;
  features: ReturnType<typeof getFeatureFlags>;
  receiptToken: string;
  userId: string | undefined;
  clientIP: string;
  ipHash: string | null;
  t0: number;
  ruleSignals: string[];
  ruleScoring: ReturnType<typeof scoreReceipt>;
  ruleClassification: ReturnType<typeof classifyVehicle>;
  isPro: boolean;
  body: Record<string, unknown>;
}

async function upgradeReceiptAsync(params: UpgradeParams) {
  const { receiptId, input, features, receiptToken, userId, clientIP, ipHash, t0, ruleSignals, ruleScoring, ruleClassification, isPro, body } = params;

  if (!isSupabaseConfigured()) return;

  // Mark as generating
  await supabase.from("receipts")
    .update({ generation_status: "generating" })
    .eq("id", receiptId);

  const timings: Record<string, number> = {};

  try {
    // Call OpenAI with internal deadline (race against Netlify's 60s kill)
    const INTERNAL_DEADLINE_MS = 55_000;
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
        console.log(`[Receipt Upgrade] Internal deadline hit at ${Date.now() - t0}ms`);
        throw new Error("Request timed out.");
      }
      throw raceErr;
    }

    timings.openai = Date.now() - t0;

    // Validate receipt (Zod parse + lint)
    let validation = validateReceiptSchema(receipt);
    let lintPassed = validation.valid;
    let lintErrors = validation.lintErrors;
    let finalReceipt = validation.sanitized || receipt;

    // If Zod parse failed (schema_fail), mark as failed — lite receipt is already served
    if (!validation.sanitized && validation.errors.length > 0 && validation.lintErrors.length === 0) {
      logApi("error", "Schema validation failed in async upgrade", {
        endpoint: "/api/receipt",
        anon_id: receiptToken,
        error_code: "schema_fail",
        elapsed_ms: Date.now() - t0,
        retried,
        errors: validation.errors,
      });

      supabase.from("receipt_events").insert({
        session_id: receiptToken,
        event_type: "schema_fail",
      }).then(() => {}, () => {});

      await supabase.from("receipts")
        .update({ generation_status: "failed" })
        .eq("id", receiptId);

      console.log(`[Receipt Upgrade] Schema fail for ${receiptId}, keeping lite receipt`);
      return;
    }

    // If lint failed, try formatting fixer
    if (!lintPassed && lintErrors.length > 0) {
      console.log(
        `[Receipt Upgrade] Lint errors after ${retried ? "retry" : "first attempt"}:`,
        lintErrors.map((e) => e.code)
      );

      try {
        supabase.from("receipt_events").insert({
          session_id: receiptToken,
          event_type: "schema_repair_attempted",
        }).then(() => {}, () => {});

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
            console.log("[Receipt Upgrade] Formatting fixer improved result");

            supabase.from("receipt_events").insert({
              session_id: receiptToken,
              event_type: "schema_repair_succeeded",
            }).then(() => {}, () => {});
          } else {
            supabase.from("receipt_events").insert({
              session_id: receiptToken,
              event_type: "schema_repair_failed",
            }).then(() => {}, () => {});
          }
        }
      } catch (fixErr) {
        logApi("warn", "Formatting fixer error", {
          endpoint: "/api/receipt",
          anon_id: receiptToken,
          error_code: "format_fix_fail",
          elapsed_ms: Date.now() - t0,
        });
      }
    }

    // Post-gen rendering: if reddit_draft exists, render receipt_reddit_text deterministically
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

    // Deterministic scoring post-processing
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
          console.log(`[Receipt Upgrade] Scoring V2: risk=${v2Result.risk_points} confidence=${v2Result.confidence_points} verdict=${v2Result.verdict} (AI said ${aiVerdict})`);
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
          console.log(`[Receipt Upgrade] Scoring V1: fit=${scoringResult.fit_score} evidence=${scoringResult.evidence_score} verdict=${scoringResult.verdict} (AI said ${aiVerdict})`);
        }
      } catch (scoreErr) {
        console.error("[Receipt Upgrade] Scoring engine error, keeping AI verdict:", scoreErr);
      }
    }

    // Keep receipt_id consistent with the lite receipt
    finalReceipt = { ...finalReceipt, receipt_id: receiptId } as typeof finalReceipt;

    // Update receipt with full AI output
    const { error: updateError } = await supabase.from("receipts").update({
      output_json: finalReceipt,
      generation_status: "full",
    }).eq("id", receiptId);

    if (updateError) {
      console.error("[Receipt Upgrade] DB update failed:", updateError.message, updateError.code);
    }

    // Log upgrade event
    const urlDomain = input.listing_url
      ? (() => { try { return new URL(input.listing_url!).hostname.replace("www.", ""); } catch { return null; } })()
      : null;

    supabase.from("receipt_events").insert({
      receipt_id: receiptId,
      session_id: receiptToken,
      event_type: "ai_upgrade_complete",
      url_domain: urlDomain,
      listing_source: urlDomain ? detectListingSource(urlDomain) : "text_paste",
      verdict: finalReceipt.verdict,
      price_label: finalReceipt.price_sanity?.label || null,
      ip_hash: ipHash || null,
    }).then(() => {}, () => {});

    // Log to user_events
    supabase.from("user_events").insert({
      event_name: "receipt_full_ready",
      event_data: {
        receipt_id: receiptId,
        receipt_token: receiptToken,
        vehicle_year: input.year || null,
        vehicle_model: `${input.make || ""} ${input.model || ""}`.trim() || null,
        lint_passed: lintPassed,
        region: input.region || "US",
        fit_score: finalReceipt.fit_score ?? null,
        evidence_score: finalReceipt.evidence_score ?? null,
        evidence_label: finalReceipt.evidence_label ?? null,
        ai_verdict: aiVerdict ?? null,
        upgrade_ms: Date.now() - t0,
      },
      ip_address: clientIP,
      page_path: "/api/receipt",
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});

    // Log lint_fail event if applicable
    if (!lintPassed) {
      supabase.from("receipt_events").insert({
        receipt_id: receiptId,
        session_id: receiptToken,
        event_type: "lint_fail",
      }).then(() => {}, () => {});
    }

    console.log(`[Receipt Upgrade] Successfully upgraded ${receiptId} to full in ${Date.now() - t0}ms`);

  } catch (error) {
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

    logApi("error", "Async receipt upgrade failed", {
      endpoint: "/api/receipt",
      anon_id: receiptToken,
      error_code: isTimeoutOrAIError ? "upgrade_timeout" : "upgrade_fail",
      elapsed_ms: Date.now() - t0,
      error_message: error instanceof Error ? error.message : "Unknown",
    });

    // Log failure events
    supabase.from("receipt_events").insert({
      receipt_id: receiptId,
      session_id: receiptToken,
      event_type: isTimeoutOrAIError ? "upgrade_timeout" : "upgrade_fail",
    }).then(() => {}, () => {});

    supabase.from("user_events").insert({
      event_name: "receipt_upgrade_failed",
      event_data: {
        receipt_id: receiptId,
        receipt_token: receiptToken,
        error_code: isTimeoutOrAIError ? "upgrade_timeout" : "upgrade_fail",
        rule_signal_count: ruleSignals.length,
        rule_verdict: ruleScoring.verdict,
        rule_fit_score: ruleScoring.fit_score,
      },
      ip_address: clientIP,
      page_path: "/api/receipt",
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});

    // Try similarity match to upgrade the lite receipt
    if (isTimeoutOrAIError) {
      try {
        const similarResult = await findSimilarReceipt(input);
        if (similarResult) {
          const similarReceipt = {
            ...similarResult.receipt,
            receipt_id: receiptId,
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
            verdict_reason: `Based on analysis of a similar ${input.year || ""} ${input.make || ""} ${input.model || "vehicle"}. ${similarResult.confidence >= 0.7 ? "High" : "Medium"} confidence match.`.trim().replace(/\s+/g, " "),
          };

          await supabase.from("receipts").update({
            output_json: similarReceipt,
            generation_status: "full",
          }).eq("id", receiptId);

          supabase.from("receipt_events").insert({
            receipt_id: receiptId,
            session_id: receiptToken,
            event_type: "similarity_match",
          }).then(() => {}, () => {});

          console.log(`[Receipt Upgrade] Similarity match for ${receiptId} (confidence=${similarResult.confidence.toFixed(2)})`);
          return;
        }
      } catch {
        // Similarity search failed — fall through to mark as failed
      }
    }

    // No recovery possible — mark as failed (lite receipt stays)
    await supabase.from("receipts")
      .update({ generation_status: "failed" })
      .eq("id", receiptId);

    console.log(`[Receipt Upgrade] Failed for ${receiptId}, keeping lite receipt`);
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
