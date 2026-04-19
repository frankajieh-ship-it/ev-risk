/**
 * List Saved Scenarios API
 * GET /api/user/scenario/list
 *
 * Returns user's saved scenarios with preview data.
 * Requires authentication via Supabase auth.getUser().
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export interface SavedScenarioPreview {
  id: string;
  scenario_type: string;
  scenario_hash: string;
  receipt_id: string | null;
  vehicle_model: string;
  vehicle_year: number | null;
  fit_signal: string | null;
  one_sentence_verdict: string | null;
  title: string | null;
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
  const user = await getUserFromRequest(req, supabase);

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
    const typeFilter = searchParams.get("type") || "all";

    // Get saved scenarios
    let query = supabase
      .from("saved_scenarios")
      .select(
        `
        id,
        scenario_type,
        scenario_hash,
        receipt_id,
        vehicle_model,
        vehicle_year,
        fit_signal,
        one_sentence_verdict,
        title,
        saved_at,
        last_viewed_at,
        is_comparison,
        notes,
        inputs
      `,
        { count: "exact" }
      )
      .eq("user_id", user.id);

    // Apply type filter
    if (typeFilter === "receipt" || typeFilter === "evroutine") {
      query = query.eq("scenario_type", typeFilter);
    }

    const { data: scenarios, error, count } = await query
      .order("saved_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Format response
    type ScenarioRow = {
      id: string;
      scenario_type: string | null;
      scenario_hash: string;
      receipt_id: string | null;
      vehicle_model: string;
      vehicle_year: number | null;
      fit_signal: string | null;
      one_sentence_verdict: string | null;
      title: string | null;
      saved_at: string;
      last_viewed_at: string | null;
      is_comparison: boolean;
      notes: string | null;
      inputs: { zipCode?: string; dailyMiles?: number; homeCharging?: boolean; riskTolerance?: string } | null;
    };
    const formattedScenarios: SavedScenarioPreview[] = ((scenarios || []) as ScenarioRow[]).map((s) => ({
      id: s.id,
      scenario_type: s.scenario_type || "evroutine",
      scenario_hash: s.scenario_hash,
      receipt_id: s.receipt_id || null,
      vehicle_model: s.vehicle_model,
      vehicle_year: s.vehicle_year,
      fit_signal: s.fit_signal,
      one_sentence_verdict: s.one_sentence_verdict,
      title: s.title || null,
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
    const errorDetails = error instanceof Error
      ? { message: error.message, name: error.name }
      : typeof error === 'object' && error !== null
        ? error
        : { message: String(error) };
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list scenarios",
        debug: errorDetails,
      },
      { status: 500 }
    );
  }
}
