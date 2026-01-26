/**
 * Session Complete API
 * POST /api/session/complete
 *
 * Called when form is submitted and results are computed.
 * Stores inputs, engine outputs, and timing data.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isValidSessionId } from "@/lib/session-utils";
import {
  generateScenarioFingerprint,
  generateSummaryId,
  getEngineVersion,
} from "@/lib/scenario-fingerprint";

export async function POST(req: NextRequest) {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Session tracking not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const {
      session_id,
      inputs,
      fit_signal,
      fade_label,
      friction_bullets = [],
      why_not_100 = [],
      risk_tags = [],
      // P0/P1: New seasonal & predictability fields
      climate_seasonality,
      winter_long_days,
      parked_outside,
      seasonal_sensitivity,
      seasonal_trigger_tags = [],
      charging_anchor_type,
      backup_option,
      public_anchor_reliability,
      predictability_level,
      planning_tolerance,
    } = body;

    // Validate session ID
    if (!isValidSessionId(session_id)) {
      return NextResponse.json(
        { success: false, error: "Invalid session_id" },
        { status: 400 }
      );
    }

    // Generate scenario fingerprint for IP tracking
    let scenarioFingerprint: string | null = null;
    let summaryId: string | null = null;
    let isNovelScenario = false;
    const engineVersion = getEngineVersion();

    if (inputs?.model && inputs?.year && inputs?.zipCode) {
      scenarioFingerprint = generateScenarioFingerprint({
        model: inputs.model,
        year: inputs.year,
        dailyMiles: inputs.dailyMiles || 30,
        zipCode: inputs.zipCode,
        homeCharging: inputs.homeCharging ?? true,
        riskTolerance: inputs.riskTolerance || "moderate",
        constraintMultiplier: inputs.constraintMultiplier,
      });
      summaryId = generateSummaryId();

      // Check if this is a novel scenario (first occurrence)
      const { data: existing } = await supabase
        .from("evroutine_sessions")
        .select("id")
        .eq("scenario_fingerprint", scenarioFingerprint)
        .limit(1);

      isNovelScenario = !existing || existing.length === 0;
    }

    // Update session with completion data
    const { error } = await supabase
      .from("evroutine_sessions")
      .update({
        inputs: inputs || {},
        fit_signal: fit_signal || null,
        fade_label: fade_label || null,
        friction_bullets: friction_bullets,
        why_not_100: why_not_100,
        risk_tags: risk_tags,
        completed_at: new Date().toISOString(),
        // P0/P1: New seasonal & predictability fields
        climate_seasonality: climate_seasonality || null,
        winter_long_days: winter_long_days || null,
        parked_outside: parked_outside || null,
        seasonal_sensitivity: seasonal_sensitivity || null,
        seasonal_trigger_tags: seasonal_trigger_tags,
        charging_anchor_type: charging_anchor_type || null,
        backup_option: backup_option || null,
        public_anchor_reliability: public_anchor_reliability || null,
        predictability_level: predictability_level || null,
        planning_tolerance: planning_tolerance || null,
        // IP Defensibility: Scenario fingerprinting
        scenario_fingerprint: scenarioFingerprint,
        summary_id: summaryId,
        engine_version: engineVersion,
        is_novel_scenario: isNovelScenario,
      })
      .eq("id", session_id)
      .select("id")
      .single();

    if (error) {
      console.error("Supabase error:", error);
      // Check if it's a "not found" type error
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Session not found" },
          { status: 404 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      message: "Session completed",
    });
  } catch (error) {
    console.error("Session complete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to complete session",
      },
      { status: 500 }
    );
  }
}
