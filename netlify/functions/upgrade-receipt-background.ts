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
import { generateReceipt, fixReceiptFormatting } from "../../lib/receipt-openai.js";
import { validateReceiptSchema } from "../../lib/receipt-schema-validator.js";
import { renderRedditDraft } from "../../lib/reddit-draft-renderer.js";
import { scoreReceipt } from "../../lib/receipt-scoring.js";
import { scoreReceiptV2 } from "../../lib/receipt-scoring-v2.js";
import { findSimilarReceipt } from "../../lib/receipt-similarity.js";
import { detectListingSource } from "../../lib/listing-scraper.js";
import { logApi } from "../../lib/api-logger.js";
import type { ReceiptGenerateRequest } from "../../types/receipt.js";

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

  let payload: UpgradePayload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { receipt_id, receipt_token, input, rule_signals, rule_scoring, rule_classification, features, client_ip, ip_hash, t0 } = payload;

  if (!receipt_id || !receipt_token || !input) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const supabase = getSupabase();

  // Mark as generating
  await supabase.from("receipts")
    .update({ generation_status: "generating" })
    .eq("id", receipt_id);

  try {
    // No deadline needed — background functions have 15 minutes
    const { receipt, retried } = await generateReceipt(input);

    // Validate receipt (Zod parse + lint)
    let validation = validateReceiptSchema(receipt);
    let lintPassed = validation.valid;
    let lintErrors = validation.lintErrors;
    let finalReceipt = validation.sanitized || receipt;

    // If Zod parse failed, mark as failed
    if (!validation.sanitized && validation.errors.length > 0 && validation.lintErrors.length === 0) {
      logApi("error", "Schema validation failed in async upgrade", {
        endpoint: "/upgrade-receipt-background",
        anon_id: receipt_token,
        error_code: "schema_fail",
        elapsed_ms: Date.now() - t0,
        retried,
        errors: validation.errors,
      });

      supabase.from("receipt_events").insert({
        session_id: receipt_token,
        event_type: "schema_fail",
      }).then(() => {}, () => {});

      await supabase.from("receipts")
        .update({ generation_status: "failed" })
        .eq("id", receipt_id);

      console.log(`[Upgrade BG] Schema fail for ${receipt_id}, keeping lite receipt`);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // If lint failed, try formatting fixer
    if (!lintPassed && lintErrors.length > 0) {
      console.log(
        `[Upgrade BG] Lint errors after ${retried ? "retry" : "first attempt"}:`,
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

    // Save full receipt to DB + initialize on-demand section statuses
    const { error: updateError } = await supabase.from("receipts").update({
      output_json: finalReceipt,
      generation_status: "full",
      sections: {
        core:             { status: "ready",         updated_at: new Date().toISOString() },
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
      verdict: finalReceipt.verdict,
      price_label: finalReceipt.price_sanity?.label || null,
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

    console.log(`[Upgrade BG] Successfully upgraded ${receipt_id} in ${Date.now() - t0}ms`);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

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
      event_name: "receipt_upgrade_failed",
      event_data: {
        receipt_id,
        receipt_token,
        error_code: isTimeoutOrAIError ? "upgrade_timeout" : "upgrade_fail",
        rule_signal_count: rule_signals.length,
        rule_verdict: rule_scoring.verdict,
        rule_fit_score: rule_scoring.fit_score,
      },
      ip_address: client_ip,
      page_path: "/.netlify/functions/upgrade-receipt-background",
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});

    // Try similarity match on timeout
    if (isTimeoutOrAIError) {
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

          console.log(`[Upgrade BG] Similarity match for ${receipt_id} (confidence=${similarResult.confidence.toFixed(2)})`);
          return { statusCode: 200, body: JSON.stringify({ ok: true }) };
        }
      } catch {
        // Similarity search failed — fall through
      }
    }

    // Mark as failed — lite receipt stays
    await supabase.from("receipts")
      .update({ generation_status: "failed" })
      .eq("id", receipt_id);

    console.log(`[Upgrade BG] Failed for ${receipt_id}, keeping lite receipt`);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
};

export { handler };
