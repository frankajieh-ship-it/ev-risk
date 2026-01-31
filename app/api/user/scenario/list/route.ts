/**
 * List Saved Scenarios API
 * GET /api/user/scenario/list
 *
 * Returns user's saved scenarios with preview data.
 * Requires authentication via JWT verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

// Hardcoded to bypass Netlify env var injection issue
const supabaseUrl = "https://acbxnfhcadvrjvftmbci.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjYnhuZmhjYWR2cmp2ZnRtYmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAyMzk3MywiZXhwIjoyMDg0NTk5OTczfQ.PHQGeDMD2R7RWBtZI9u_kfBCRReV4L5YWYnSrUabalo";

// JWT secret from Supabase Dashboard → Settings → API
// Hardcoded fallback to bypass Netlify env var injection issue
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "O3m/kwp46lTWMyZuYGOoFvzJodqyZ/CkfCxnRgc1YgMi9wF/jnPc+mmGWuvRnsDNpnCMLrTjOohJ8rtd6Vlryg==";

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
 * Extract user from Authorization header by verifying JWT directly
 * Returns user object on success, or debug info object on failure
 */
async function getUserFromRequest(req: NextRequest): Promise<{ id: string; email: string } | { debugInfo: Record<string, unknown> }> {
  const authHeader = req.headers.get("authorization");
  const debugInfo: Record<string, unknown> = {
    authHeaderPresent: !!authHeader,
    authHeaderStartsWithBearer: authHeader?.startsWith("Bearer ") || false,
    jwtSecretLoaded: !!SUPABASE_JWT_SECRET,
    jwtSecretFirst20: SUPABASE_JWT_SECRET?.substring(0, 20) || "NOT_LOADED",
  };

  if (!authHeader?.startsWith("Bearer ")) {
    debugInfo.failReason = "No Bearer token in Authorization header";
    debugInfo.authHeaderValue = authHeader || "null";
    return { debugInfo };
  }

  const token = authHeader.replace("Bearer ", "");
  debugInfo.tokenLength = token.length;
  debugInfo.tokenFirst50 = token.substring(0, 50);

  if (!SUPABASE_JWT_SECRET) {
    debugInfo.failReason = "SUPABASE_JWT_SECRET not configured";
    return { debugInfo };
  }

  try {
    const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    if (!payload.sub) {
      debugInfo.failReason = "JWT missing sub claim";
      debugInfo.payload = payload;
      return { debugInfo };
    }

    // Success - return user
    return {
      id: payload.sub as string,
      email: payload.email as string,
    };
  } catch (err) {
    debugInfo.failReason = "JWT verification failed";
    debugInfo.errorMessage = err instanceof Error ? err.message : String(err);
    debugInfo.errorName = err instanceof Error ? err.name : "Unknown";
    return { debugInfo };
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
  const authResult = await getUserFromRequest(req);

  // Check if auth failed (returns debugInfo instead of user)
  if ("debugInfo" in authResult) {
    return NextResponse.json(
      { success: false, error: "Authentication required", debug: authResult.debugInfo },
      { status: 401 }
    );
  }

  const user = authResult;

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
