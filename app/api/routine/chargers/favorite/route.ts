/**
 * Charger Favorite API
 * POST /api/routine/chargers/favorite — Save/update a charger
 *
 * Deduplicates by external_id for the same user.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { logApi, startTimer } from "@/lib/api-logger";

const rateLimiter = new RateLimiter(15 * 60 * 1000, 50);

const VALID_CATEGORIES = ["anchor", "backup", "occasional"] as const;
const VALID_RELIABILITY = ["high", "medium", "low", "unknown"] as const;
const VALID_LEVEL_TYPES = ["L2", "DCFC", "unknown"] as const;

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
      charger_source,
      external_id,
      name,
      lat,
      lng,
      address,
      connector_types = [],
      max_power_kw,
      level_type = "unknown",
      category = "occasional",
      reliability_rating = "unknown",
      user_notes,
      is_favorite = false,
    } = body;

    // Validate required fields
    if (!anon_session_id) {
      return NextResponse.json(
        { success: false, error: "anon_session_id is required" },
        { status: 400 }
      );
    }
    if (!charger_source || !name) {
      return NextResponse.json(
        { success: false, error: "charger_source and name are required" },
        { status: 400 }
      );
    }
    if (lat === undefined || lng === undefined) {
      return NextResponse.json(
        { success: false, error: "lat and lng are required" },
        { status: 400 }
      );
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: "Invalid category" },
        { status: 400 }
      );
    }
    if (!VALID_RELIABILITY.includes(reliability_rating)) {
      return NextResponse.json(
        { success: false, error: "Invalid reliability_rating" },
        { status: 400 }
      );
    }
    if (!VALID_LEVEL_TYPES.includes(level_type)) {
      return NextResponse.json(
        { success: false, error: "Invalid level_type" },
        { status: 400 }
      );
    }

    // Deduplicate: check if this charger already saved by this user
    if (external_id) {
      const { data: existing } = await supabase
        .from("saved_chargers")
        .select("id")
        .eq("anon_session_id", anon_session_id)
        .eq("external_id", external_id)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update existing
        const { error: updateError } = await supabase
          .from("saved_chargers")
          .update({
            name,
            lat,
            lng,
            address: address || null,
            connector_types,
            max_power_kw: max_power_kw || null,
            level_type,
            category,
            reliability_rating,
            user_notes: user_notes || null,
            is_favorite,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", existing[0].id);

        if (updateError) {
          logApi("error", "Charger favorite update failed", {
            endpoint: "/api/routine/chargers/favorite",
            elapsed_ms: timer(),
            error_code: "db_update",
          });
          return NextResponse.json(
            { success: false, error: updateError.message },
            { status: 500 }
          );
        }

        logApi("info", "Charger favorite updated", {
          endpoint: "/api/routine/chargers/favorite",
          elapsed_ms: timer(),
          anon_id: anon_session_id,
        });

        return NextResponse.json({
          success: true,
          charger_id: existing[0].id,
          action: "updated",
        });
      }
    }

    // Insert new
    const { data, error } = await supabase
      .from("saved_chargers")
      .insert({
        anon_session_id,
        charger_source,
        external_id: external_id || null,
        name,
        lat,
        lng,
        address: address || null,
        connector_types,
        max_power_kw: max_power_kw || null,
        level_type,
        category,
        reliability_rating,
        user_notes: user_notes || null,
        is_favorite,
      })
      .select("id")
      .single();

    if (error) {
      logApi("error", "Charger favorite insert failed", {
        endpoint: "/api/routine/chargers/favorite",
        elapsed_ms: timer(),
        error_code: "db_insert",
      });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    logApi("info", "Charger favorite saved", {
      endpoint: "/api/routine/chargers/favorite",
      elapsed_ms: timer(),
      anon_id: anon_session_id,
    });

    return NextResponse.json({
      success: true,
      charger_id: data.id,
      action: "created",
    });
  } catch (error) {
    logApi("error", "Charger favorite error", {
      endpoint: "/api/routine/chargers/favorite",
      elapsed_ms: timer(),
      error_code: "unhandled",
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
