/**
 * Auction Evaluation Orchestrator
 *
 * Single entry point for evaluating any auction lot regardless of source.
 *
 * Responsibilities:
 * 1. Route to the correct source adapter
 * 2. Check 24h persistence cache (auction_analyses table)
 * 3. Enrich via Auto.dev (ARV + specs)
 * 4. Fetch NHTSA recalls
 * 5. Deterministic pre-pass (computeDeterministicMetrics)
 * 6. AI chain (runAuctionAiChain): Grok classify → Gemini+GPT-4o ∥ → Grok polish
 * 7. Log AI runs to auction_ai_runs
 * 8. Persist to auction_analyses
 * 9. Garage upsert if user authenticated
 */

import { getSupabaseAdmin } from "@/lib/api-auth";
import { enrichFromAutodev } from "@/lib/auto-dev-client";
import { checkPurchaseStatus } from "@/lib/payment-status";
import { copartAdapter } from "./adapters/copart-adapter";
import { iaaiAdapter } from "./adapters/iaai-adapter";
import { computeDeterministicMetrics } from "./deterministic-metrics";
import { runAuctionAiChain } from "./auction-ai-chain";
import {
  type AuctionEvalInput,
  type AuctionEvalReport,
  type AuctionSource,
  type AuctionSourceAdapter,
  type NhtsaRecallSummary,
  type NormalizedAuctionLot,
} from "./types";
import type { AiStepLog } from "./auction-ai-chain";

// ── Adapter registry ──────────────────────────────────────────────────────────

const ADAPTERS: Record<AuctionSource, AuctionSourceAdapter> = {
  copart: copartAdapter,
  iaai: iaaiAdapter,
  manheim: iaaiAdapter, // Phase 3: replace with manheimAdapter
};

// ── NHTSA recall fetch ────────────────────────────────────────────────────────

async function fetchRecalls(
  make: string | null,
  model: string | null,
  year: number | null
): Promise<NhtsaRecallSummary[]> {
  if (!make || !model || !year) return [];

  try {
    const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as { results?: NhtsaRecallSummary[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

// ── result_id generator ───────────────────────────────────────────────────────

function makeResultId(source: AuctionSource, lotNumber: string): string {
  const ts = Date.now().toString(36);
  return `auc_${source}_${lotNumber}_${ts}`;
}

// ── Input hash for cache deduplication ───────────────────────────────────────

function makeInputHash(lot: NormalizedAuctionLot, routineProfileId?: string): string {
  const key = `${lot.auction_source}:${lot.lot_number}:${routineProfileId ?? "none"}`;
  // Cheap deterministic fingerprint — not a security hash
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

// ── Main service ──────────────────────────────────────────────────────────────

export class AuctionEvaluationService {
  async evaluate(input: AuctionEvalInput): Promise<AuctionEvalReport> {
    const adapter = ADAPTERS[input.auction_source];
    const supabase = getSupabaseAdmin();

    // 1. Fetch normalized lot from source adapter
    const lot = input.url
      ? await adapter.fetchByUrl(input.url)
      : input.lot_number
      ? await adapter.fetchByLot(input.lot_number)
      : (() => { throw new Error("Either url or lot_number is required"); })();

    // 2. Check persistence cache
    if (supabase) {
      const cached = await this.checkCache(supabase, lot.auction_source, lot.lot_number);
      if (cached) return { ...cached, cached: true };
    }

    // 3. Parallel: Auto.dev enrichment + NHTSA recalls
    const [enrichResult, recalls] = await Promise.all([
      enrichFromAutodev({
        vin: lot.vin ?? undefined,
        make: lot.make ?? undefined,
        model: lot.model ?? undefined,
        year: lot.year ?? undefined,
      }).catch(() => null),
      fetchRecalls(lot.make, lot.model, lot.year),
    ]);

    // 4. Resolve ARV from enrichment
    let arv: number | null = null;
    let arvListingCount = 0;
    let hasVinData = false;

    if (enrichResult?.market_price_range && enrichResult.market_price_range.count > 0) {
      arv = Math.round(
        (enrichResult.market_price_range.low + enrichResult.market_price_range.high) / 2
      );
      arvListingCount = enrichResult.market_price_range.count;
    } else if (enrichResult?.vin_data?.price?.usedTmvRetail) {
      arv = enrichResult.vin_data.price.usedTmvRetail;
    }
    hasVinData = Boolean(enrichResult?.vin_data);

    // 5. Check payment status
    const paymentStatus = await checkPurchaseStatus(
      "copart",
      lot.lot_number,
      input.receipt_token
    ).catch(() => null);
    const isPaid = paymentStatus?.unlocked_base ?? false;

    // 6. Deterministic pre-pass (no AI)
    const metrics = computeDeterministicMetrics(
      lot,
      { arv, arvListingCount, hasVinData },
      recalls
    );

    // 7. Optional routine context
    let routineContext: Record<string, unknown> | null = null;
    if (input.routine_profile) {
      routineContext = input.routine_profile as unknown as Record<string, unknown>;
    }

    // 8. AI chain
    const aiChainOutput = await runAuctionAiChain({
      lot,
      metrics,
      recalls,
      routineContext,
      arv,
      isPaid,
    });

    // 9. Optional routine fit (synchronous, separate from AI chain)
    let routineFit = null;
    if (input.routine_profile) {
      try {
        const { computeRoutineFitV2 } = await import("@/lib/compute-routine-fit-v2");
        routineFit = computeRoutineFitV2({ routine: input.routine_profile });
      } catch {
        // Non-critical
      }
    }

    // 10. Build arbitrage result from AI output (paid only)
    let arbitrage = null;
    if (isPaid && aiChainOutput.repair_cost) {
      const rc = aiChainOutput.repair_cost;
      const { AUCTION_FEES_ESTIMATE, computeMaxSafeBid } = await import("@/lib/copart-arbitrage-engine");
      const maxSafeBid = arv && rc.repair_cost_midpoint > 0
        ? computeMaxSafeBid(arv, rc.repair_cost_midpoint, AUCTION_FEES_ESTIMATE, 20)
        : null;

      arbitrage = {
        arv,
        arv_range: enrichResult?.market_price_range && enrichResult.market_price_range.count > 0
          ? { low: enrichResult.market_price_range.low, high: enrichResult.market_price_range.high }
          : null,
        arv_source: (arvListingCount > 0 ? "auto_dev_listings" : hasVinData ? "vin_msrp" : "none") as "auto_dev_listings" | "vin_msrp" | "none",
        arv_listing_count: arvListingCount,
        repair_cost_estimate: rc.repair_cost_midpoint,
        repair_cost_low: rc.repair_cost_low,
        repair_cost_high: rc.repair_cost_high,
        repair_cost_breakdown: rc.breakdown,
        parts_value: rc.parts_value_total,
        parts_value_breakdown: rc.parts_value_breakdown,
        max_safe_bid: maxSafeBid,
        auction_fees_estimate: (await import("@/lib/copart-arbitrage-engine")).AUCTION_FEES_ESTIMATE,
        confidence: rc.confidence,
        caveats: rc.caveats,
        damage_type_inferred: lot.damage_type ?? "unspecified damage",
      };
    }

    // 11. Persist to auction_analyses + log AI runs
    const resultId = makeResultId(lot.auction_source, lot.lot_number);
    const inputHash = makeInputHash(lot);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let analysisId: string | null = null;

    if (supabase) {
      const { data: row } = await supabase
        .from("auction_analyses")
        .insert({
          result_id: resultId,
          auction_source: lot.auction_source,
          lot_number: lot.lot_number,
          vin: lot.vin,
          input_hash: inputHash,
          raw_data: lot,
          vehicle_data: enrichResult ?? null,
          recall_data: recalls.length > 0 ? recalls : null,
          routine_context: routineContext,
          deterministic_metrics: metrics,
          ai_output: {
            classification: aiChainOutput.classification,
            routine_impact: aiChainOutput.routine_impact,
            repair_cost: aiChainOutput.repair_cost,
            polish: aiChainOutput.polish,
            total_model_calls: aiChainOutput.total_model_calls,
          },
          final_report: {
            salvage_risk: metrics,
            arbitrage,
            routine_fit: routineFit,
            recalls,
            verdict: aiChainOutput.polish,
          },
          receipt_token: input.receipt_token,
          user_id: input.user_id ?? null,
          is_paid: isPaid,
          cache_expires_at: expiresAt.toISOString(),
        })
        .select("id")
        .single();

      analysisId = row?.id ?? null;

      // Log AI step runs
      if (analysisId && aiChainOutput.steps_run.length > 0) {
        await supabase.from("auction_ai_runs").insert(
          aiChainOutput.steps_run.map((step: AiStepLog) => ({
            auction_analysis_id: analysisId,
            step_name: step.step,
            model_name: step.model,
            status: step.status,
            latency_ms: step.latency_ms,
          }))
        );
      }

      // Garage upsert for authenticated users
      if (input.user_id && lot.make && lot.model) {
        try {
          await supabase.from("garage_vehicles").upsert(
            {
              user_id: input.user_id,
              vin: lot.vin,
              make: lot.make,
              model: lot.model,
              year: lot.year,
              trim: lot.trim,
              source: "auction",
              auction_source: lot.auction_source,
              lot_number: lot.lot_number,
              damage_type: lot.damage_type,
              title_status: lot.title_status,
              auction_analysis_id: analysisId,
              auction_result_id: resultId,
            },
            { onConflict: "user_id,vin", ignoreDuplicates: false }
          );
        } catch {
          // Non-critical
        }
      }
    }

    return {
      report_id: resultId,
      lot,
      salvage_risk: {
        score: metrics.salvage_risk_score,
        grade: metrics.salvage_risk_grade,
        factors: metrics.salvage_risk_factors,
        routine_impact_summary: aiChainOutput.routine_impact?.routine_impact ?? "",
        suggested_bid_discount: metrics.suggested_bid_discount,
      },
      arbitrage,
      recalls,
      routine_fit: routineFit,
      cached: false,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  }

  private async checkCache(
    supabase: ReturnType<typeof getSupabaseAdmin>,
    source: AuctionSource,
    lotNumber: string
  ): Promise<Omit<AuctionEvalReport, "cached"> | null> {
    if (!supabase) return null;

    try {
      const { data: row } = await supabase
        .from("auction_analyses")
        .select("result_id, final_report, raw_data, created_at, cache_expires_at")
        .eq("auction_source", source)
        .eq("lot_number", lotNumber)
        .gt("cache_expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row?.final_report || !row.raw_data) return null;

      const report = row.final_report as Record<string, unknown>;

      return {
        report_id: row.result_id,
        lot: row.raw_data as NormalizedAuctionLot,
        salvage_risk: report.salvage_risk as AuctionEvalReport["salvage_risk"],
        arbitrage: (report.arbitrage as AuctionEvalReport["arbitrage"]) ?? null,
        recalls: (report.recalls as NhtsaRecallSummary[]) ?? [],
        routine_fit: (report.routine_fit as AuctionEvalReport["routine_fit"]) ?? null,
        created_at: row.created_at,
        expires_at: row.cache_expires_at,
      };
    } catch {
      return null;
    }
  }
}

export const auctionEvaluationService = new AuctionEvaluationService();
