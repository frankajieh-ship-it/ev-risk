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
import { estimateFallbackArv, estimateArvWithAi } from "@/lib/auction/fallback-arv";
import {
  getChargingProfile,
  getElectricityRate,
  getIncentivesForVehicle,
  loadRangeStackForVehicle,
  findVehicleInMaster,
} from "@/lib/data";
import { copartAdapter } from "./adapters/copart-adapter";
import { iaaiAdapter } from "./adapters/iaai-adapter";
import { computeDeterministicMetrics } from "./deterministic-metrics";
import { runAuctionAiChain } from "./auction-ai-chain";
import { computeAuctionOffoScore } from "./auction-unified-score";
import {
  type AuctionEvalInput,
  type AuctionEvalReport,
  type AuctionSource,
  type AuctionSourceAdapter,
  type NhtsaRecallSummary,
  type NormalizedAuctionLot,
  type ChargingProfileSummary,
  type RangeProjection,
  type IncentiveStatus,
  type ElectricityContext,
} from "./types";
import type { AiStepLog } from "./auction-ai-chain";

// ── Location helpers ───────────────────────────────────────────────────────────

/** Extract 2-letter state code from Copart location strings like "San Bernardino, CA" */
function extractStateFromLocation(location: string): string | null {
  const m = location.match(/,\s*([A-Z]{2})(?:\s|$)/);
  return m ? m[1] : null;
}

/** Build ChargingProfileSummary from data_v2 lookup */
function buildChargingProfile(make: string, model: string, year: number): ChargingProfileSummary | null {
  const p = getChargingProfile(make, model, year);
  if (!p) return null;
  return {
    peak_dc_kw: p.real_peak_dc_kw ?? p.peak_dc_kw,
    time_10_to_80_min: p.time_10_to_80_min,
    cold_derate_percent: p.cold_derate_percent,
    curve_shape: p.curve_shape,
    source_model: `${p.make} ${p.model} (${p.year_start}${p.year_end ? `–${p.year_end}` : "+"})`,
  };
}

/** Build RangeProjection from data_v2 + vehicle master */
function buildRangeProjection(
  make: string,
  model: string,
  year: number,
  location: string | null
): RangeProjection | null {
  const rangeRow = loadRangeStackForVehicle(make, model, year);
  const vehicleRow = findVehicleInMaster(make, model, year);
  const epaRange = vehicleRow?.epa_range_mi ?? null;
  const realWorldRange = vehicleRow?.real_world_range_mi ?? (epaRange ? Math.round(epaRange * 0.85) : null);

  if (!rangeRow && !epaRange) return null;

  // Temperature-adjusted ranges (multiply EPA range by fraction)
  const cold = epaRange && rangeRow?.range_at_32f ? Math.round(epaRange * rangeRow.range_at_32f) : null;
  const extremeCold = epaRange && rangeRow?.range_at_0f ? Math.round(epaRange * rangeRow.range_at_0f) : null;
  const heat = epaRange && rangeRow?.range_at_100f ? Math.round(epaRange * rangeRow.range_at_100f) : null;

  return {
    epa_range_mi: epaRange,
    real_world_range_mi: realWorldRange,
    cold_range_mi: cold,
    extreme_cold_range_mi: extremeCold,
    heat_range_mi: heat,
    climate_note: location ? `Lot location: ${location}` : null,
  };
}

/** Build IncentiveStatus — salvage titles always disqualify federal credit */
function buildIncentiveStatus(
  make: string,
  model: string,
  year: number,
  state: string | null
): IncentiveStatus {
  const incentives = getIncentivesForVehicle(make, model, year, state ?? undefined);
  const federalNew = incentives.find(i => i.incentive_type === "federal_new");
  const federalUsed = incentives.find(i => i.incentive_type === "federal_used");
  const stateInc = incentives.find(i => i.incentive_type === "state_new" || i.incentive_type === "state_used");

  return {
    federal_new_amount: federalNew?.amount_usd ?? 0,
    federal_used_amount: federalUsed?.amount_usd ?? 0,
    salvage_title_disqualifies: true, // IRS §30D — salvage title not eligible
    state: stateInc?.state ?? null,
    state_amount: stateInc?.amount_usd ?? 0,
    notes: "Salvage-titled vehicles are ineligible for the federal EV tax credit (IRS §30D). " +
           "If rebuilt and retitled, used vehicle credit ($4,000) may apply — consult a tax advisor.",
  };
}

/** Build ElectricityContext from state electricity rate + vehicle efficiency */
function buildElectricityContext(
  state: string,
  make: string,
  model: string,
  year: number
): ElectricityContext | null {
  const rate = getElectricityRate(state);
  if (!rate) return null;

  // Monthly cost: assume 12,000 mi/year, ~3.5 mi/kWh average EV efficiency
  const vehicleRow = findVehicleInMaster(make, model, year);
  const efficiencyMiPerKwh = 3.5; // conservative default
  const annualKwh = 12000 / efficiencyMiPerKwh;
  const monthlyKwh = annualKwh / 12;
  const monthlyRate = (rate.ev_tou_kwh_cents ?? rate.residential_kwh_cents) / 100;
  const monthlyCost = Math.round(monthlyKwh * monthlyRate);

  return {
    state,
    residential_kwh_cents: rate.residential_kwh_cents,
    ev_tou_kwh_cents: rate.ev_tou_kwh_cents,
    monthly_cost_estimate_usd: monthlyCost,
  };
}

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

    console.log(`[EvalService][1-LOT] provider=${lot.provider_name} lot=${lot.lot_number} vin=${lot.vin} year=${lot.year} make=${lot.make} model=${lot.model} primary_damage=${lot.primary_damage} secondary_damage=${lot.secondary_damage} condition_notes=${lot.condition_notes} title_status=${lot.title_status} odometer=${lot.odometer}`);

    // 2. Check persistence cache — skip for incomplete slug/unavailable lots
    const isIncompleteSource = lot.provider_name === "copart_url_slug" || lot.provider_name === "copart_unavailable";
    console.log(`[EvalService][2-CACHE] isIncompleteSource=${isIncompleteSource} supabase=${!!supabase}`);
    if (supabase && !isIncompleteSource) {
      const cached = await this.checkCache(supabase, lot.auction_source, lot.lot_number);
      if (cached) {
        console.log(`[EvalService][2-CACHE] HIT — returning cached result`);
        return { ...cached, cached: true };
      }
      console.log(`[EvalService][2-CACHE] MISS — proceeding with fresh evaluation`);
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

    console.log(`[EvalService][3-ENRICH] enrichResult.source=${enrichResult?.source ?? "null"} recalls=${recalls.length}`);
    console.log(`[EvalService][3-ENRICH] market_price_range=${JSON.stringify(enrichResult?.market_price_range ?? null)} vin_data.price=${JSON.stringify(enrichResult?.vin_data?.price ?? null)}`);

    // 3b. data_v2 static enrichment (synchronous, no network)
    const state = lot.location ? extractStateFromLocation(lot.location) : null;
    const chargingProfileSummary = (lot.make && lot.model && lot.year)
      ? buildChargingProfile(lot.make, lot.model, lot.year)
      : null;
    const rangeProjection = (lot.make && lot.model && lot.year)
      ? buildRangeProjection(lot.make, lot.model, lot.year, lot.location)
      : null;
    const incentiveStatus = (lot.make && lot.model && lot.year)
      ? buildIncentiveStatus(lot.make, lot.model, lot.year, state)
      : null;
    const electricityContext = (state && lot.make && lot.model && lot.year)
      ? buildElectricityContext(state, lot.make, lot.model, lot.year)
      : null;

    console.log(`[EvalService][3b-DATA2] charging=${!!chargingProfileSummary} range=${!!rangeProjection} incentive=${!!incentiveStatus} electricity=${!!electricityContext}`);

    // 4. Resolve ARV from enrichment
    let arv: number | null = null;
    let arvListingCount = 0;
    let hasVinData = false;
    let arvSource: "auto_dev_listings" | "vin_msrp" | "depreciation_curve" | "none" = "none";

    if (enrichResult?.market_price_range && enrichResult.market_price_range.count > 0) {
      arv = Math.round(
        (enrichResult.market_price_range.low + enrichResult.market_price_range.high) / 2
      );
      arvListingCount = enrichResult.market_price_range.count;
      arvSource = "auto_dev_listings";
    } else if (enrichResult?.vin_data?.price?.usedTmvRetail) {
      arv = enrichResult.vin_data.price.usedTmvRetail;
      arvSource = "vin_msrp";
    }
    hasVinData = Boolean(enrichResult?.vin_data);

    // Fallback ARV: depreciation curve when Auto.dev has no data
    if (!arv && lot.make && lot.model && lot.year) {
      const fallback = estimateFallbackArv(lot.make, lot.model, lot.year);
      if (fallback) {
        arv = fallback.arv;
        arvSource = "depreciation_curve";
        console.log(`[EvalService][4-ARV] fallback ARV=${arv} (age=${fallback.age_years}y, factor=${fallback.depreciation_factor}, msrp=${fallback.msrp_used})`);
      }
    }

    // Priority 4: AI ARV estimation — kick off in parallel, resolved before polish step
    // Running sequentially here would add ~8s before the AI chain even starts.
    const aiArvPromise = (!arv && lot.make && lot.model && lot.year)
      ? estimateArvWithAi(lot.make, lot.model, lot.year, lot.trim, lot.odometer).catch(() => null)
      : Promise.resolve(null);

    console.log(`[EvalService][4-ARV] arv=${arv} arvSource=${arvSource} arvListingCount=${arvListingCount} hasVinData=${hasVinData} aiArvInFlight=${!arv && !!lot.make}`);

    // 5. Payment — all features are free; isPaid always true
    const isPaid = true;
    console.log(`[EvalService][5-PAYMENT] isPaid=${isPaid} (free tier — all features unlocked)`);

    // 6. Deterministic pre-pass (no AI)
    console.log(`[EvalService][6-METRICS] computing deterministic metrics...`);
    const metrics = computeDeterministicMetrics(
      lot,
      { arv, arvListingCount, hasVinData },
      recalls
    );

    console.log(`[EvalService][6-METRICS] score=${metrics.salvage_risk_score} grade=${metrics.salvage_risk_grade} source_confidence=${metrics.source_confidence} damage_severity=${metrics.damage_severity_baseline} mileage_adj=${metrics.mileage_adjustment}`);
    console.log(`[EvalService][6-METRICS] factors=${JSON.stringify(metrics.salvage_risk_factors)}`);

    // 7. Optional routine context
    let routineContext: Record<string, unknown> | null = null;
    if (input.routine_profile) {
      routineContext = input.routine_profile as unknown as Record<string, unknown>;
    }

    // Resolve AI ARV before AI chain (it has been running in parallel since step 4)
    if (!arv) {
      const aiArv = await aiArvPromise;
      if (aiArv) {
        arv = aiArv.arv;
        arvSource = "depreciation_curve";
        console.log(`[EvalService][4-ARV] AI ARV resolved=${arv} reasoning="${aiArv.reasoning}"`);
      }
    }

    // 8. AI chain
    console.log(`[EvalService][8-AICHAIN] isPaid=${isPaid} arv=${arv} damage_severity=${metrics.damage_severity_baseline} photos=${lot.photos?.length ?? 0}`);
    const aiChainOutput = await runAuctionAiChain({
      lot,
      metrics,
      recalls,
      routineContext,
      arv,
      isPaid,
      charging_profile: chargingProfileSummary,
      range_projection: rangeProjection,
      electricity_context: electricityContext,
      incentive_status: incentiveStatus,
      photos: lot.photos?.slice(0, 3),
    });

    console.log(`[EvalService][8-AICHAIN] steps=${aiChainOutput.steps_run.map(s => `${s.step}:${s.status}`).join(", ")} total_calls=${aiChainOutput.total_model_calls}`);
    console.log(`[EvalService][8-AICHAIN] classification=${JSON.stringify(aiChainOutput.classification)}`);

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

    // 9b. Compute unified OFFO score (deterministic, no AI)
    const salvageRiskForOffo = {
      score:                    metrics.salvage_risk_score,
      grade:                    metrics.salvage_risk_grade,
      factors:                  metrics.salvage_risk_factors,
      risk_probability:         metrics.risk_probability,
      routine_impact_summary:   aiChainOutput.routine_impact?.routine_impact ?? "",
      suggested_bid_discount:   metrics.suggested_bid_discount,
      uncertainty_level:        metrics.uncertainty_level,
      expected_repair_cost:     metrics.expected_repair_cost,
      profit_margin:            metrics.profit_margin,
      primary_damage_category:  metrics.primary_damage_category,
      arv_hint_low:             arv ?? undefined,
    };
    const offoScore = computeAuctionOffoScore(salvageRiskForOffo, routineFit, lot.year);

    // 10. Build arbitrage result — always built when AI repair cost is available
    let arbitrage = null;
    if (aiChainOutput.repair_cost) {
      const rc = aiChainOutput.repair_cost;
      const {
        computeMaxSafeBid,
        computeSafeBidRange,
        computeExpectedProfits,
        computeProfitScenarios,
        computeCopartFees,
        getRiskBufferPct,
        computeMarketClosingEstimate,
      } = await import("@/lib/copart-arbitrage-engine");

      const askingPrice = lot.current_bid ?? null;
      const riskBufferPct = getRiskBufferPct(metrics.salvage_risk_score);

      // Use real tiered fees based on asking/current bid, fallback to legacy estimate
      const feesBreakdown = askingPrice
        ? computeCopartFees(askingPrice)
        : computeCopartFees(rc.repair_cost_midpoint > 0 ? rc.repair_cost_midpoint * 2 : 5000);
      const totalFees = feesBreakdown.total;

      const maxSafeBid = arv && rc.repair_cost_midpoint > 0
        ? computeMaxSafeBid(arv, rc.repair_cost_midpoint, totalFees, riskBufferPct)
        : null;
      const safeBidRange = arv && rc.repair_cost_low > 0
        ? computeSafeBidRange(arv, rc.repair_cost_low, rc.repair_cost_high, totalFees, riskBufferPct)
        : null;
      const { repair: expectedProfitRepair, parts: expectedProfitParts } =
        computeExpectedProfits(arv, rc.parts_value_total, askingPrice, rc.repair_cost_midpoint, totalFees);
      const profitScenariosRepair = arv && askingPrice && rc.repair_cost_midpoint > 0
        ? computeProfitScenarios(arv, askingPrice, rc.repair_cost_low, rc.repair_cost_midpoint, rc.repair_cost_high, totalFees)
        : null;
      const recommendedStrategy: "repair" | "parts" | null =
        expectedProfitRepair !== null && expectedProfitParts !== null
          ? expectedProfitParts > expectedProfitRepair ? "parts" : "repair"
          : expectedProfitRepair !== null ? "repair"
          : expectedProfitParts !== null ? "parts"
          : null;

      // Add fallback ARV caveat when using estimated value
      const caveats = [...rc.caveats];
      if (arvSource === "depreciation_curve") {
        caveats.unshift("ARV estimated from depreciation model — no active listings found. Verify current market value before bidding.");
      }

      arbitrage = {
        arv,
        arv_range: enrichResult?.market_price_range && enrichResult.market_price_range.count > 0
          ? { low: enrichResult.market_price_range.low, high: enrichResult.market_price_range.high }
          : null,
        arv_source: arvSource,
        arv_listing_count: arvListingCount,
        repair_cost_estimate: rc.repair_cost_midpoint,
        repair_cost_low: rc.repair_cost_low,
        repair_cost_high: rc.repair_cost_high,
        repair_cost_breakdown: rc.breakdown,
        parts_value: rc.parts_value_total,
        parts_value_breakdown: rc.parts_value_breakdown,
        max_safe_bid: maxSafeBid,
        auction_fees_estimate: totalFees,
        auction_fees_breakdown: feesBreakdown,
        risk_buffer_pct: riskBufferPct,
        confidence: rc.confidence,
        caveats,
        damage_type_inferred: (aiChainOutput.classification?.primary_damage_type && aiChainOutput.classification.primary_damage_type !== "unspecified")
          ? aiChainOutput.classification.primary_damage_type
          : (lot.damage_type ?? "unspecified damage"),
        expected_profit_repair: expectedProfitRepair,
        expected_profit_parts: expectedProfitParts,
        safe_bid_range: safeBidRange,
        profit_scenarios_repair: profitScenariosRepair,
        recommended_strategy: recommendedStrategy,
        market_closing_estimate: arv ? computeMarketClosingEstimate(arv) : null,
      };
    } else if (arv && metrics.expected_repair_cost) {
      // Deterministic fallback — AI repair step was skipped, use damage-category estimate
      const {
        computeExpectedProfits, computeCopartFees, getRiskBufferPct,
        computeMarketClosingEstimate, computeMaxSafeBid, computeSafeBidRange, computeProfitScenarios,
      } = await import("@/lib/copart-arbitrage-engine");
      const rc = metrics.expected_repair_cost;
      const askingPrice = lot.current_bid ?? null;
      const feesBreakdown = computeCopartFees(askingPrice ?? rc.midpoint * 2);
      const totalFees = feesBreakdown.total;
      const detRiskBufferPct = getRiskBufferPct(metrics.salvage_risk_score);
      const { repair: expectedProfitRepair } = computeExpectedProfits(arv, 0, askingPrice, rc.midpoint, totalFees);
      const detMaxSafeBid = rc.midpoint > 0 ? computeMaxSafeBid(arv, rc.midpoint, totalFees, detRiskBufferPct) : null;
      const detSafeBidRange = rc.low > 0
        ? computeSafeBidRange(arv, rc.low, rc.high, totalFees, detRiskBufferPct)
        : null;
      const detProfitScenarios = arv && askingPrice && rc.midpoint > 0
        ? computeProfitScenarios(arv, askingPrice, rc.low, rc.midpoint, rc.high, totalFees)
        : null;
      const caveats: string[] = [];
      if (arvSource === "depreciation_curve") {
        caveats.push("ARV estimated from depreciation model — no active listings found. Verify before bidding.");
      }
      arbitrage = {
        arv,
        arv_range: enrichResult?.market_price_range && enrichResult.market_price_range.count > 0
          ? { low: enrichResult.market_price_range.low, high: enrichResult.market_price_range.high }
          : null,
        arv_source: arvSource,
        arv_listing_count: arvListingCount,
        repair_cost_estimate: rc.midpoint,
        repair_cost_low: rc.low,
        repair_cost_high: rc.high,
        repair_cost_breakdown: [],
        parts_value: 0,
        parts_value_breakdown: [],
        max_safe_bid: detMaxSafeBid,
        auction_fees_estimate: totalFees,
        auction_fees_breakdown: feesBreakdown,
        risk_buffer_pct: detRiskBufferPct,
        confidence: rc.confidence,
        caveats,
        damage_type_inferred: (aiChainOutput.classification?.primary_damage_type && aiChainOutput.classification.primary_damage_type !== "unspecified")
          ? aiChainOutput.classification.primary_damage_type
          : (lot.damage_type ?? "unspecified damage"),
        expected_profit_repair: expectedProfitRepair,
        expected_profit_parts: null,
        safe_bid_range: detSafeBidRange,
        profit_scenarios_repair: detProfitScenarios,
        recommended_strategy: expectedProfitRepair !== null ? ("repair" as const) : null,
        market_closing_estimate: computeMarketClosingEstimate(arv),
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
            salvage_risk: {
              score: metrics.salvage_risk_score,
              grade: metrics.salvage_risk_grade,
              factors: metrics.salvage_risk_factors,
              routine_impact_summary: aiChainOutput.routine_impact?.routine_impact ?? "",
              suggested_bid_discount: metrics.suggested_bid_discount,
            },
            arbitrage,
            routine_fit: routineFit,
            recalls,
            verdict: aiChainOutput.polish,
            offo_score: offoScore,
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
        risk_probability: metrics.risk_probability,
        uncertainty_level: metrics.uncertainty_level,
        expected_repair_cost: metrics.expected_repair_cost,
        profit_margin: metrics.profit_margin,
        primary_damage_category: metrics.primary_damage_category,
      },
      arbitrage,
      recalls,
      routine_fit: routineFit,
      charging_profile: chargingProfileSummary,
      range_projection: rangeProjection,
      incentive_status: incentiveStatus,
      electricity_context: electricityContext,
      offo_score: offoScore,
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
      const { data: rows } = await supabase
        .from("auction_analyses")
        .select("result_id, final_report, raw_data, created_at, cache_expires_at")
        .eq("auction_source", source)
        .eq("lot_number", lotNumber)
        .gt("cache_expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (!rows || rows.length === 0) return null;

      // Find the best valid row — has arbitrage + primary_damage + not slug-sourced
      let row = null;
      const badIds: string[] = [];
      for (const r of rows) {
        if (!r.final_report || !r.raw_data) { badIds.push(r.result_id); continue; }
        const rl = r.raw_data as NormalizedAuctionLot;
        const rp = r.final_report as Record<string, unknown>;
        const isStale =
          rl.provider_name === "copart_url_slug" ||
          rl.provider_name === "copart_unavailable" ||
          !rp?.arbitrage ||
          !rl.primary_damage;
        console.log(`[EvalService][CACHE] result_id=${r.result_id} provider=${rl.provider_name} primary_damage=${rl.primary_damage} hasArbitrage=${!!rp?.arbitrage} isStale=${isStale}`);
        if (isStale) { badIds.push(r.result_id); continue; }
        row = r;
        break;
      }
      // Delete all stale rows
      if (badIds.length > 0) {
        await supabase.from("auction_analyses").delete().in("result_id", badIds);
      }
      if (!row) return null;

      const report = row.final_report as Record<string, unknown>;

      // Normalise salvage_risk — old records stored raw DeterministicMetrics
      // (salvage_risk_score / salvage_risk_grade / salvage_risk_factors).
      // New records store the correctly shaped SalvageRiskResult (score / grade / factors).
      const rawSr = report.salvage_risk as Record<string, unknown>;
      const salvageRisk: AuctionEvalReport["salvage_risk"] =
        rawSr?.grade !== undefined
          ? (rawSr as unknown as AuctionEvalReport["salvage_risk"])
          : {
              score: (rawSr?.salvage_risk_score as number) ?? 50,
              grade: ((rawSr?.salvage_risk_grade as string) ?? "yellow") as "green" | "yellow" | "red",
              factors: (rawSr?.salvage_risk_factors as AuctionEvalReport["salvage_risk"]["factors"]) ?? {
                battery_risk: 50, structural_risk: 50, title_impact: 50,
                recall_overlap: 0, repair_cost_risk: 50, mileage_penalty: 0,
              },
              routine_impact_summary: "",
              suggested_bid_discount: (rawSr?.suggested_bid_discount as number) ?? 0,
              risk_probability: (rawSr?.risk_probability as number) ?? 0.5,
              uncertainty_level: ((rawSr?.uncertainty_level as string) ?? "high") as "low" | "medium" | "high",
              expected_repair_cost: null,
              profit_margin: null,
              primary_damage_category: "unknown" as const,
            };

      return {
        report_id: row.result_id,
        lot: row.raw_data as NormalizedAuctionLot,
        salvage_risk: salvageRisk,
        arbitrage: (report.arbitrage as AuctionEvalReport["arbitrage"]) ?? null,
        recalls: (report.recalls as NhtsaRecallSummary[]) ?? [],
        routine_fit: (report.routine_fit as AuctionEvalReport["routine_fit"]) ?? null,
        charging_profile: (report.charging_profile as AuctionEvalReport["charging_profile"]) ?? null,
        range_projection: (report.range_projection as AuctionEvalReport["range_projection"]) ?? null,
        incentive_status: (report.incentive_status as AuctionEvalReport["incentive_status"]) ?? null,
        electricity_context: (report.electricity_context as AuctionEvalReport["electricity_context"]) ?? null,
        offo_score: (report.offo_score as AuctionEvalReport["offo_score"]) ?? undefined,
        created_at: row.created_at,
        expires_at: row.cache_expires_at,
      };
    } catch {
      return null;
    }
  }
}

export const auctionEvaluationService = new AuctionEvaluationService();
