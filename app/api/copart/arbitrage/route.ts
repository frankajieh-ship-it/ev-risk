/**
 * Copart Arbitrage Calculator API — Backward-Compatibility Wrapper
 *
 * POST /api/copart/arbitrage
 * Payment-gated (requires copart_report purchase).
 *
 * Preserved for backward compatibility — the canonical path is
 * POST /api/auction/analyze (which returns the full AuctionEvalReport
 * including arbitrage when paid).
 *
 * This route now routes the AI call through hedgedGenerate (multi-model)
 * instead of calling openaiAdapter directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import { enrichFromAutodev } from "@/lib/auto-dev-client";
import { hedgedGenerate } from "@/lib/providers/hedged-generate";
import {
  inferDamageType,
  buildRepairCostUserPrompt,
  REPAIR_COST_JSON_SCHEMA,
  REPAIR_COST_SYSTEM_PROMPT,
  computeMaxSafeBid,
  computeExpectedProfits,
  computeSafeBidRange,
  computeProfitScenarios,
  computeCopartFees,
  getRiskBufferPct,
  computeMarketClosingEstimate,
  type RepairCostOutput,
  type ArbitrageResult,
} from "@/lib/copart-arbitrage-engine";
import { estimateFallbackArv } from "@/lib/auction/fallback-arv";

export const maxDuration = 60;

const rateLimiter = new RateLimiter(60 * 1000, 10); // 10/min per IP

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const receiptId = (body.receipt_id as string) || "";
  const receiptToken = (body.receipt_token as string) || "";
  const listingText = (body.listing_text as string) || "";
  const vin = (body.vin as string) || null;
  const askingPrice = typeof body.asking_price === "number" ? body.asking_price : null;
  const make = (body.make as string) || null;
  const model = (body.model as string) || null;
  const year = typeof body.year === "number" ? body.year : null;
  const trim = (body.trim as string) || null;
  const _pdRaw = body.primary_damage;
  const _ltRaw = body.loss_type;
  // Guard against JS null serialized as string "null"
  const primaryDamageRaw =
    (typeof _pdRaw === "string" && _pdRaw !== "null" && _pdRaw.trim()) ? _pdRaw.trim() :
    (typeof _ltRaw === "string" && _ltRaw !== "null" && _ltRaw.trim()) ? _ltRaw.trim() :
    null;

  if (!receiptId) {
    return NextResponse.json({ success: false, error: "Missing receipt_id" }, { status: 400 });
  }
  if (!listingText || listingText.length < 10) {
    return NextResponse.json({ success: false, error: "Missing listing_text" }, { status: 400 });
  }

  // ── Damage type: use explicit primary_damage field first, fall back to text inference ──
  const damageType = primaryDamageRaw
    ? inferDamageType(primaryDamageRaw)
    : inferDamageType(listingText);
  console.log(`[ArbitrageRoute] damageType="${damageType}" from primaryDamage="${primaryDamageRaw}"`)

  // ── Parallel: Auto.dev ARV + hedged AI repair cost ───────────────────────
  const isRepairCostOutputInner = (v: unknown): v is RepairCostOutput => {
    if (!v || typeof v !== "object") return false;
    const d = v as Record<string, unknown>;
    return (
      typeof d.repair_cost_total_low === "number" &&
      typeof d.repair_cost_total_high === "number" &&
      Array.isArray(d.breakdown)
    );
  };

  const [enrichment, repairResult] = await Promise.allSettled([
    enrichFromAutodev({ vin: vin ?? undefined, make: make ?? undefined, model: model ?? undefined, year: year ?? undefined }),
    hedgedGenerate({
      systemPrompt: REPAIR_COST_SYSTEM_PROMPT,
      userPrompt: buildRepairCostUserPrompt({ year, make, model, trim, damageType, askingPrice, listingText }),
      jsonSchema: REPAIR_COST_JSON_SCHEMA,
      schemaName: "repair_cost_output",
      temperature: 0.2,
      maxTokens: 1500,
      validate: (json) => isRepairCostOutputInner(json)
        ? { valid: true, errors: [] }
        : { valid: false, errors: ["Invalid repair cost output shape"] },
    }),
  ]);

  // ── Compute ARV from Auto.dev ─────────────────────────────────────────────
  let arv: number | null = null;
  let arvRange: { low: number; high: number } | null = null;
  let arvSource: ArbitrageResult["arv_source"] = "none";
  let arvListingCount = 0;

  if (enrichment.status === "fulfilled") {
    const enrich = enrichment.value;
    if (enrich.market_price_range && enrich.market_price_range.count > 0) {
      arvRange = { low: enrich.market_price_range.low, high: enrich.market_price_range.high };
      arv = Math.round((enrich.market_price_range.low + enrich.market_price_range.high) / 2);
      arvSource = "auto_dev_listings";
      arvListingCount = enrich.market_price_range.count;
    } else if (enrich.vin_data?.price?.usedTmvRetail) {
      arv = enrich.vin_data.price.usedTmvRetail;
      arvRange = null;
      arvSource = "vin_msrp";
    }
  }

  // Fallback ARV from depreciation curve when Auto.dev has no data
  if (!arv && make && model && year) {
    const fallback = estimateFallbackArv(make, model, year);
    if (fallback) {
      arv = fallback.arv;
      arvSource = "depreciation_curve";
    }
  }

  // ── Parse repair cost output ──────────────────────────────────────────────
  let repairOutput: RepairCostOutput | null = null;
  if (repairResult.status === "fulfilled") {
    const parsed = repairResult.value.result.json;
    repairOutput = isRepairCostOutputInner(parsed) ? parsed : null;
  }

  // Graceful fallback if AI failed
  const repairCostLow = repairOutput?.repair_cost_total_low ?? 0;
  const repairCostHigh = repairOutput?.repair_cost_total_high ?? 0;
  const repairCostMidpoint = Math.round((repairCostLow + repairCostHigh) / 2);
  const partsValue = repairOutput?.parts_value_total ?? 0;

  // ── Real tiered fees ──────────────────────────────────────────────────────
  const feesBreakdown = computeCopartFees(
    askingPrice ?? (repairCostMidpoint > 0 ? repairCostMidpoint * 2 : 5000)
  );
  const totalFees = feesBreakdown.total;
  // No salvage score in this backward-compat route — use conservative default
  const riskBufferPct = getRiskBufferPct(50);

  // ── Max safe bid + range ──────────────────────────────────────────────────
  const maxSafeBid =
    arv !== null && repairCostMidpoint > 0
      ? computeMaxSafeBid(arv, repairCostMidpoint, totalFees, riskBufferPct)
      : null;

  const safeBidRange =
    arv !== null && repairCostLow > 0
      ? computeSafeBidRange(arv, repairCostLow, repairCostHigh, totalFees, riskBufferPct)
      : null;

  const { repair: expectedProfitRepair, parts: expectedProfitParts } =
    computeExpectedProfits(arv, partsValue, askingPrice, repairCostMidpoint, totalFees);

  const profitScenariosRepair =
    arv !== null && askingPrice !== null && repairCostMidpoint > 0
      ? computeProfitScenarios(arv, askingPrice, repairCostLow, repairCostMidpoint, repairCostHigh, totalFees)
      : null;

  const recommendedStrategy: ArbitrageResult["recommended_strategy"] =
    expectedProfitRepair !== null && expectedProfitParts !== null
      ? expectedProfitParts > expectedProfitRepair ? "parts" : "repair"
      : expectedProfitRepair !== null ? "repair"
      : expectedProfitParts  !== null ? "parts"
      : null;

  const caveats = repairOutput?.caveats ?? ["Repair cost estimate unavailable — manual inspection strongly recommended."];
  if (arvSource === "depreciation_curve") {
    caveats.unshift("ARV estimated from depreciation model — no active listings found. Verify current market value before bidding.");
  }

  const result: ArbitrageResult = {
    arv,
    arv_range: arvRange,
    arv_source: arvSource,
    arv_listing_count: arvListingCount,
    repair_cost_estimate: repairCostMidpoint,
    repair_cost_low: repairCostLow,
    repair_cost_high: repairCostHigh,
    repair_cost_breakdown: repairOutput?.breakdown ?? [],
    parts_value: partsValue,
    parts_value_breakdown: repairOutput?.parts_value_breakdown ?? [],
    max_safe_bid: maxSafeBid,
    auction_fees_estimate: totalFees,
    auction_fees_breakdown: feesBreakdown,
    risk_buffer_pct: riskBufferPct,
    confidence: repairOutput?.confidence ?? "low",
    caveats,
    damage_type_inferred: damageType,
    expected_profit_repair: expectedProfitRepair,
    expected_profit_parts: expectedProfitParts,
    safe_bid_range: safeBidRange,
    profit_scenarios_repair: profitScenariosRepair,
    recommended_strategy: recommendedStrategy,
    market_closing_estimate: arv ? computeMarketClosingEstimate(arv) : null,
  };

  return NextResponse.json({ success: true, result });
}
