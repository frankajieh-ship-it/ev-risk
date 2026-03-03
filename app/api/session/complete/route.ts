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

    // Build update payload — only include fields that were actually provided
    // so a second call (e.g. to write back fit_signal) doesn't overwrite inputs
    const updatePayload: Record<string, unknown> = {
      completed_at: new Date().toISOString(),
    };

    if (inputs && Object.keys(inputs).length > 0) updatePayload.inputs = inputs;
    if (fit_signal) updatePayload.fit_signal = fit_signal;
    if (fade_label) updatePayload.fade_label = fade_label;
    if (friction_bullets.length > 0) updatePayload.friction_bullets = friction_bullets;
    if (why_not_100.length > 0) updatePayload.why_not_100 = why_not_100;
    if (risk_tags.length > 0) updatePayload.risk_tags = risk_tags;

    // P0/P1: New seasonal & predictability fields
    if (climate_seasonality) updatePayload.climate_seasonality = climate_seasonality;
    if (winter_long_days) updatePayload.winter_long_days = winter_long_days;
    if (parked_outside) updatePayload.parked_outside = parked_outside;
    if (seasonal_sensitivity) updatePayload.seasonal_sensitivity = seasonal_sensitivity;
    if (seasonal_trigger_tags.length > 0) updatePayload.seasonal_trigger_tags = seasonal_trigger_tags;
    if (charging_anchor_type) updatePayload.charging_anchor_type = charging_anchor_type;
    if (backup_option) updatePayload.backup_option = backup_option;
    if (public_anchor_reliability) updatePayload.public_anchor_reliability = public_anchor_reliability;
    if (predictability_level) updatePayload.predictability_level = predictability_level;
    if (planning_tolerance) updatePayload.planning_tolerance = planning_tolerance;

    // IP Defensibility: Scenario fingerprinting
    if (scenarioFingerprint) updatePayload.scenario_fingerprint = scenarioFingerprint;
    if (summaryId) updatePayload.summary_id = summaryId;
    updatePayload.engine_version = engineVersion;
    if (isNovelScenario) updatePayload.is_novel_scenario = isNovelScenario;

    // Update session with completion data
    const { error } = await supabase
      .from("evroutine_sessions")
      .update(updatePayload)
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
