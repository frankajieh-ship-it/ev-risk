/**
 * List Saved Scenarios API
 * GET /api/user/scenario/list
 *
 * Returns user's saved scenarios with preview data.
 * Requires authentication via JWT verification using JWKS.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify, createRemoteJWKSet } from "jose";

// Hardcoded to bypass Netlify env var injection issue
const supabaseUrl = "https://acbxnfhcadvrjvftmbci.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjYnhuZmhjYWR2cmp2ZnRtYmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAyMzk3MywiZXhwIjoyMDg0NTk5OTczfQ.PHQGeDMD2R7RWBtZI9u_kfBCRReV4L5YWYnSrUabalo";

// JWKS endpoint for Supabase - used to verify ES256 signed JWTs
const JWKS_URL = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log("[Supabase] Missing URL or service key!");
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
    // Verify using JWKS (handles ES256 automatically)
    const { payload } = await jwtVerify(token, JWKS, {
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

export interface SavedScenarioPreview {
  id: string;
  scenario_hash: string;
  vehicle_model: string;
  vehicle_year: number;
  fit_signal: string | null;
  one_sentence_verdict: string | null;
  saved_at: string;
  last_viewed_at: string | null;
  is_comparison: boolean;
  notes: string | null;
  inputs: {
    zipCode?: string;
    dailyMiles?: number;
    homeCharging?: boolean;
    riskTolerance?: string;
  };
}

export async function GET(req: NextRequest) {
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
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get saved scenarios
    const { data: scenarios, error, count } = await supabase
      .from("saved_scenarios")
      .select(
        `
        id,
        scenario_hash,
        vehicle_model,
        vehicle_year,
        fit_signal,
        one_sentence_verdict,
        saved_at,
        last_viewed_at,
        is_comparison,
        notes,
        inputs
      `,
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Format response
    const formattedScenarios: SavedScenarioPreview[] = (scenarios || []).map((s) => ({
      id: s.id,
      scenario_hash: s.scenario_hash,
      vehicle_model: s.vehicle_model,
      vehicle_year: s.vehicle_year,
      fit_signal: s.fit_signal,
      one_sentence_verdict: s.one_sentence_verdict,
      saved_at: s.saved_at,
      last_viewed_at: s.last_viewed_at,
      is_comparison: s.is_comparison,
      notes: s.notes,
      inputs: {
        zipCode: s.inputs?.zipCode,
        dailyMiles: s.inputs?.dailyMiles,
        homeCharging: s.inputs?.homeCharging,
        riskTolerance: s.inputs?.riskTolerance,
      },
    }));

    return NextResponse.json({
      success: true,
      scenarios: formattedScenarios,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    });
  } catch (error) {
    console.error("List scenarios error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list scenarios",
      },
      { status: 500 }
    );
  }
}
