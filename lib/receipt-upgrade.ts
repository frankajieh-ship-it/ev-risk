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
import { VALID_SIGNAL_IDS } from "@/lib/receipt-rules";
import type { ReceiptGenerateRequest } from "@/types/receipt";
import type { ReceiptScoringResult } from "@/lib/receipt-scoring";
import type { FeatureFlags } from "@/lib/feature-flags";

// --- Hallucination-reduction helpers ---

function deriveVerdictReason(
  verdict: string,
  scoringReasons: Array<{ label: string }>,
  whyNotGreen: Array<{ label: string }>
): string {
  if (verdict === "RED") {
    const top = whyNotGreen[0]?.label ?? scoringReasons.find(r => r.label.toLowerCase().includes("block"))?.label ?? "major risk flags present";
    return `${top}`.slice(0, 180);
  }
  if (verdict === "GREEN") {
    const reason = scoringReasons[0]?.label ?? "Evidence score supports this listing.";
    return `No major risk flags. ${reason}`.slice(0, 180);
  }
  // YELLOW
  const reason = whyNotGreen[0]?.label ?? scoringReasons[0]?.label ?? "Missing evidence or minor concerns noted.";
  return reason.slice(0, 180);
}

function patchContradictoryFlags(
  riskFlags: string[],
  signals: string[],
  titleStatus: string,
  scoringReasons: Array<{ label: string }>
): string[] {
  return riskFlags.map((flag, i) => {
    const fl = flag.toLowerCase();
    if ((fl.includes("title") || fl.includes("salvage")) && titleStatus === "clean" && signals.includes("clean_title_explicit")) {
      return scoringReasons[i]?.label ?? flag;
    }
    if (fl.includes("fast charg") && signals.includes("dcfc_confirmed")) {
      return scoringReasons[i]?.label ?? flag;
    }
    return flag;
  });
}

export interface UpgradePayload {
  receipt_id: string;
  receipt_token: string;
  input: ReceiptGenerateRequest;
  rule_signals: string[];
  rule_scoring: ReceiptScoringResult;
  features: FeatureFlags;
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
    userPrompt: await buildUserPrompt(input),
    jsonSchema: RECEIPT_JSON_SCHEMA as Record<string, unknown>,
    schemaName: "receipt",
    temperature: 0.3,
    maxTokens: 2400,
    hedgeDelays: [5000, 10000],
    timeoutMs: 25_000,
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

  // Schema hard fail — leave receipt as "lite" so user keeps the deterministic result
  if (!validation.sanitized && validation.errors.length > 0 && validation.lintErrors.length === 0) {
    console.log(`[receipt-upgrade] Schema fail for ${receipt_id} — leaving as lite`);
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

  // Pin listing_summary.title_status to the scraper-extracted value when available.
  // The AI reads raw listing_text and can misfire on legal boilerplate (e.g. state
  // lemon law footer text on CarGurus) — the structured field from the scraper is
  // authoritative when it disagrees with the AI.
  const scrapedTitleStatus = input.title_status;
  if (
    scrapedTitleStatus &&
    scrapedTitleStatus !== "unknown" &&
    finalReceipt.listing_summary
  ) {
    const ls = finalReceipt.listing_summary as Record<string, unknown>;
    if (ls.title_status !== scrapedTitleStatus) {
      console.log(
        `[receipt-upgrade] Pinning title_status from AI "${ls.title_status}" → scraper "${scrapedTitleStatus}"`
      );
      ls.title_status = scrapedTitleStatus;
    }
  }

  // Patch listing_signals from listing_summary.title_status so title always maps correctly
  // even if AI forgets to emit the corresponding signal.
  if (finalReceipt.listing_summary) {
    const ts = (finalReceipt.listing_summary as Record<string, unknown>).title_status as string | undefined;
    const sigs = (finalReceipt.listing_signals || []) as string[];
    const hasTitleSignal = sigs.includes("clean_title_explicit") || sigs.includes("title_salvage") || sigs.includes("title_status_unclear");
    if (!hasTitleSignal) {
      if (ts === "clean") sigs.push("clean_title_explicit");
      else if (ts === "salvage" || ts === "rebuilt" || ts === "lemon") sigs.push("title_salvage");
      else sigs.push("title_status_unclear");
      finalReceipt = { ...finalReceipt, listing_signals: sigs } as typeof finalReceipt;
    }
  }

  // Deterministic battery_health_estimated injection — fires whenever year + mileage are present
  // and no actual battery report was provided. The AI rarely emits this signal on its own
  // but the data to compute it always exists for used EV listings.
  if (finalReceipt.listing_summary) {
    const ls = finalReceipt.listing_summary as Record<string, unknown>;
    const sigs2 = (finalReceipt.listing_signals || []) as string[];
    const year = ls.year as number | undefined;
    const mileage = ls.mileage as number | undefined;
    const hasBatteryReport = sigs2.includes("battery_report_recent");
    const hasEstimated = sigs2.includes("battery_health_estimated");
    if (!hasBatteryReport && !hasEstimated && year && mileage && mileage > 0) {
      const vehicleAge = new Date().getFullYear() - year;
      if (vehicleAge >= 1 && mileage <= 150000 && mileage <= vehicleAge * 12000 * 2.5) {
        sigs2.push("battery_health_estimated");
        finalReceipt = { ...finalReceipt, listing_signals: sigs2 } as typeof finalReceipt;
      }
    }
  }

  // Fix 2: Filter invalid signal IDs before scoring so phantom signals don't pollute output
  const rawSignals = (finalReceipt.listing_signals ?? []) as string[];
  const validSignals = rawSignals.filter(id => VALID_SIGNAL_IDS.has(id));
  const droppedSignals = rawSignals.filter(id => !VALID_SIGNAL_IDS.has(id));
  if (droppedSignals.length > 0) {
    console.warn("[receipt-upgrade] Dropped invalid signal IDs:", droppedSignals);
    finalReceipt = { ...finalReceipt, listing_signals: validSignals } as typeof finalReceipt;
  }

  // Deterministic scoring
  const aiVerdict = finalReceipt.verdict;
  if (validSignals.length > 0) {
    try {
      if (features.scoringV2) {
        const v2 = scoreReceiptV2(validSignals);
        const mappedWhyNotGreen = v2.why_not_green.map((f: { signal_id: string; category: string; risk_points: number; ui_label: string }) => ({
          signal_id: f.signal_id,
          category: f.category,
          points: f.risk_points,
          label: f.ui_label,
        }));
        finalReceipt = {
          ...finalReceipt,
          verdict: v2.verdict,
          fit_score: v2.fit_score,
          evidence_score: v2.evidence_score,
          evidence_label: v2.evidence_label,
          scoring_reasons: v2.scoring_reasons,
          why_not_green: mappedWhyNotGreen,
          verify_before_visit: v2.verify_before_visit,
          scoring_version: "v2",
        } as typeof finalReceipt;

        // Fix 1: Sync verdict_reason with deterministic verdict when it changed
        if (aiVerdict !== v2.verdict) {
          finalReceipt = {
            ...finalReceipt,
            verdict_reason: deriveVerdictReason(v2.verdict, v2.scoring_reasons, mappedWhyNotGreen),
          } as typeof finalReceipt;
        }
      } else {
        const v1 = scoreReceipt(validSignals);
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

        // Fix 1: Sync verdict_reason with deterministic verdict when it changed
        if (aiVerdict !== v1.verdict) {
          finalReceipt = {
            ...finalReceipt,
            verdict_reason: deriveVerdictReason(v1.verdict, v1.scoring_reasons, v1.why_not_green),
          } as typeof finalReceipt;
        }
      }
    } catch (e) {
      console.error("[receipt-upgrade] Scoring error:", e);
    }
  }

  // Fix 3: Patch risk_flags that contradict known structured facts
  if (finalReceipt.risk_flags && Array.isArray(finalReceipt.risk_flags) && finalReceipt.listing_summary) {
    const titleStatus = (finalReceipt.listing_summary as Record<string, unknown>).title_status as string ?? "unknown";
    const scoringReasons = ((finalReceipt.scoring_reasons ?? []) as Array<{ label: string }>);
    finalReceipt = {
      ...finalReceipt,
      risk_flags: patchContradictoryFlags(
        finalReceipt.risk_flags as string[],
        validSignals,
        titleStatus,
        scoringReasons
      ) as [string, string, string],
    } as typeof finalReceipt;
  }

  // Fix 4: Clamp price_sanity confidence when no market data was available
  if (finalReceipt.price_sanity) {
    const ps = finalReceipt.price_sanity as Record<string, unknown>;
    if (ps.basis === "LISTING_ONLY" || ps.basis === "UNKNOWN") {
      finalReceipt = {
        ...finalReceipt,
        price_sanity: { ...ps, confidence: Math.min((ps.confidence as number) ?? 0.5, 0.4) },
      } as typeof finalReceipt;
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

  // Upsert into knowledge base for social content generation
  const fr = finalReceipt as Record<string, unknown>;
  const ls = (fr.listing_summary as Record<string, unknown>) || {};
  const fitScore = typeof fr.fit_score === "number" ? fr.fit_score : null;
  const verdict = fr.verdict as string | null;
  const make = ls.make as string | null;
  const model = ls.model as string | null;
  const year = ls.year as number | null;
  const price = ls.price as number | null;
  const mileage = ls.mileage as number | null;
  const evidenceScore = typeof fr.evidence_score === "number" ? fr.evidence_score : 0;
  const vehicleLabel = [year, make, model].filter(Boolean).join(" ") || "EV";
  const priceSanity = (fr.price_sanity as Record<string, unknown>) || {};
  const priceLabel = priceSanity.label as string | null;
  const kbSummary = [
    `${vehicleLabel}: ${verdict} verdict, fit score ${fitScore}`,
    price ? `$${price.toLocaleString()}` : null,
    mileage ? `${mileage.toLocaleString()} mi` : null,
    priceLabel ? `price ${priceLabel}` : null,
  ].filter(Boolean).join(", ");
  const postWorthy = verdict === "GREEN" || verdict === "RED"
    ? (fitScore ?? 0) >= 65 && evidenceScore >= 40
    : false;

  supabase.from("offo_knowledge_base").upsert({
    source: "receipt",
    source_id: receipt_id,
    make,
    model,
    year,
    verdict,
    score: fitScore,
    summary: kbSummary,
    tags: [],
    url: input.listing_url || null,
    post_worthy: postWorthy,
  }, { onConflict: "source,source_id" }).then(() => {}, () => {});

  console.log(`[receipt-upgrade] ✓ ${receipt_id} upgraded via ${usedProvider} in ${Date.now() - t0}ms, verdict=${aiVerdict}`);
}
