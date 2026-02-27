/**
 * EV-Risk™ Score API Route
 *
 * POST /api/score
 * Body: { model, year, zipCode, dailyMiles, homeCharging, riskTolerance }
 * Returns: BuyConfidence score
 */

import { NextRequest, NextResponse } from "next/server";
import { calculateBuyConfidence, generateRiskBreakdown, type ScoringInput } from "@/lib/scoring";
import { RiskAssessor } from "@/lib/risk-assessor";
import { validateMVR, type MinimumViableRoutine } from "@/types/v2";
import { computeRoutineFit } from "@/lib/compute-routine-fit";
import { computeOwnershipRisk } from "@/lib/compute-ownership-risk";
import { buildConfidencePlan } from "@/lib/confidence-actions";
import { buildReportContract } from "@/lib/build-report-contract";
import { findRangeDataByModel } from "@/lib/data";
import { guardTurnstile } from "@/lib/turnstile";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

const scoreBurstLimiter = new RateLimiter(
  60 * 60 * 1000, // 1 hour
  process.env.NODE_ENV === "development" ? 100 : 5
);

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);

  try {
    const body = await request.json();

    // Bot protection (honeypot + Turnstile)
    const blocked = await guardTurnstile(body, clientIP, "/api/score");
    if (blocked) return blocked;

    // Rate limit (5/hr per IP)
    const burst = scoreBurstLimiter.check(clientIP);
    if (!burst.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    // ============================================
    // V2 BRANCH: Separate Routine Fit + Ownership Risk
    // ============================================
    if (body.schema_version === "v2" && body.routine) {
      const routine = body.routine as MinimumViableRoutine;
      const validation = validateMVR(routine);
      if (!validation.ok) {
        return NextResponse.json(
          { error: "invalid_routine", details: validation.errors },
          { status: 422 }
        );
      }

      // Build vehicle basics if vehicle data provided
      let vehicleBasics: { model?: string; year?: number; real_world_range_mi?: number } | undefined;
      if (body.model && body.year) {
        const rangeData = findRangeDataByModel(body.model, body.year);
        vehicleBasics = {
          model: body.model,
          year: body.year,
          real_world_range_mi: rangeData?.real_world_range_mi,
        };
      }

      // Compute routine fit (works without vehicle data)
      const routineFit = computeRoutineFit(routine, vehicleBasics);

      // Compute ownership risk (returns "unknown" modules if no vehicle)
      const ownershipRisk = body.model && body.year
        ? computeOwnershipRisk({
            model: body.model,
            year: body.year,
            currentMileage: body.currentMileage ?? 0,
            zipCode: body.zipCode ?? "00000",
            dailyMiles: body.dailyMiles ?? 40,
            homeCharging: body.homeCharging ?? false,
            riskTolerance: body.riskTolerance ?? "moderate",
          })
        : computeOwnershipRisk();

      // Build dealer questions based on context
      const dealerQuestions = buildDealerQuestionsV2(routine, ownershipRisk);

      // Build confidence action plan (all 3 actions show since VIN/SOH/fast-charge not yet accepted)
      const confidencePlan = buildConfidencePlan({
        vehicle: vehicleBasics
          ? { make: body.model.split(" ")[0], model: body.model, year: body.year }
          : undefined,
      });

      // Build the new contract shape
      const effectiveDailyMiles = routine.commute_miles_roundtrip
        ? routine.commute_miles_roundtrip
        : (routine.weekly_miles ?? 100) / 5;
      const hasActualRange = !!vehicleBasics?.real_world_range_mi;
      const effectiveRange = hasActualRange ? vehicleBasics!.real_world_range_mi! : 0;

      const contract = buildReportContract({
        routineFit,
        ownershipRisk,
        mvr: routine,
        vehicle: vehicleBasics
          ? { make: body.model.split(" ")[0], model: body.model, year: body.year, mileage: body.currentMileage }
          : undefined,
        confidencePlan,
        dealerQuestions,
        effectiveDailyMiles,
        effectiveRange,
      });

      return NextResponse.json({
        success: true,
        schema_version: "v2",
        ...contract,
      });
    }

    // ============================================
    // V1 BRANCH: Existing behavior (unchanged)
    // ============================================

    // Validate input
    const {
      model,
      year,
      currentMileage,
      zipCode,
      dailyMiles,
      homeCharging,
      riskTolerance,
      dataSource,
      autoFilledFields,
      batteryInfoAvailable,
      missingFields
    } = body;

    if (!model || typeof model !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing 'model' field" },
        { status: 400 }
      );
    }

    if (!year || typeof year !== "number" || year < 2010 || year > new Date().getFullYear()) {
      return NextResponse.json(
        { error: "Invalid or missing 'year' field (must be 2010-present)" },
        { status: 400 }
      );
    }

    if (typeof currentMileage !== "number" || currentMileage < 0 || currentMileage > 300000) {
      return NextResponse.json(
        { error: "Invalid or missing 'currentMileage' field (must be 0-300,000)" },
        { status: 400 }
      );
    }

    if (!zipCode || typeof zipCode !== "string" || !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json(
        { error: "Invalid or missing 'zipCode' field (must be 5-digit US ZIP)" },
        { status: 400 }
      );
    }

    if (typeof dailyMiles !== "number" || dailyMiles < 0 || dailyMiles > 500) {
      return NextResponse.json(
        { error: "Invalid or missing 'dailyMiles' field (must be 0-500)" },
        { status: 400 }
      );
    }

    if (typeof homeCharging !== "boolean") {
      return NextResponse.json(
        { error: "Invalid or missing 'homeCharging' field (must be boolean)" },
        { status: 400 }
      );
    }

    if (!["conservative", "moderate", "aggressive"].includes(riskTolerance)) {
      return NextResponse.json(
        { error: "Invalid or missing 'riskTolerance' field (must be 'conservative', 'moderate', or 'aggressive')" },
        { status: 400 }
      );
    }

    // Build scoring input
    const scoringInput: ScoringInput = {
      model: model.trim(),
      year,
      currentMileage,
      zipCode: zipCode.trim(),
      dailyMiles,
      homeCharging,
      riskTolerance,
      // Pass through manual entry metadata
      ...(batteryInfoAvailable !== undefined && { batteryInfoAvailable }),
      ...(dataSource && { dataSource: dataSource as 'url-extraction' | 'manual-entry' }),
      ...(missingFields && missingFields.length > 0 && { missingFields }),
    };

    // Calculate score
    const confidence = calculateBuyConfidence(scoringInput);
    const breakdown = generateRiskBreakdown(confidence);

    // Generate data quality analysis
    const vehicleData = {
      year,
      make: model.split(' ')[0], // Extract make from model string
      model: model.split(' ').slice(1).join(' '), // Rest is model
      mileage: currentMileage,
      dataSource: 'user_provided' as const,
      confidence: 'medium' as const,
    };

    const userInputs = {
      zipCode,
      dailyMiles,
      homeCharging,
      riskTolerance,
    };

    const dataQualityAnalysis = RiskAssessor.assess(vehicleData, userInputs);

    // Add metadata about data source and confidence adjustment
    const confidenceMetadata = {
      dataSource: dataSource || 'manual_entry',
      autoFilledFields: autoFilledFields || [],
      confidenceNote: dataSource === 'url_extraction' && autoFilledFields?.length < 3
        ? 'Some vehicle details were entered manually or inferred due to listing limitations.'
        : undefined,
    };

    // Return response
    return NextResponse.json({
      success: true,
      input: scoringInput,
      confidence,
      breakdown,
      dataQuality: {
        ...dataQualityAnalysis,
        ...confidenceMetadata,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Score API Error:", error);

    return NextResponse.json(
      {
        error: "Internal server error calculating score",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight (if needed later)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ============================================
// V2 Helpers
// ============================================

function buildDealerQuestionsV2(
  routine: MinimumViableRoutine,
  ownershipRisk: ReturnType<typeof computeOwnershipRisk>
): { top_3: string[]; full_list: string[]; walk_away_triggers: string[] } {
  const top_3: string[] = [];

  // Dynamic top 3 based on what's unknown or risky
  const unknownModules = ownershipRisk.modules.filter(m => m.status === "unknown");
  const redModules = ownershipRisk.modules.filter(m => m.status === "red");

  if (redModules.some(m => m.module_id === "battery") || unknownModules.some(m => m.module_id === "battery")) {
    top_3.push("Can you provide the current battery State of Health (SoH) percentage?");
  }
  if (redModules.some(m => m.module_id === "recall") || unknownModules.some(m => m.module_id === "recall")) {
    top_3.push("Are all manufacturer recalls completed?");
  }
  if (routine.charging_access !== "home") {
    top_3.push("What charging options are available at or near this location?");
  }

  // Fill to 3 if needed
  const defaults = [
    "Has the battery been replaced or serviced under warranty?",
    "What is the remaining manufacturer warranty coverage?",
    "Can I get a pre-purchase inspection by a certified EV technician?",
  ];
  while (top_3.length < 3) {
    const next = defaults.find(d => !top_3.includes(d));
    if (next) top_3.push(next);
    else break;
  }

  const full_list = [
    "Has the battery been replaced or serviced under warranty?",
    "Can you provide the current State of Health (SoH) percentage?",
    "Are all manufacturer recalls completed? Which ones remain?",
    "What is the remaining manufacturer warranty coverage?",
    "Has this vehicle been in any accidents or had flood damage?",
    "Can I get a pre-purchase inspection by a certified EV technician?",
    "What is the complete service history for this vehicle?",
  ];

  const walk_away_triggers = [
    "Battery State of Health (SoH) below 80%",
    "Any uncompleted safety recalls",
    "No documented service history available",
    "Seller refuses independent pre-purchase inspection",
    "Price significantly above market value",
    "Evidence of previous accident or flood damage",
    "Unusual battery degradation for vehicle age/mileage",
  ];

  return { top_3, full_list, walk_away_triggers };
}
