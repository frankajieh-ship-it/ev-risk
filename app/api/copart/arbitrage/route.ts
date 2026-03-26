/**
 * Copart Arbitrage Calculator API
 *
 * POST /api/copart/arbitrage
 * Payment-gated (requires copart_report purchase).
 *
 * Returns:
 * - After-Repair Value (ARV) from Auto.dev market data
 * - Repair cost estimate (AI-generated, itemized)
 * - Max safe bid at 20% default margin
 * - Parts value breakdown
 * - Confidence + caveats
 *
 * Stateless — no DB writes. maxDuration = 60.
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import { checkPurchaseStatus } from "@/lib/payment-status";
import { enrichFromAutodev } from "@/lib/auto-dev-client";
import { openaiAdapter } from "@/lib/providers/openai-adapter";
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

  if (!receiptId || !receiptToken) {
    return NextResponse.json({ success: false, error: "Missing receipt_id or receipt_token" }, { status: 400 });
  }
  if (!listingText || listingText.length < 10) {
    return NextResponse.json({ success: false, error: "Missing listing_text" }, { status: 400 });
  }

  // ── Payment gate ─────────────────────────────────────────────────────────
  const paymentStatus = await checkPurchaseStatus("copart", receiptId, receiptToken);
  if (!paymentStatus.unlocked_base) {
    return NextResponse.json(
      { success: false, error: "Payment required", payment_required: true },
      { status: 402 }
    );
  }

  // ── Infer damage type from listing text ──────────────────────────────────
  const damageType = inferDamageType(listingText);

  // ── Parallel: Auto.dev ARV + OpenAI repair cost ──────────────────────────
  const [enrichment, repairResult] = await Promise.allSettled([
    enrichFromAutodev({ vin: vin ?? undefined, make: make ?? undefined, model: model ?? undefined, year: year ?? undefined }),
    openaiAdapter.generate({
      systemPrompt: REPAIR_COST_SYSTEM_PROMPT,
      userPrompt: buildRepairCostUserPrompt({ year, make, model, trim, damageType, askingPrice, listingText }),
      jsonSchema: REPAIR_COST_JSON_SCHEMA,
      schemaName: "repair_cost_output",
      temperature: 0.2,
      maxTokens: 1500,
      timeoutMs: 50_000,
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

  // ── Parse repair cost output ──────────────────────────────────────────────
  let repairOutput: RepairCostOutput | null = null;
  if (repairResult.status === "fulfilled") {
    try {
      repairOutput = repairResult.value.json as RepairCostOutput;
    } catch {
      repairOutput = null;
    }
  }

  // Graceful fallback if AI failed
  const repairCostLow = repairOutput?.repair_cost_total_low ?? 0;
  const repairCostHigh = repairOutput?.repair_cost_total_high ?? 0;
  const repairCostMidpoint = Math.round((repairCostLow + repairCostHigh) / 2);
  const partsValue = repairOutput?.parts_value_total ?? 0;

  // ── Max safe bid ──────────────────────────────────────────────────────────
  const maxSafeBid =
    arv !== null && repairCostMidpoint > 0
      ? computeMaxSafeBid(arv, repairCostMidpoint, AUCTION_FEES_ESTIMATE, 20)
      : null;

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
    auction_fees_estimate: AUCTION_FEES_ESTIMATE,
    confidence: repairOutput?.confidence ?? "low",
    caveats: repairOutput?.caveats ?? ["Repair cost estimate unavailable — manual inspection strongly recommended."],
    damage_type_inferred: damageType,
  };

  return NextResponse.json({ success: true, result });
}
