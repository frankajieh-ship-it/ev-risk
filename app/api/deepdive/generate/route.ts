/**
 * OFFO Decision Pack — Deep Dive Generation
 *
 * POST /api/deepdive/generate
 *
 * Generates expanded paid analysis for a scenario.
 * Gated: requires a paid purchase for the scenario (base or compare).
 * Caches results in the deep_dives table.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkPurchaseStatus } from "@/lib/payment-status";
import { generateDeepDive } from "@/lib/receipt-openai";
import type { ListingReceipt } from "@/types/receipt";

const VALID_SCENARIO_TYPES = ["receipt", "evroutine"];

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scenarioType = body.scenario_type as string;
  const scenarioId = body.scenario_id as string;
  const anonId = body.anon_id as string;

  if (!scenarioType || !VALID_SCENARIO_TYPES.includes(scenarioType)) {
    return NextResponse.json({ error: "Invalid scenario_type" }, { status: 400 });
  }
  if (!scenarioId) {
    return NextResponse.json({ error: "Missing scenario_id" }, { status: 400 });
  }
  if (!anonId || anonId.length < 5) {
    return NextResponse.json({ error: "Missing or invalid anon_id" }, { status: 400 });
  }

  // 1. Check entitlement
  const status = await checkPurchaseStatus(scenarioType, scenarioId, anonId);
  if (!status.unlocked_base || status.purchase_status !== "paid") {
    return NextResponse.json(
      { error: "Purchase required to access deep dive" },
      { status: 403 }
    );
  }

  // 2. Check cache
  const { data: cached } = await supabase
    .from("deep_dives")
    .select("content")
    .eq("scenario_type", scenarioType)
    .eq("scenario_id", scenarioId)
    .maybeSingle();

  if (cached?.content) {
    return NextResponse.json({
      success: true,
      deep_dive: cached.content,
      cached: true,
    });
  }

  // 3. Fetch the base scenario data
  const tableName = scenarioType === "receipt" ? "receipts" : "reports";
  const { data: scenario, error: scenarioError } = await supabase
    .from(tableName)
    .select("*")
    .eq("id", scenarioId)
    .maybeSingle();

  if (scenarioError || !scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  // 4. Build a ListingReceipt-like object for the deep dive prompt
  let baseReceipt: ListingReceipt;

  if (scenarioType === "receipt") {
    // For receipts, the output_json field contains the full receipt
    if (scenario.output_json) {
      baseReceipt = scenario.output_json as ListingReceipt;
    } else {
      return NextResponse.json(
        { error: "Receipt output not available for deep dive" },
        { status: 400 }
      );
    }
  } else {
    // For evroutine reports, build a minimal receipt-like structure from report data
    const reportData = scenario.output_json || scenario;
    baseReceipt = {
      receipt_id: scenarioId,
      schema_version: "v1",
      mode: "single",
      verdict: reportData.verdict || "YELLOW",
      verdict_reason: reportData.verdict_reason || reportData.summary || "Report analysis",
      price_sanity: {
        label: "UNKNOWN",
        confidence: 0,
        basis: "UNKNOWN",
        rationale_short: "Not applicable for this scenario type",
        user_market_range: null,
      },
      risk_flags: reportData.risk_flags || [],
      must_answer_questions: reportData.must_answer_questions || [],
      inspect_first: reportData.inspect_first || [],
      negotiation_opener: "",
      one_followup_question: null,
      receipt_reddit_text: "",
      reddit_draft: null,
      listing_summary: {
        listing_url: "",
        url_domain: "",
        country: "US",
        zip_or_postcode: "",
        price: reportData.price || 0,
        currency: "USD",
        mileage: reportData.mileage || 0,
        mileage_unit: "mi",
        year: reportData.year || 0,
        make: reportData.make || "",
        model: reportData.model || "",
        trim: reportData.trim || null,
        seller_type: "unknown",
        title_status: "unknown",
        accidents_reported: "unknown",
        service_history: "unknown",
        owners: null,
        carfax_available: "unknown",
      },
      receipt_details: null,
      compare: null,
      operator_notes: {
        rationale: reportData.rationale || "Generated from report data",
        assumptions: [],
        what_would_change_verdict: [],
      },
    } as ListingReceipt;
  }

  // 5. Generate deep dive
  try {
    const deepDive = await generateDeepDive(baseReceipt);

    // 6. Cache in deep_dives table (upsert)
    await supabase
      .from("deep_dives")
      .upsert(
        {
          scenario_type: scenarioType,
          scenario_id: scenarioId,
          content: deepDive,
        },
        { onConflict: "scenario_type,scenario_id" }
      );

    console.log("[DeepDive] Generated:", { scenarioType, scenarioId });

    return NextResponse.json({
      success: true,
      deep_dive: deepDive,
      cached: false,
    });
  } catch (err) {
    console.error("[DeepDive] Generation failed:", err);
    return NextResponse.json(
      { error: "Deep dive generation failed. Please try again." },
      { status: 500 }
    );
  }
}
