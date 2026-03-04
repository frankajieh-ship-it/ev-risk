/**
 * Routine Run API
 * POST /api/routine/run — Execute routine scoring run
 *
 * Orchestrates:
 * 1. Fetch vehicle profile from DB (if vehicle_profile_id provided)
 * 2. Fetch weather via weather-client (fallback to inference)
 * 3. Search chargers via charger-client (if public charging + ZIP)
 * 4. Load saved chargers from DB
 * 5. Call computeRoutineFitV2()
 * 6. Call generatePlanB()
 * 7. Save routine_run + plan_b_card to DB
 * 8. Return: { run_id, fit_score, plan_b, weather_data, nearby_chargers }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { logApi, startTimer } from "@/lib/api-logger";
import { computeRoutineFitV2 } from "@/lib/compute-routine-fit-v2";
import { generatePlanB } from "@/lib/plan-b-algorithm";
import {
  getWeatherClient,
  inferWeatherFallback,
} from "@/lib/weather-client";
import { getChargerClient } from "@/lib/charger-client";
import type { MinimumViableRoutine } from "@/types/v2";
import type {
  VehicleProfile,
  WeatherData,
  ChargerSearchResult,
  SavedCharger,
} from "@/types/routine-v2";

const rateLimiter = new RateLimiter(15 * 60 * 1000, 30);

// Valid enum values
const VALID_CHARGING_ACCESS = ["home", "work", "public"] as const;
const VALID_CLIMATES = ["winter", "mild", "hot"] as const;
const VALID_LONGEST_DAY = ["once_a_week", "monthly_trip", "rare_road_trip"] as const;

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const ip = getClientIP(req);
  const limit = rateLimiter.check(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const timer = startTimer();

  try {
    const body = await req.json();
    const {
      profile_id,
      anon_session_id,
      // Routine fields (MinimumViableRoutine)
      charging_access,
      weekly_miles,
      commute_miles_roundtrip,
      climate,
      longest_day_pattern,
      // Optional enrichment
      vehicle_profile_id,
      home_location_zip,
      // Run config
      run_type = "baseline",
      scenario_name,
    } = body;

    // Validate required routine fields
    if (!charging_access || !VALID_CHARGING_ACCESS.includes(charging_access)) {
      return NextResponse.json(
        { success: false, error: "Invalid charging_access" },
        { status: 400 }
      );
    }
    if (!climate || !VALID_CLIMATES.includes(climate)) {
      return NextResponse.json(
        { success: false, error: "Invalid climate" },
        { status: 400 }
      );
    }
    if (!longest_day_pattern || !VALID_LONGEST_DAY.includes(longest_day_pattern)) {
      return NextResponse.json(
        { success: false, error: "Invalid longest_day_pattern" },
        { status: 400 }
      );
    }
    if (!weekly_miles && !commute_miles_roundtrip) {
      return NextResponse.json(
        { success: false, error: "weekly_miles or commute_miles_roundtrip required" },
        { status: 400 }
      );
    }

    // Build MVR
    const routine: MinimumViableRoutine = {
      charging_access,
      climate,
      longest_day_pattern,
      ...(weekly_miles && { weekly_miles }),
      ...(commute_miles_roundtrip && { commute_miles_roundtrip }),
    };

    // ============================
    // 1. Fetch vehicle profile
    // ============================
    let vehicle: VehicleProfile | undefined;
    if (vehicle_profile_id) {
      const { data: vp } = await supabase
        .from("vehicle_profiles")
        .select("*")
        .eq("id", vehicle_profile_id)
        .single();
      if (vp) vehicle = vp as VehicleProfile;
    }

    // ============================
    // 2. Fetch weather
    // ============================
    let weatherData: WeatherData | undefined;
    let weatherApiSuccess = false;

    const weatherClient = getWeatherClient();
    if (weatherClient && home_location_zip) {
      const result = await weatherClient.getWeatherByZip(home_location_zip, "US");
      if (result.success) {
        weatherData = result.data;
        weatherApiSuccess = true;
      }
    }
    if (!weatherData) {
      weatherData = inferWeatherFallback(climate, home_location_zip);
    }

    // ============================
    // 3. Search nearby chargers (public charging only)
    // ============================
    let nearbyChargers: ChargerSearchResult[] = [];
    let chargerApiSuccess = false;

    if (charging_access === "public" && home_location_zip) {
      const chargerClient = getChargerClient();
      if (chargerClient) {
        const connectorTypes = vehicle?.connector_types;
        const result = await chargerClient.searchByZip(home_location_zip, {
          radius_miles: 10,
          connector_types: connectorTypes,
        });
        if (result.success) {
          nearbyChargers = result.data;
          chargerApiSuccess = true;
        }
      }
    }

    // ============================
    // 4. Load saved chargers
    // ============================
    let savedChargers: SavedCharger[] = [];
    if (anon_session_id) {
      const { data: sc } = await supabase
        .from("saved_chargers")
        .select("*")
        .eq("anon_session_id", anon_session_id);
      if (sc) savedChargers = sc as SavedCharger[];
    }

    // ============================
    // 5. Compute routine fit
    // ============================
    const fitScore = computeRoutineFitV2({
      routine,
      vehicle,
      weather: weatherData,
      chargerCount: savedChargers.length + nearbyChargers.length,
    });

    // ============================
    // 6. Generate Plan B
    // ============================
    const topBreakpoint = fitScore.breakpoints_ranked[0];
    const planB = topBreakpoint
      ? generatePlanB({
          topBreakpoint,
          nearbyChargers,
          savedChargers,
          vehicleConnectorTypes: vehicle?.connector_types,
          routineType: charging_access,
        })
      : {
          plan_summary: "Your routine looks solid — no immediate backup plan needed.",
          mitigation_steps: [],
          buffer_rule: "Keep charge above 30% as a general rule",
          time_penalty_minutes: 0,
          stress_label: "minimal" as const,
          rank_score: 100,
        };

    // ============================
    // 7. Save run + plan B to DB
    // ============================
    const inputsJson = {
      routine,
      vehicle: vehicle || undefined,
      weather: weatherData || undefined,
      saved_chargers: savedChargers.length > 0 ? savedChargers : undefined,
    };

    const { data: runData, error: runError } = await supabase
      .from("routine_runs")
      .insert({
        profile_id: profile_id || null,
        run_type,
        scenario_name: scenario_name || null,
        inputs_json: inputsJson,
        outputs_json: fitScore,
        friction_score: fitScore.score_0_100,
        fit_label: fitScore.label,
        stress_level: fitScore.mental_load,
        break_first_id: fitScore.breakpoints_ranked[0]?.id || null,
        break_first_reason: fitScore.breakpoints_ranked[0]?.title || null,
        confidence_level: fitScore.confidence?.level || "medium",
        weather_api_success: weatherApiSuccess,
        charger_api_success: chargerApiSuccess,
      })
      .select("id")
      .single();

    if (runError) {
      logApi("error", "Routine run save failed", {
        endpoint: "/api/routine/run",
        elapsed_ms: timer(),
        error_code: "db_insert_run",
      });
      return NextResponse.json(
        { success: false, error: runError.message },
        { status: 500 }
      );
    }

    // Save Plan B card
    const { error: planBError } = await supabase
      .from("plan_b_cards")
      .insert({
        run_id: runData.id,
        charger_id: null,
        plan_summary: planB.plan_summary,
        anchor_charger_name: planB.anchor_charger_name || null,
        backup_charger_name: planB.backup_charger_name || null,
        time_penalty_minutes: planB.time_penalty_minutes,
        stress_label: planB.stress_label,
        mitigation_steps: planB.mitigation_steps,
        buffer_rule: planB.buffer_rule,
        rank_score: planB.rank_score,
      });

    if (planBError) {
      logApi("warn", "Plan B card save failed (run still saved)", {
        endpoint: "/api/routine/run",
        elapsed_ms: timer(),
        error_code: "db_insert_plan_b",
      });
    }

    // ============================
    // 8. Return response
    // ============================
    logApi("info", "Routine run completed", {
      endpoint: "/api/routine/run",
      elapsed_ms: timer(),
      anon_id: anon_session_id,
      friction_score: fitScore.score_0_100,
      fit_label: fitScore.label,
      weather_api: weatherApiSuccess,
      charger_api: chargerApiSuccess,
    });

    return NextResponse.json({
      success: true,
      run_id: runData.id,
      fit_score: fitScore,
      plan_b: planB,
      weather_data: weatherData,
      nearby_chargers: nearbyChargers,
    });
  } catch (error) {
    logApi("error", "Routine run error", {
      endpoint: "/api/routine/run",
      elapsed_ms: timer(),
      error_code: "unhandled",
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
