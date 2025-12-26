/**
 * EV-Risk™ Score API Route
 *
 * POST /api/score
 * Body: { model, year, zipCode, dailyMiles, homeCharging, riskTolerance }
 * Returns: BuyConfidence score
 */

import { NextRequest, NextResponse } from "next/server";
import { calculateBuyConfidence, generateRiskBreakdown, type ScoringInput } from "@/lib/scoring";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const { model, year, currentMileage, zipCode, dailyMiles, homeCharging, riskTolerance } = body;

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
    };

    // Calculate score
    const confidence = calculateBuyConfidence(scoringInput);
    const breakdown = generateRiskBreakdown(confidence);

    // Return response
    return NextResponse.json({
      success: true,
      input: scoringInput,
      confidence,
      breakdown,
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
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
