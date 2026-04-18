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

import { NextRequest, NextResponse, after } from "next/server";
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
import { classifyVehicle } from "@/lib/vehicle-classifier";
import { scoreReceipt } from "@/lib/receipt-scoring";
import { computeRoutineFit } from "@/lib/compute-routine-fit";
import type { RoutineFitScore } from "@/types/v2";
import { findRangeDataByModel } from "@/lib/data";
import type { MinimumViableRoutine } from "@/types/v2";
import { isInternalTester } from "@/lib/rollout-flags";
import { guardTurnstile } from "@/lib/turnstile";
import type { ReceiptGenerateRequest } from "@/types/receipt";
import { logApi } from "@/lib/api-logger";
import { runReceiptUpgrade } from "@/lib/receipt-upgrade";
import { detectListingSource } from "@/lib/listing-scraper";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { createTrace, finalizeTrace } from "@/lib/debug-trace";
import { persistTrace } from "@/lib/debug-trace-store";

export const maxDuration = 90;

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
  // Server-to-server calls (e.g. ingest-curated-deals) may pass x-internal-secret
  // instead of a user receipt_token — treat these as fully internal.
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const requestSecret = request.headers.get("x-internal-secret");
  const isServerInternal = !!(internalSecret && requestSecret === internalSecret);

  let receiptToken = body.receipt_token;
  if (isServerInternal && !receiptToken) {
    receiptToken = `internal-${crypto.randomUUID()}`;
  }
  const tokenIsInternal = isServerInternal || isInternalTester(receiptToken as string);
  if (!receiptToken || typeof receiptToken !== "string" ||
      (!tokenIsInternal && !isValidReceiptToken(receiptToken))) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid receipt_token" },
      { status: 400 }
    );
  }

  const debugEnabled = body.debug_trace === true;
  const trace = debugEnabled ? createTrace("receipt") : null;

  // 3. Burst rate limit (testers bypass)
  if (!tokenIsInternal) {
    const burst = await receiptBurstLimiter.checkAsync(clientIP);
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
  const { userId } = authResult;
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
  if (trace) trace.timings = { ...trace.timings, ...timings };

  // --- Optional routine fit — runs only when routine_context is provided ---
  let routineFit: RoutineFitScore | null = null;
  const routineCtx = body.routine_context as MinimumViableRoutine | undefined;
  if (routineCtx && input.model) {
    try {
      const rangeData = findRangeDataByModel(input.model);
      routineFit = computeRoutineFit(routineCtx, {
        model: input.model,
        year: input.year ?? undefined,
        real_world_range_mi: rangeData?.real_world_range_mi ?? undefined,
      });
    } catch {
      // Non-blocking — routine fit failure must not break the receipt
    }
  }

  // --- RECEIPT LITE: Return deterministic receipt immediately (<2s) ---
  const liteReceipt = buildEnhancedFallbackReceipt(input, ruleSignals, ruleScoring);

  // Save lite receipt to DB
  let liteDbSaved = false;
  if (!tokenIsInternal && isSupabaseConfigured()) {
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

      // Exit win-back sequence if user is authenticated and in the win-back state
      if (userId) {
        supabase.from("crm_win_back_state")
          .update({ exited_at: new Date().toISOString() })
          .eq("user_id", userId)
          .is("exited_at", null)
          .then(() => {}, () => {});
      }
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

  if (!tokenIsInternal) {
    incrementDailyCount(receiptToken as string);
    decrementReceiptCredit(receiptToken as string).catch(() => {});
  }

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
    routine_context_used: routineFit !== null,
    routine_fit_label: routineFit?.label ?? null,
    routine_fit_score: routineFit?.score_0_100 ?? null,
    routine_fit_summary: routineFit && routineCtx ? buildRoutineSummary(routineFit, routineCtx) : null,
  };

  // Cache for idempotency
  if (requestRowId) {
    await completeRequest(requestRowId, liteReceipt.receipt_id, litePayload);
  }

  // Recall lookup — surface active recalls for this VIN if user is authenticated
  let recalls: Array<{
    recall_id: string;
    title: string;
    component: string;
    routine_impact_score: number;
    is_safety_critical: boolean;
    ai_summary: string;
  }> = [];
  if (input.vin && userId && isSupabaseConfigured()) {
    try {
      const adminSb = getSupabaseAdmin();
      if (adminSb) {
        // Find the garage vehicle matching this user + VIN
        const { data: vehicleRows } = await adminSb
          .from("garage_vehicles")
          .select("id")
          .eq("user_id", userId)
          .eq("vin", input.vin)
          .limit(1);
        const vehicleId = vehicleRows?.[0]?.id;
        if (vehicleId) {
          const { data: recallRows } = await adminSb
            .from("vehicle_recalls")
            .select("recall_id, title, component, routine_impact_score, is_safety_critical, ai_summary")
            .eq("vehicle_id", vehicleId)
            .eq("status", "active")
            .order("routine_impact_score", { ascending: false })
            .limit(5);
          recalls = recallRows ?? [];
        }
      }
    } catch {
      // Non-critical — don't fail the receipt if recall lookup errors
    }
  }

  // Enqueue async AI upgrade as a Netlify Background Function (15-min timeout, no sync window pressure)
  const upgradePayload = {
    receipt_id: liteReceipt.receipt_id,
    receipt_token: receiptToken as string,
    input,
    rule_signals: ruleSignals,
    rule_scoring: ruleScoring,
    rule_classification: ruleClassification,
    features,
    client_ip: clientIP,
    ip_hash: ipHash,
    is_pro: isPro,
    t0,
  };

  // Enqueue AI upgrade via Netlify Background Function in production,
  // or inline via after() in local dev. Skip for internal testers (no DB row saved).
  const upgradeSecret = process.env.UPGRADE_SECRET;
  if (!tokenIsInternal && process.env.NODE_ENV === "production" && upgradeSecret) {
    // Derive base URL from the incoming request — avoids env-var misconfiguration
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost";
    const baseUrl = `${proto}://${host}`;
    // Enqueue Netlify Background Function (15 min timeout)
    const bgUrl = `${baseUrl}/.netlify/functions/upgrade-receipt-background`;
    console.log("[Receipt] Enqueuing BG upgrade →", bgUrl, "receipt_id:", liteReceipt.receipt_id);
    try {
      const bgRes = await fetch(bgUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-upgrade-secret": upgradeSecret,
        },
        body: JSON.stringify(upgradePayload),
        signal: AbortSignal.timeout(5000),
      });
      console.log("[Receipt] BG upgrade enqueued, HTTP status:", bgRes.status);
    } catch (err) {
      console.error("[Receipt] BG upgrade enqueue failed:", err instanceof Error ? err.message : err);
      // Non-fatal: lite receipt already saved — upgrade just won't run
    }
  } else if (!tokenIsInternal) {
    // Dev: run upgrade inline after response flushes
    after(async () => {
      try {
        await runReceiptUpgrade(upgradePayload);
      } catch (err) {
        console.error("[Receipt] Upgrade failed:", err instanceof Error ? err.message : err);
        if (isSupabaseConfigured()) {
          await supabase.from("receipts")
            .update({ generation_status: "failed" })
            .eq("id", liteReceipt.receipt_id);
        }
      }
    });
  }

  if (trace) {
    finalizeTrace(trace, {
      verdict: ruleScoring.verdict,
      fit_score: ruleScoring.fit_score,
      signal_count: ruleSignals.length,
      generation_status: "lite",
    });
    persistTrace(trace);
  }

  return NextResponse.json({
    ...litePayload,
    recalls,
    has_active_recalls: recalls.length > 0,
  });
}

function buildRoutineSummary(fit: RoutineFitScore, mvr: MinimumViableRoutine): string {
  const chargeLabel =
    mvr.charging_access === "home" ? "home charging" :
    mvr.charging_access === "work" ? "workplace charging" : "public charging";
  const climateNote = mvr.climate === "winter" ? " Cold climate may reduce range." : "";
  return `${fit.label} for your routine (${chargeLabel}, ${mvr.climate} climate).${climateNote}`;
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
