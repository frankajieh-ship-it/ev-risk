/**
 * Netlify Background Function: Receipt AI Upgrade
 *
 * POST /.netlify/functions/upgrade-receipt-background
 *
 * Runs asynchronously for up to 15 minutes, fully outside the 60s
 * synchronous function window. The main receipt route enqueues this
 * immediately after saving the lite receipt and returning to the client.
 *
 * Security: validated via X-Upgrade-Secret header (UPGRADE_SECRET env var).
 *
 * Input body: UpgradePayload (see type below)
 * Returns: 202 Accepted immediately (background functions don't wait)
 */

import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { fixReceiptFormatting, RECEIPT_JSON_SCHEMA, SYSTEM_PROMPT, buildUserPrompt, buildEnhancedFallbackReceipt } from "../../lib/receipt-openai.js";
import { validateReceiptSchema } from "../../lib/receipt-schema-validator.js";
import { renderRedditDraft } from "../../lib/reddit-draft-renderer.js";
import { scoreReceipt } from "../../lib/receipt-scoring.js";
import { scoreReceiptV2 } from "../../lib/receipt-scoring-v2.js";
import { findSimilarReceipt } from "../../lib/receipt-similarity.js";
import { detectListingSource } from "../../lib/listing-scraper.js";
import { logApi } from "../../lib/api-logger.js";
import { hedgedGenerate, AllProvidersFailedError, logReceiptCost } from "../../lib/providers/index.js";
import { applyRenderer } from "../../lib/receipt-renderer.js";
import type { ReceiptGenerateRequest } from "../../types/receipt.js";
import type { ListingSignalId } from "../../lib/receipt-rules.js";

// --- Supabase client (service role) ---

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// --- Payload type ---

interface UpgradePayload {
  receipt_id: string;
  receipt_token: string;
  input: ReceiptGenerateRequest;
  rule_signals: string[];
  rule_scoring: { verdict: string; fit_score: number; [key: string]: unknown };
  rule_classification: { category: string; [key: string]: unknown };
  features: Record<string, boolean>;
  client_ip: string;
  ip_hash: string | null;
  is_pro: boolean;
  t0: number;
  /** Durable job queue ID — present when enqueued via receipt route or webhook */
  job_id?: string | null;
  /** Retry attempt number (0 = first attempt) — passed by scan-stuck-upgrades */
  attempt_count?: number;
}

// --- Deterministic fallback ---

async function saveDeterministicFallback(
  supabase: ReturnType<typeof getSupabase>,
  receipt_id: string,
  receipt_token: string,
  input: ReceiptGenerateRequest,
  rule_signals: string[],
  rule_scoring: { verdict: string; fit_score: number; [key: string]: unknown },
  features: Record<string, boolean>,
): Promise<void> {
  // buildEnhancedFallbackReceipt requires ReceiptScoringResult (V1 shape)
  const v1Scoring = scoreReceipt(rule_signals);

  // Build a complete receipt from rule signals alone — no AI required
  let fallbackReceipt = buildEnhancedFallbackReceipt(
    input,
    rule_signals as ListingSignalId[],
    v1Scoring,
  ) as ReturnType<typeof buildEnhancedFallbackReceipt> & { receipt_id: string; scoring_version?: string };

  // Overlay V2 scoring fields if the feature flag is on
  if (features.scoringV2) {
    const v2 = scoreReceiptV2(rule_signals);
    fallbackReceipt = {
      ...fallbackReceipt,
      verdict: v2.verdict,
      fit_score: v2.fit_score,
      evidence_score: v2.evidence_score,
      evidence_label: v2.evidence_label,
      scoring_reasons: v2.scoring_reasons,
      why_not_green: v2.why_not_green.map((f) => ({
        signal_id: f.signal_id,
        category: f.category,
        points: f.risk_points,
        label: f.ui_label,
      })),
      verify_before_visit: v2.verify_before_visit,
      scoring_version: "deterministic-v2",
    } as typeof fallbackReceipt;
  } else {
    fallbackReceipt = { ...fallbackReceipt, scoring_version: "deterministic" };
  }

  fallbackReceipt = { ...fallbackReceipt, receipt_id };

  // Apply deterministic renderer for OFFO voice consistency
  const rendered = applyRenderer(fallbackReceipt as import("../../types/receipt.js").ListingReceipt);

  await supabase.from("receipts").update({
    output_json: rendered,
    generation_status: "full",
    sections: {
      core:             { status: "ready", updated_at: new Date().toISOString(), provider_used: "deterministic", latency_ms: 0 },
      reddit_draft:     { status: "not_requested" },
      receipt_details:  { status: "not_requested" },
      negotiation_deep: { status: "not_requested" },
    },
  }).eq("id", receipt_id);

  supabase.from("receipt_events").insert({
    receipt_id,
    session_id: receipt_token,
    event_type: "deterministic_fallback",
    verdict: (rendered as Record<string, unknown>).verdict as string | null ?? rule_scoring.verdict,
  }).then(() => {}, () => {});
}

// --- Handler ---

const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Validate shared secret
  const secret = event.headers["x-upgrade-secret"];
  const expectedSecret = process.env.UPGRADE_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Validate required env vars before doing any work — fail fast with a clear error
  const missingEnvVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((k) => !process.env[k]);

  if (missingEnvVars.length > 0) {
    console.error(`[Upgrade BG] Missing required env vars: ${missingEnvVars.join(", ")}`);
    return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error", missing: missingEnvVars }) };
  }

  const hasAnyAiProvider = !!(
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GROK_API_KEY
  );
  if (!hasAnyAiProvider) {
    console.error("[Upgrade BG] No AI provider API keys configured");
    return { statusCode: 500, body: JSON.stringify({ error: "No AI providers configured" }) };
  }

  let payload: UpgradePayload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { receipt_id, receipt_token, input, rule_signals, rule_scoring, features, client_ip, ip_hash, t0, job_id = null } = payload;

  if (!receipt_id || !receipt_token || !input) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch (initErr) {
    console.error("[Upgrade BG] Supabase init failed:", initErr instanceof Error ? initErr.message : initErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Database init failed" }) };
  }

  // Mark as generating — if this fails, we return a non-2xx so route.ts marks as failed
  const { error: markErr } = await supabase.from("receipts")
    .update({ generation_status: "generating" })
    .eq("id", receipt_id);

  if (markErr) {
    console.error("[Upgrade BG] Failed to mark generating:", markErr.message);
    return { statusCode: 500, body: JSON.stringify({ error: "DB update failed" }) };
  }

  // Update job record to "processing" so the retry scanner skips it while we're running
  if (job_id) {
    supabase.from("receipt_upgrade_jobs").update({
      status: "processing",
      attempt_count: (payload.attempt_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("job_id", job_id).then(() => {}, () => {});
  }

  // Track all provider results for cost logging
  const allProviderResults: import("../../lib/providers/types.js").GenerateResult[] = [];

  // Emit ai_job_queued before generation starts
  supabase.from("user_events").insert({
    event_name: "ai_job_queued",
    source: "ai",
    event_data: { job_type: "receipt_upgrade", receipt_id, provider: "hedged", anon_id: receipt_token },
    page_path: "/.netlify/functions/upgrade-receipt-background",
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {});

  const aiJobStartMs = Date.now();

  try {
    // Hedged generation: OpenAI starts immediately, Anthropic at T+4s, Grok at T+8s
    const hedgeResult = await hedgedGenerate({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
      jsonSchema: RECEIPT_JSON_SCHEMA as Record<string, unknown>,
      schemaName: "receipt",
      temperature: 0.3,
      maxTokens: 1400,
      hedgeDelays: [4000, 9000],
      timeoutMs: 30000,
      validate: (json) => {
        // Only reject on Zod schema failures — lint errors are cosmetic and
        // handled post-win by the formatter. Rejecting on lint causes all three
        // providers to be marked failed when the receipt is structurally valid.
        const v = validateReceiptSchema(json);
        const zodFailed = !v.sanitized && v.errors.length > 0;
        return { valid: !zodFailed, errors: v.errors };
      },
      onEvent: (event) => {
        if (event.type === "hedge_triggered") {
          supabase.from("receipt_events").insert({
            receipt_id,
            session_id: receipt_token,
            event_type: "hedge_triggered",
            provider_used: event.provider,
            hedge_level: event.hedgeLevel,
          }).then(() => {}, () => {});
        }
      },
    });

    allProviderResults.push(hedgeResult.result);
    const usedProvider = hedgeResult.result.provider;
    const coreLatencyMs = hedgeResult.result.latencyMs;

    // Log which provider was used
    supabase.from("receipt_events").insert({
      receipt_id,
      session_id: receipt_token,
      event_type: "section_generate_succeeded",
      provider_used: usedProvider,
      hedge_level: hedgeResult.hedgeLevel,
      latency_ms: coreLatencyMs,
      attempts: hedgeResult.allAttempts,
    }).then(() => {}, () => {});

    console.log(`[Upgrade BG] Core generated via ${usedProvider} (hedge=${hedgeResult.hedgeLevel}, ${coreLatencyMs}ms)`);

    // Validate receipt (Zod parse + lint)
    let validation = validateReceiptSchema(hedgeResult.result.json);
    let lintPassed = validation.valid;
    let lintErrors = validation.lintErrors;
    let finalReceipt = validation.sanitized || hedgeResult.result.json;

    // If Zod parse failed, fall back to deterministic receipt instead of failing
    if (!validation.sanitized && validation.errors.length > 0 && validation.lintErrors.length === 0) {
      logApi("error", "Schema validation failed in async upgrade — serving deterministic fallback", {
        endpoint: "/upgrade-receipt-background",
        anon_id: receipt_token,
        error_code: "schema_fail",
        elapsed_ms: Date.now() - t0,
        retried: hedgeResult.allAttempts > 1,
        errors: validation.errors,
      });

      supabase.from("receipt_events").insert({
        session_id: receipt_token,
        event_type: "schema_fail",
      }).then(() => {}, () => {});

      await saveDeterministicFallback(supabase, receipt_id, receipt_token, input, rule_signals, rule_scoring, features);
      console.log(`[Upgrade BG] Schema fail for ${receipt_id} — saved deterministic fallback`);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // If lint failed, try formatting fixer
    if (!lintPassed && lintErrors.length > 0) {
      console.log(
        `[Upgrade BG] Lint errors after ${usedProvider} generation:`,
        lintErrors.map((e) => e.code)
      );

      try {
        supabase.from("receipt_events").insert({
          session_id: receipt_token,
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
            console.log("[Upgrade BG] Formatting fixer improved result");

            supabase.from("receipt_events").insert({
              session_id: receipt_token,
              event_type: "schema_repair_succeeded",
            }).then(() => {}, () => {});
          } else {
            supabase.from("receipt_events").insert({
              session_id: receipt_token,
              event_type: "schema_repair_failed",
            }).then(() => {}, () => {});
          }
        }
      } catch {
        logApi("warn", "Formatting fixer error", {
          endpoint: "/upgrade-receipt-background",
          anon_id: receipt_token,
          error_code: "format_fix_fail",
          elapsed_ms: Date.now() - t0,
        });
      }
    }

    // Post-gen rendering: render receipt_reddit_text deterministically from reddit_draft
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

    // Patch listing_signals from listing_summary.title_status
    if (finalReceipt.listing_summary) {
      const ts = (finalReceipt.listing_summary as Record<string, unknown>).title_status as string | undefined;
      const sigs = (finalReceipt.listing_signals || []) as string[];
      const hasTitleSignal = sigs.includes("clean_title_explicit") || sigs.includes("title_salvage") || sigs.includes("title_status_unclear");
      if (!hasTitleSignal) {
        if (ts === "clean") sigs.push("clean_title_explicit");
        else if (ts === "salvage" || ts === "rebuilt") sigs.push("title_salvage");
        else sigs.push("title_status_unclear");
        finalReceipt = { ...finalReceipt, listing_signals: sigs } as typeof finalReceipt;
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
            why_not_green: v2Result.why_not_green.map((f: { signal_id: string; category: string; risk_points: number; ui_label: string }) => ({
              signal_id: f.signal_id,
              category: f.category,
              points: f.risk_points,
              label: f.ui_label,
            })),
            verify_before_visit: v2Result.verify_before_visit,
            scoring_version: "v2",
          } as typeof finalReceipt;
          console.log(`[Upgrade BG] Scoring V2: verdict=${v2Result.verdict} (AI said ${aiVerdict})`);
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
          console.log(`[Upgrade BG] Scoring V1: fit=${scoringResult.fit_score} verdict=${scoringResult.verdict} (AI said ${aiVerdict})`);
        }
      } catch (scoreErr) {
        console.error("[Upgrade BG] Scoring engine error, keeping AI verdict:", scoreErr);
      }
    }

    // Keep receipt_id consistent with the lite receipt
    finalReceipt = { ...finalReceipt, receipt_id } as typeof finalReceipt;

    // Apply deterministic renderer to enforce OFFO voice consistency across providers
    finalReceipt = applyRenderer(finalReceipt as import("../../types/receipt.js").ListingReceipt) as typeof finalReceipt;

    // Save full receipt to DB + initialize on-demand section statuses
    const { error: updateError } = await supabase.from("receipts").update({
      output_json: finalReceipt,
      generation_status: "full",
      sections: {
        core:             { status: "ready", updated_at: new Date().toISOString(), provider_used: usedProvider, latency_ms: coreLatencyMs },
        reddit_draft:     { status: "not_requested" },
        receipt_details:  { status: "not_requested" },
        negotiation_deep: { status: "not_requested" },
      },
    }).eq("id", receipt_id);

    if (updateError) {
      console.error("[Upgrade BG] DB update failed:", updateError.message);
    }

    // Log events
    const urlDomain = input.listing_url
      ? (() => { try { return new URL(input.listing_url!).hostname.replace("www.", ""); } catch { return null; } })()
      : null;

    supabase.from("receipt_events").insert({
      receipt_id,
      session_id: receipt_token,
      event_type: "ai_upgrade_complete",
      url_domain: urlDomain,
      listing_source: urlDomain ? detectListingSource(urlDomain) : "text_paste",
      verdict: (finalReceipt as Record<string, unknown>).verdict as string | null,
      price_label: ((finalReceipt as Record<string, unknown>).price_sanity as Record<string, unknown> | null | undefined)?.label as string | null ?? null,
      ip_hash: ip_hash || null,
    }).then(() => {}, () => {});

    supabase.from("user_events").insert({
      event_name: "receipt_full_ready",
      event_data: {
        receipt_id,
        receipt_token,
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
      ip_address: client_ip,
      page_path: "/.netlify/functions/upgrade-receipt-background",
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});

    if (!lintPassed) {
      supabase.from("receipt_events").insert({
        receipt_id,
        session_id: receipt_token,
        event_type: "lint_fail",
      }).then(() => {}, () => {});
    }

    // Log estimated provider cost (fire-and-forget)
    logReceiptCost(supabase, receipt_id, receipt_token, allProviderResults);

    // Emit ai_job_succeeded
    supabase.from("user_events").insert({
      event_name: "ai_job_succeeded",
      source: "ai",
      event_data: {
        job_type: "receipt_upgrade",
        receipt_id,
        provider: hedgeResult.result.provider,
        latency_ms: Date.now() - aiJobStartMs,
        anon_id: receipt_token,
      },
      page_path: "/.netlify/functions/upgrade-receipt-background",
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});

    // Mark job succeeded
    if (job_id) {
      supabase.from("receipt_upgrade_jobs").update({
        status: "succeeded",
        updated_at: new Date().toISOString(),
      }).eq("job_id", job_id).then(() => {}, () => {});
    }

    console.log(`[Upgrade BG] Successfully upgraded ${receipt_id} in ${Date.now() - t0}ms`);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (error) {
    // AllProvidersFailedError = all hedged providers were exhausted — treat as upgrade_fail
    const isAllProvidersFailed = error instanceof AllProvidersFailedError;
    const isTimeoutOrAIError =
      isAllProvidersFailed ||
      (error instanceof Error &&
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
          error.name === "APIError"));

    logApi("error", "Background receipt upgrade failed", {
      endpoint: "/upgrade-receipt-background",
      anon_id: receipt_token,
      error_code: isTimeoutOrAIError ? "upgrade_timeout" : "upgrade_fail",
      elapsed_ms: Date.now() - t0,
      error_message: error instanceof Error ? error.message : "Unknown",
    });

    supabase.from("receipt_events").insert({
      receipt_id,
      session_id: receipt_token,
      event_type: isTimeoutOrAIError ? "upgrade_timeout" : "upgrade_fail",
    }).then(() => {}, () => {});

    supabase.from("user_events").insert({
      event_name: "ai_job_failed",
      source: "ai",
      event_data: {
        job_type: "receipt_upgrade",
        receipt_id,
        error_code: isTimeoutOrAIError ? "upgrade_timeout" : "upgrade_fail",
        latency_ms: Date.now() - aiJobStartMs,
        anon_id: receipt_token,
      },
      page_path: "/.netlify/functions/upgrade-receipt-background",
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});
    // NOTE: receipt_upgrade_failed is NOT fired here — the deterministic fallback
    // below will save a full receipt so the user never sees a failure. Only fire
    // receipt_upgrade_failed if the fallback itself fails (handled below).

    // Detailed alert event for backend monitoring
    const errorCode = isTimeoutOrAIError ? "upgrade_timeout" : "upgrade_fail";
    const errorMessage = error instanceof Error ? error.message.slice(0, 300) : "Unknown";
    const elapsedMs = Date.now() - t0;

    supabase.from("receipt_events").insert({
      receipt_id,
      session_id: receipt_token,
      event_type: "upgrade_failure_alert",
      metadata: {
        error_code: errorCode,
        error_message: errorMessage,
        elapsed_ms: elapsedMs,
      },
    }).then(() => {}, () => {});

    // Fire webhook alert (e.g. Slack) if configured — real-time notification
    const alertWebhookUrl = process.env.UPGRADE_FAILURE_ALERT_WEBHOOK;
    if (alertWebhookUrl) {
      fetch(alertWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 *Receipt upgrade failed*\n*Receipt:* ${receipt_id}\n*Error:* ${errorCode}\n*Message:* ${errorMessage}\n*Elapsed:* ${elapsedMs}ms`,
        }),
      }).catch(() => {}); // fire-and-forget
    }

    // Update job record: increment attempts, schedule backoff retry, or dead-letter
    if (job_id) {
      const attemptsDone = (payload.attempt_count ?? 0) + 1;
      const isDeadLetter = attemptsDone >= 3;
      const backoffMs = Math.min(60_000 * Math.pow(2, attemptsDone - 1), 600_000); // 1min → 2min → 10min cap
      supabase.from("receipt_upgrade_jobs").update({
        status: isDeadLetter ? "dead_letter" : "failed",
        last_error: errorMessage,
        attempt_count: attemptsDone,
        next_retry_at: isDeadLetter ? null : new Date(Date.now() + backoffMs).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("job_id", job_id).then(() => {}, () => {});

      // Fire dead-letter alert when all retries exhausted
      if (isDeadLetter && alertWebhookUrl) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
        fetch(alertWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `☠️ *Receipt upgrade DEAD-LETTERED* — all ${attemptsDone} attempts exhausted\n*Receipt:* ${receipt_id}\n*Job:* ${job_id}\n*Last error:* ${errorMessage}\n*Admin:* ${siteUrl}/admin`,
          }),
        }).catch(() => {});
      }
    }

    // Try similarity match on timeout
    if (isTimeoutOrAIError) {
      console.warn("[Upgrade BG] All AI providers failed — attempting similarity match", {
        receipt_id,
        has_listing_text: !!input.listing_text,
        listing_text_len: input.listing_text?.length ?? 0,
        input_fields: (["year", "make", "model", "vin", "title_status", "accidents_reported"] as const).filter(
          (k) => !!(input as Record<string, unknown>)[k]
        ),
      });
      try {
        const similarResult = await findSimilarReceipt(input);
        if (similarResult) {
          const similarReceipt = {
            ...similarResult.receipt,
            receipt_id,
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
              // Always use the actual listing's known values over the similar car's
              title_status: input.title_status ?? null,
              accidents_reported: input.accidents_reported ?? null,
              vin: input.vin ?? null,
            },
            verdict_reason: `Based on analysis of a similar ${input.year || ""} ${input.make || ""} ${input.model || "vehicle"}. ${similarResult.confidence >= 0.7 ? "High" : "Medium"} confidence match.`.trim().replace(/\s+/g, " "),
          };

          await supabase.from("receipts").update({
            output_json: similarReceipt,
            generation_status: "full",
          }).eq("id", receipt_id);

          supabase.from("receipt_events").insert({
            receipt_id,
            session_id: receipt_token,
            event_type: "similarity_match",
          }).then(() => {}, () => {});

          if (job_id) {
            supabase.from("receipt_upgrade_jobs").update({
              status: "succeeded",
              updated_at: new Date().toISOString(),
            }).eq("job_id", job_id).then(() => {}, () => {});
          }
          console.log(`[Upgrade BG] Similarity match for ${receipt_id} (confidence=${similarResult.confidence.toFixed(2)})`);
          return { statusCode: 200, body: JSON.stringify({ ok: true }) };
        }
      } catch {
        // Similarity search failed — fall through
      }
    }

    // All AI providers failed and similarity search found no match — use deterministic fallback
    // so the user always receives a complete receipt, never a failure banner
    try {
      await saveDeterministicFallback(supabase, receipt_id, receipt_token, input, rule_signals, rule_scoring, features);
      if (job_id) {
        supabase.from("receipt_upgrade_jobs").update({
          status: "succeeded",
          last_error: "deterministic_fallback_used",
          updated_at: new Date().toISOString(),
        }).eq("job_id", job_id).then(() => {}, () => {});
      }
      console.log(`[Upgrade BG] All providers failed for ${receipt_id} — saved deterministic fallback`);
    } catch (fallbackErr) {
      // Deterministic fallback itself failed (very unlikely) — only NOW mark failed
      // and fire receipt_upgrade_failed so the client shows the error banner
      console.error("[Upgrade BG] Deterministic fallback failed:", fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
      await supabase.from("receipts")
        .update({ generation_status: "failed" })
        .eq("id", receipt_id);

      supabase.from("user_events").insert({
        event_name: "receipt_upgrade_failed",
        event_data: {
          receipt_id,
          receipt_token,
          error_code: "fallback_failed",
          rule_signal_count: rule_signals?.length ?? 0,
          rule_verdict: rule_scoring?.verdict ?? null,
          rule_fit_score: rule_scoring?.fit_score ?? null,
        },
        ip_address: client_ip,
        page_path: "/.netlify/functions/upgrade-receipt-background",
        timestamp: new Date().toISOString(),
      }).then(() => {}, () => {});

      console.log(`[Upgrade BG] Fallback also failed for ${receipt_id}, marking failed`);
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
};

export { handler };
