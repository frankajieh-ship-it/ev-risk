/**
 * Shared receipt upgrade logic — called directly in dev, via background function in prod.
 *
 * Runs the full AI generation pipeline and updates the receipt row to generation_status="full".
 */

import { getSupabaseAdmin } from "@/lib/api-auth";
import { hedgedGenerate } from "@/lib/providers";
import { SYSTEM_PROMPT, buildUserPrompt, RECEIPT_JSON_SCHEMA, fixReceiptFormatting } from "@/lib/receipt-openai";
import { validateReceiptSchema } from "@/lib/receipt-schema-validator";
import { scoreReceipt } from "@/lib/receipt-scoring";
import { scoreReceiptV2 } from "@/lib/receipt-scoring-v2";
import { applyRenderer } from "@/lib/receipt-renderer";
import { detectListingSource } from "@/lib/listing-scraper";
import type { ReceiptGenerateRequest } from "@/types/receipt";
import type { ReceiptScoringResult } from "@/lib/receipt-scoring";

export interface UpgradePayload {
  receipt_id: string;
  receipt_token: string;
  input: ReceiptGenerateRequest;
  rule_signals: string[];
  rule_scoring: ReceiptScoringResult;
  features: Record<string, boolean>;
  client_ip: string;
  ip_hash: string | null;
  is_pro: boolean;
  t0: number;
}

export async function runReceiptUpgrade(payload: UpgradePayload): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Database not configured");

  const { receipt_id, receipt_token, input, features, ip_hash, t0 } = payload;

  // Mark as generating
  await supabase.from("receipts")
    .update({ generation_status: "generating" })
    .eq("id", receipt_id);

  const hedgeResult = await hedgedGenerate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(input),
    jsonSchema: RECEIPT_JSON_SCHEMA as Record<string, unknown>,
    schemaName: "receipt",
    temperature: 0.3,
    maxTokens: 1800,
    validate: (json) => {
      const v = validateReceiptSchema(json);
      return { valid: v.valid, errors: v.errors };
    },
  });

  const usedProvider = hedgeResult.result.provider;
  const coreLatencyMs = hedgeResult.result.latencyMs;

  const validation = validateReceiptSchema(hedgeResult.result.json);
  let lintPassed = validation.valid;
  let lintErrors = validation.lintErrors;
  let finalReceipt = validation.sanitized || hedgeResult.result.json;

  // Schema hard fail
  if (!validation.sanitized && validation.errors.length > 0 && validation.lintErrors.length === 0) {
    await supabase.from("receipts").update({ generation_status: "failed" }).eq("id", receipt_id);
    console.log(`[receipt-upgrade] Schema fail for ${receipt_id}`);
    return;
  }

  // Lint repair
  if (!lintPassed && lintErrors.length > 0) {
    try {
      const patched = await fixReceiptFormatting(
        finalReceipt as unknown as Record<string, unknown>,
        lintErrors
      );
      if (patched) {
        const revalidation = validateReceiptSchema(patched);
        if (revalidation.valid || revalidation.lintErrors.length < lintErrors.length) {
          finalReceipt = (revalidation.sanitized || patched) as typeof finalReceipt;
          lintPassed = revalidation.valid;
          lintErrors = revalidation.lintErrors;
        }
      }
    } catch { /* keep going */ }
  }

  // Deterministic scoring
  const aiVerdict = finalReceipt.verdict;
  if (finalReceipt.listing_signals && Array.isArray(finalReceipt.listing_signals) && finalReceipt.listing_signals.length > 0) {
    try {
      if (features.scoringV2) {
        const v2 = scoreReceiptV2(finalReceipt.listing_signals as string[]);
        finalReceipt = {
          ...finalReceipt,
          verdict: v2.verdict,
          fit_score: v2.fit_score,
          evidence_score: v2.evidence_score,
          evidence_label: v2.evidence_label,
          scoring_reasons: v2.scoring_reasons,
          why_not_green: v2.why_not_green.map((f: { signal_id: string; category: string; risk_points: number; ui_label: string }) => ({
            signal_id: f.signal_id,
            category: f.category,
            points: f.risk_points,
            label: f.ui_label,
          })),
          verify_before_visit: v2.verify_before_visit,
          scoring_version: "v2",
        } as typeof finalReceipt;
      } else {
        const v1 = scoreReceipt(finalReceipt.listing_signals as string[]);
        finalReceipt = {
          ...finalReceipt,
          verdict: v1.verdict,
          fit_score: v1.fit_score,
          evidence_score: v1.evidence_score,
          evidence_label: v1.evidence_label,
          scoring_reasons: v1.scoring_reasons,
          why_not_green: v1.why_not_green,
          verify_before_visit: v1.verify_before_visit,
        };
      }
    } catch (e) {
      console.error("[receipt-upgrade] Scoring error:", e);
    }
  }

  finalReceipt = { ...finalReceipt, receipt_id } as typeof finalReceipt;
  finalReceipt = applyRenderer(finalReceipt as import("@/types/receipt").ListingReceipt) as typeof finalReceipt;

  const urlDomain = input.listing_url
    ? (() => { try { return new URL(input.listing_url!).hostname.replace("www.", ""); } catch { return null; } })()
    : null;

  await supabase.from("receipts").update({
    output_json: finalReceipt,
    generation_status: "full",
    sections: {
      core:             { status: "ready", updated_at: new Date().toISOString(), provider_used: usedProvider, latency_ms: coreLatencyMs },
      reddit_draft:     { status: "not_requested" },
      receipt_details:  { status: "not_requested" },
      negotiation_deep: { status: "not_requested" },
    },
  }).eq("id", receipt_id);

  supabase.from("receipt_events").insert({
    receipt_id,
    session_id: receipt_token,
    event_type: "ai_upgrade_complete",
    url_domain: urlDomain,
    listing_source: urlDomain ? detectListingSource(urlDomain) : "text_paste",
    verdict: (finalReceipt as Record<string, unknown>).verdict as string | null,
    ip_hash: ip_hash || null,
  }).then(() => {}, () => {});

  console.log(`[receipt-upgrade] ✓ ${receipt_id} upgraded via ${usedProvider} in ${Date.now() - t0}ms, verdict=${aiVerdict}`);
}
