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
import { generateDeepDive } from "@/lib/receipt-openai";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { isInternalTester } from "@/lib/rollout-flags";
import type { ListingReceipt } from "@/types/receipt";

const VALID_SCENARIO_TYPES = ["receipt", "evroutine"];

// Rate limiters — in-memory, apply before any DB or AI calls
const deepDiveIPLimiter   = new RateLimiter(60 * 60 * 1000, 3); // 3/hr per IP
const deepDiveAnonLimiter = new RateLimiter(60 * 60 * 1000, 3); // 3/hr per anon_id

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  // 0a. Body size cap (fail cheap before parsing)
  const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
  if (contentLength > 50_000) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  // 0b. IP rate limit (cheap, in-memory)
  const ip = getClientIP(request);
  const ipCheck = deepDiveIPLimiter.check(ip);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((ipCheck.resetAt - Date.now()) / 1000)) } }
    );
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

  // 0c. Per-anon rate limit (after body parse, before DB)
  const anonCheck = deepDiveAnonLimiter.check(anonId);
  if (!anonCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((anonCheck.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Payment gate removed — deep dive is free for all users
  const packTier = "buyer_pass";

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
    console.error("[DeepDive] Scenario not found:", { scenarioType, scenarioId, error: scenarioError?.message });
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  if (scenarioType === "receipt" && !scenario.output_json) {
    console.error("[DeepDive] Receipt output_json is null — still generating?", { scenarioId, generation_status: scenario.generation_status });
    return NextResponse.json({ error: "Receipt output not ready — try again in a moment" }, { status: 202 });
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
    const deepDive = await generateDeepDive(baseReceipt, packTier);

    // 6. Cache in deep_dives table (upsert) — skip for internal testers
    if (isInternalTester(anonId)) {
      return NextResponse.json({ success: true, deep_dive: deepDive, pack_tier: packTier, cached: false });
    }
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

    console.log("[DeepDive] Generated:", { scenarioType, scenarioId, packTier });

    return NextResponse.json({
      success: true,
      deep_dive: deepDive,
      pack_tier: packTier,
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
