/**
 * Auction Evaluation Orchestrator
 *
 * Single entry point for evaluating any auction lot regardless of source.
 *
 * Responsibilities:
 * 1. Route to the correct source adapter
 * 2. Check 24h persistence cache
 * 3. Enrich via Auto.dev (ARV + specs)
 * 4. Fetch NHTSA recalls
 * 5. Deterministic scoring (computeSalvageRisk)
 * 6. AI repair cost via hedgedGenerate (reuses copart-arbitrage-engine prompts)
 * 7. Optional routine fit (computeRoutineFitV2)
 * 8. Persist to auction_lots + auction_eval_reports
 * 9. Garage upsert if user authenticated
 */

import { getSupabaseAdmin } from "@/lib/api-auth";
import { enrichFromAutodev } from "@/lib/auto-dev-client";
import { computeSalvageRisk } from "@/lib/salvage-risk-scorer";
import {
  inferDamageType,
  buildRepairCostUserPrompt,
  REPAIR_COST_JSON_SCHEMA,
  REPAIR_COST_SYSTEM_PROMPT,
  AUCTION_FEES_ESTIMATE,
  computeMaxSafeBid,
  type RepairCostOutput,
  type ArbitrageResult,
} from "@/lib/copart-arbitrage-engine";
import { hedgedGenerate } from "@/lib/providers/hedged-generate";
import { checkPurchaseStatus } from "@/lib/payment-status";
import { copartAdapter } from "./adapters/copart-adapter";
import { iaaiAdapter } from "./adapters/iaai-adapter";
import {
  type AuctionEvalInput,
  type AuctionEvalReport,
  type AuctionSource,
  type AuctionSourceAdapter,
  type NhtsaRecallSummary,
  AuctionSourceNotSupportedError,
} from "./types";

// ── Adapter registry ──────────────────────────────────────────────────────────

const ADAPTERS: Record<AuctionSource, AuctionSourceAdapter> = {
  copart: copartAdapter,
  iaai: iaaiAdapter,
  manheim: iaaiAdapter, // Phase 3: replace with manheimAdapter
};

// ── NHTSA recall fetch (reuses the same caching logic as /api/recalls/nhtsa) ──

async function fetchRecalls(
  make: string | null,
  model: string | null,
  year: number | null
): Promise<NhtsaRecallSummary[]> {
  if (!make || !model || !year) return [];

  try {
    const url = new URL(
      `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`
    );
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: NhtsaRecallSummary[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

// ── Repair cost AI call ───────────────────────────────────────────────────────

const isRepairCostOutput = (v: unknown): v is RepairCostOutput => {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.repair_cost_total_low === "number" &&
    typeof d.repair_cost_total_high === "number" &&
    Array.isArray(d.breakdown)
  );
};

async function runRepairCostAI(params: {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  damageType: string;
  askingPrice: number | null;
  listingText: string;
}): Promise<RepairCostOutput | null> {
  try {
    const result = await hedgedGenerate({
      systemPrompt: REPAIR_COST_SYSTEM_PROMPT,
      userPrompt: buildRepairCostUserPrompt(params),
      jsonSchema: REPAIR_COST_JSON_SCHEMA,
      schemaName: "repair_cost_output",
      temperature: 0.2,
      maxTokens: 1500,
      validate: (json) => {
        if (isRepairCostOutput(json)) return { valid: true, errors: [] };
        return { valid: false, errors: ["Invalid repair cost output shape"] };
      },
    });
    return isRepairCostOutput(result.result.json) ? result.result.json : null;
  } catch {
    return null;
  }
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
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    // 3. Upsert normalized lot snapshot
    let auctionLotId: string | null = null;
    if (supabase) {
      const { data: lotRow } = await supabase
        .from("auction_lots")
        .upsert(
          {
            auction_source: lot.auction_source,
            lot_number: lot.lot_number,
            vin: lot.vin,
            normalized_data: lot,
            provider_name: lot.provider_name,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "auction_source,lot_number" }
        )
        .select("id")
        .single();
      auctionLotId = lotRow?.id ?? null;
    }

    // 4. Parallel: Auto.dev enrichment + NHTSA recalls
    const [enrichResult, recalls] = await Promise.all([
      enrichFromAutodev({
        vin: lot.vin ?? undefined,
        make: lot.make ?? undefined,
        model: lot.model ?? undefined,
        year: lot.year ?? undefined,
      }).catch(() => null),
      fetchRecalls(lot.make, lot.model, lot.year),
    ]);

    // 5. Deterministic salvage risk score
    const salvageRisk = computeSalvageRisk({
      title_status: lot.title_status,
      mileage: lot.odometer,
      price: lot.current_bid,
      listing_text: lot.condition_notes ?? "",
      receipt: { active_recalls: recalls.length },
    });

    // 6. Check payment status for paid arbitrage
    const paymentStatus = await checkPurchaseStatus(
      "copart",
      lot.lot_number,
      input.receipt_token
    ).catch(() => null);
    const isPaid = paymentStatus?.unlocked_base ?? false;

    // 7. ARV from Auto.dev
    let arv: number | null = null;
    let arvRange: { low: number; high: number } | null = null;
    let arvSource: ArbitrageResult["arv_source"] = "none";
    let arvListingCount = 0;

    if (enrichResult?.market_price_range && enrichResult.market_price_range.count > 0) {
      arvRange = {
        low: enrichResult.market_price_range.low,
        high: enrichResult.market_price_range.high,
      };
      arv = Math.round(
        (enrichResult.market_price_range.low + enrichResult.market_price_range.high) / 2
      );
      arvSource = "auto_dev_listings";
      arvListingCount = enrichResult.market_price_range.count;
    } else if (enrichResult?.vin_data?.price?.usedTmvRetail) {
      arv = enrichResult.vin_data.price.usedTmvRetail;
      arvSource = "vin_msrp";
    }

    // 8. AI repair cost (only compute if paid or if we want free risk signal)
    let arbitrage: ArbitrageResult | null = null;

    if (isPaid) {
      const damageType =
        lot.damage_type ??
        inferDamageType([lot.primary_damage, lot.secondary_damage, lot.condition_notes]
          .filter(Boolean)
          .join(" "));

      const repairOutput = await runRepairCostAI({
        year: lot.year,
        make: lot.make,
        model: lot.model,
        trim: lot.trim,
        damageType,
        askingPrice: lot.current_bid,
        listingText: lot.condition_notes ?? "",
      });

      const repairCostLow = repairOutput?.repair_cost_total_low ?? 0;
      const repairCostHigh = repairOutput?.repair_cost_total_high ?? 0;
      const repairCostMidpoint = Math.round((repairCostLow + repairCostHigh) / 2);

      const maxSafeBid =
        arv !== null && repairCostMidpoint > 0
          ? computeMaxSafeBid(arv, repairCostMidpoint, AUCTION_FEES_ESTIMATE, 20)
          : null;

      arbitrage = {
        arv,
        arv_range: arvRange,
        arv_source: arvSource,
        arv_listing_count: arvListingCount,
        repair_cost_estimate: repairCostMidpoint,
        repair_cost_low: repairCostLow,
        repair_cost_high: repairCostHigh,
        repair_cost_breakdown: repairOutput?.breakdown ?? [],
        parts_value: repairOutput?.parts_value_total ?? 0,
        parts_value_breakdown: repairOutput?.parts_value_breakdown ?? [],
        max_safe_bid: maxSafeBid,
        auction_fees_estimate: AUCTION_FEES_ESTIMATE,
        confidence: repairOutput?.confidence ?? "low",
        caveats: repairOutput?.caveats ?? [
          "Repair cost estimate unavailable — manual inspection strongly recommended.",
        ],
        damage_type_inferred: damageType,
      };
    }

    // 9. Optional routine fit
    let routineFit = null;
    if (input.routine_profile) {
      try {
        const { computeRoutineFitV2 } = await import("@/lib/compute-routine-fit-v2");
        routineFit = computeRoutineFitV2({ routine: input.routine_profile });
      } catch {
        // Non-critical — routine fit is optional
      }
    }

    // 10. Persist report
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let reportId = `eval_${lot.auction_source}_${lot.lot_number}_${Date.now()}`;

    if (supabase && auctionLotId) {
      const { data: reportRow } = await supabase
        .from("auction_eval_reports")
        .insert({
          auction_lot_id: auctionLotId,
          user_id: input.user_id ?? null,
          receipt_token: input.receipt_token,
          salvage_risk: salvageRisk,
          arbitrage: arbitrage,
          routine_fit: routineFit,
          recalls: recalls,
          is_paid: isPaid,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select("id")
        .single();
      if (reportRow?.id) reportId = reportRow.id;
    }

    // 11. Garage upsert for authenticated users
    if (supabase && input.user_id && lot.make && lot.model) {
      try {
        await supabase.from("garage_vehicles").upsert(
          {
            user_id: input.user_id,
            vin: lot.vin,
            make: lot.make,
            model: lot.model,
            year: lot.year,
            trim: lot.trim,
            auction_eval_report_id: reportId,
          },
          { onConflict: "user_id,vin", ignoreDuplicates: false }
        );
      } catch {
        // Non-critical — garage upsert failures don't fail the evaluation
      }
    }

    return {
      report_id: reportId,
      lot,
      salvage_risk: salvageRisk,
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
      const { data: lotRow } = await supabase
        .from("auction_lots")
        .select("id")
        .eq("auction_source", source)
        .eq("lot_number", lotNumber)
        .maybeSingle();

      if (!lotRow?.id) return null;

      const { data: reportRow } = await supabase
        .from("auction_eval_reports")
        .select("id, salvage_risk, arbitrage, routine_fit, recalls, created_at, expires_at")
        .eq("auction_lot_id", lotRow.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!reportRow) return null;

      // Re-fetch normalized lot data
      const { data: lotData } = await supabase
        .from("auction_lots")
        .select("normalized_data")
        .eq("id", lotRow.id)
        .single();

      if (!lotData?.normalized_data) return null;

      return {
        report_id: reportRow.id,
        lot: lotData.normalized_data as import("./types").NormalizedAuctionLot,
        salvage_risk: reportRow.salvage_risk,
        arbitrage: reportRow.arbitrage,
        recalls: reportRow.recalls ?? [],
        routine_fit: reportRow.routine_fit,
        created_at: reportRow.created_at,
        expires_at: reportRow.expires_at,
      };
    } catch {
      return null;
    }
  }
}

export const auctionEvaluationService = new AuctionEvaluationService();
