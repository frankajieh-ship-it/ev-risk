/**
 * Save Scenario API
 * POST /api/user/scenario/save
 *
 * Saves a scenario to user's account for later reference.
 * Requires authentication via Supabase auth.getUser().
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extract user from Authorization header using Supabase auth.getUser()
 */
async function getUserFromRequest(
  req: NextRequest,
  supabase: SupabaseClient
): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[Auth] No Bearer token in Authorization header");
    return null;
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log("[Auth] Token verification failed:", error?.message);
      return null;
    }

    console.log("[Auth] User verified:", user.email);
    return {
      id: user.id,
      email: user.email || "",
    };
  } catch (err) {
    console.error("[Auth] Error verifying token:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  // Get authenticated user
  const user = await getUserFromRequest(req, supabase);

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const {
      session_id,
      scenario_hash,
      vehicle_model,
      vehicle_year,
      fit_signal,
      one_sentence_verdict,
      inputs,
      is_comparison = false,
      comparison_data,
      notes,
    } = body;

    // Validate required fields
    if (!scenario_hash || !vehicle_model || !vehicle_year) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: scenario_hash, vehicle_model, vehicle_year" },
        { status: 400 }
      );
    }

    // Check if scenario already saved by this user
    const { data: existing } = await supabase
      .from("saved_scenarios")
      .select("id")
      .eq("user_id", user.id)
      .eq("scenario_hash", scenario_hash)
      .single();

    if (existing) {
      // Update last_viewed_at instead of creating duplicate
      const { error: updateError } = await supabase
        .from("saved_scenarios")
        .update({
          last_viewed_at: new Date().toISOString(),
          notes: notes || undefined, // Update notes if provided
        })
        .eq("id", existing.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        message: "Scenario already saved, updated last viewed",
        scenario_id: existing.id,
        is_new: false,
      });
    }

    // Insert new saved scenario
    const { data: savedScenario, error: insertError } = await supabase
      .from("saved_scenarios")
      .insert({
        user_id: user.id,
        session_id: session_id || null,
        scenario_hash,
        vehicle_model,
        vehicle_year,
        fit_signal: fit_signal || null,
        one_sentence_verdict: one_sentence_verdict || null,
        inputs: inputs || {},
        is_comparison,
        comparison_data: comparison_data || null,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Save scenario error:", insertError);
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      message: "Scenario saved successfully",
      scenario_id: savedScenario.id,
      is_new: true,
    });
  } catch (error) {
    console.error("Save scenario error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save scenario",
      },
      { status: 500 }
    );
  }
}
