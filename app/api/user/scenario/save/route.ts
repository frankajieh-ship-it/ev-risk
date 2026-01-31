/**
 * Save Scenario API
 * POST /api/user/scenario/save
 *
 * Saves a scenario to user's account for later reference.
 * Requires authentication via JWT verification using JWKS.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify, createRemoteJWKSet } from "jose";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// JWKS endpoint for Supabase - used to verify ES256 signed JWTs
// Lazily created to avoid issues with undefined env vars at module load
let JWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
  if (!JWKS && supabaseUrl) {
    JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return JWKS;
}

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
 * Extract user from Authorization header by verifying JWT using JWKS
 * Supabase uses ES256 algorithm which requires public key verification
 */
async function getUserFromRequest(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[Auth] No Bearer token in Authorization header");
    return null;
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const jwks = getJWKS();
    if (!jwks) {
      console.log("[Auth] JWKS not available - supabaseUrl not configured");
      return null;
    }
    // Verify using JWKS (handles ES256 automatically)
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${supabaseUrl}/auth/v1`,
    });

    if (!payload.sub) {
      console.log("[Auth] JWT missing sub claim");
      return null;
    }

    console.log("[Auth] JWT verified for:", payload.email);
    return {
      id: payload.sub as string,
      email: payload.email as string,
    };
  } catch (err) {
    console.error("[Auth] JWT verification failed:", err instanceof Error ? err.message : err);
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
  const user = await getUserFromRequest(req);

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
