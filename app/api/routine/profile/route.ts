/**
 * Routine Profile API
 * POST /api/routine/profile — Create routine profile
 * GET  /api/routine/profile?anon_session_id=xxx — Fetch user's profiles
 * PATCH /api/routine/profile — Update profile by profile_id
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { logApi, startTimer } from "@/lib/api-logger";

const rateLimiter = new RateLimiter(15 * 60 * 1000, 50);

// Valid enum values for validation
const VALID_CLIMATE_BANDS = ["winter", "mild", "hot"] as const;
const VALID_HOME_CHARGING = ["home", "work", "public"] as const;
const VALID_LONGEST_DAY = ["once_a_week", "monthly_trip", "rare_road_trip"] as const;
const VALID_REGIONS = ["US", "UK"] as const;

// ============================================
// POST — Create routine profile
// ============================================

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
      anon_session_id,
      home_location_zip,
      work_location_zip,
      region = "US",
      climate_band,
      climate_auto_detected = false,
      home_charging,
      vehicle_profile_id,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      weekly_miles,
      commute_miles_roundtrip,
      longest_day_pattern,
      shared_charger = false,
      // Questionnaire v2 — buyer context fields
      ev_experience,
      vehicle_condition,
      has_backup_vehicle,
      ownership_timeline,
      charging_stop_tolerance,
      priority_weights,
    } = body;

    // Validate required fields
    if (!anon_session_id) {
      return NextResponse.json(
        { success: false, error: "anon_session_id is required" },
        { status: 400 }
      );
    }

    if (!climate_band || !VALID_CLIMATE_BANDS.includes(climate_band)) {
      return NextResponse.json(
        { success: false, error: "Invalid climate_band" },
        { status: 400 }
      );
    }

    if (!home_charging || !VALID_HOME_CHARGING.includes(home_charging)) {
      return NextResponse.json(
        { success: false, error: "Invalid home_charging" },
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

    if (region && !VALID_REGIONS.includes(region)) {
      return NextResponse.json(
        { success: false, error: "Invalid region" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("routine_profiles")
      .insert({
        anon_session_id,
        home_location_zip: home_location_zip || null,
        work_location_zip: work_location_zip || null,
        region,
        climate_band,
        climate_auto_detected,
        home_charging,
        vehicle_profile_id: vehicle_profile_id || null,
        vehicle_year: vehicle_year || null,
        vehicle_make: vehicle_make || null,
        vehicle_model: vehicle_model || null,
        weekly_miles: weekly_miles || null,
        commute_miles_roundtrip: commute_miles_roundtrip || null,
        longest_day_pattern,
        shared_charger,
        // Questionnaire v2 fields
        ev_experience: ev_experience || null,
        vehicle_condition: vehicle_condition || null,
        has_backup_vehicle: has_backup_vehicle || null,
        ownership_timeline: ownership_timeline || null,
        charging_stop_tolerance: charging_stop_tolerance || null,
        priority_weights: priority_weights || null,
      })
      .select("id")
      .single();

    if (error) {
      logApi("error", "Routine profile create failed", {
        endpoint: "/api/routine/profile",
        elapsed_ms: timer(),
        error_code: "db_insert",
      });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    logApi("info", "Routine profile created", {
      endpoint: "/api/routine/profile",
      elapsed_ms: timer(),
      anon_id: anon_session_id,
    });

    // Server-side event: not blocked by ad blockers — mirrors client profile_created
    supabase.from("user_events").insert({
      event_name: "profile_created_server",
      event_data: {
        profile_id: data.id,
        anon_session_id: anon_session_id || null,
        has_zip: !!home_location_zip,
        climate_band,
        home_charging,
        has_vehicle: !!(vehicle_profile_id || vehicle_make),
        flow: "evfit",
        step: "save",
      },
      page_path: "/api/routine/profile",
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});

    return NextResponse.json({
      success: true,
      profile_id: data.id,
    });
  } catch (error) {
    logApi("error", "Routine profile error", {
      endpoint: "/api/routine/profile",
      elapsed_ms: timer(),
      error_code: "unhandled",
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ============================================
// GET — Fetch user's profiles
// ============================================

export async function GET(req: NextRequest) {
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

  try {
    const { searchParams } = new URL(req.url);
    const anonSessionId = searchParams.get("anon_session_id");

    if (!anonSessionId) {
      return NextResponse.json(
        { success: false, error: "anon_session_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("routine_profiles")
      .select("*")
      .eq("anon_session_id", anonSessionId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profiles: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH — Update profile
// ============================================

export async function PATCH(req: NextRequest) {
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
    const { profile_id, anon_session_id, ...updates } = body;

    if (!profile_id || !anon_session_id) {
      return NextResponse.json(
        { success: false, error: "profile_id and anon_session_id are required" },
        { status: 400 }
      );
    }

    // Validate enum fields if provided
    if (updates.climate_band && !VALID_CLIMATE_BANDS.includes(updates.climate_band)) {
      return NextResponse.json(
        { success: false, error: "Invalid climate_band" },
        { status: 400 }
      );
    }
    if (updates.home_charging && !VALID_HOME_CHARGING.includes(updates.home_charging)) {
      return NextResponse.json(
        { success: false, error: "Invalid home_charging" },
        { status: 400 }
      );
    }
    if (updates.longest_day_pattern && !VALID_LONGEST_DAY.includes(updates.longest_day_pattern)) {
      return NextResponse.json(
        { success: false, error: "Invalid longest_day_pattern" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("routine_profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", profile_id)
      .eq("anon_session_id", anon_session_id);

    if (error) {
      logApi("error", "Routine profile update failed", {
        endpoint: "/api/routine/profile",
        elapsed_ms: timer(),
        error_code: "db_update",
      });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    logApi("info", "Routine profile updated", {
      endpoint: "/api/routine/profile",
      elapsed_ms: timer(),
      anon_id: anon_session_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logApi("error", "Routine profile patch error", {
      endpoint: "/api/routine/profile",
      elapsed_ms: timer(),
      error_code: "unhandled",
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
