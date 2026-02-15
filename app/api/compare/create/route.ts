/**
 * Compare Create API
 * POST /api/compare/create
 *
 * Creates a comparison between two scenarios (receipt or evroutine).
 * Requires authentication via Bearer token.
 * Persists results to the comparisons table for caching/retrieval.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  computeComparison,
  type StoredRoutineSession,
} from "@/lib/compare-computation";
import type { ListingReceipt } from "@/types/receipt";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getUserFromRequest(
  req: NextRequest,
  supabase: SupabaseClient
): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return { id: user.id };
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  // Auth
  const user = await getUserFromRequest(req, supabase);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  // Parse body
  let body: { scenario_type?: string; base_scenario_id?: string; compare_scenario_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { scenario_type, base_scenario_id, compare_scenario_id } = body;

  // Validate
  if (scenario_type !== "receipt" && scenario_type !== "evroutine") {
    return NextResponse.json(
      { success: false, error: "scenario_type must be 'receipt' or 'evroutine'" },
      { status: 400 }
    );
  }
  if (!base_scenario_id || !UUID_RE.test(base_scenario_id)) {
    return NextResponse.json(
      { success: false, error: "Invalid base_scenario_id" },
      { status: 400 }
    );
  }
  if (!compare_scenario_id || !UUID_RE.test(compare_scenario_id)) {
    return NextResponse.json(
      { success: false, error: "Invalid compare_scenario_id" },
      { status: 400 }
    );
  }
  if (base_scenario_id === compare_scenario_id) {
    return NextResponse.json(
      { success: false, error: "Cannot compare a scenario with itself" },
      { status: 400 }
    );
  }

  try {
    // Check for existing comparison (dedup)
    const { data: existing } = await supabase
      .from("comparisons")
      .select("id, comparison_result")
      .eq("scenario_type", scenario_type)
      .eq("base_scenario_id", base_scenario_id)
      .eq("compare_scenario_id", compare_scenario_id)
      .maybeSingle();

    if (existing?.comparison_result) {
      return NextResponse.json({
        success: true,
        comparison_id: existing.id,
        comparison_result: existing.comparison_result,
        was_cached: true,
      });
    }

    // Fetch scenario data
    let baseData: ListingReceipt | StoredRoutineSession;
    let compareData: ListingReceipt | StoredRoutineSession;

    if (scenario_type === "receipt") {
      const [baseRes, compareRes] = await Promise.all([
        supabase
          .from("receipts")
          .select("output_json")
          .eq("id", base_scenario_id)
          .maybeSingle(),
        supabase
          .from("receipts")
          .select("output_json")
          .eq("id", compare_scenario_id)
          .maybeSingle(),
      ]);

      if (!baseRes.data?.output_json) {
        return NextResponse.json(
          { success: false, error: "Base receipt not found" },
          { status: 404 }
        );
      }
      if (!compareRes.data?.output_json) {
        return NextResponse.json(
          { success: false, error: "Compare receipt not found" },
          { status: 404 }
        );
      }

      baseData = baseRes.data.output_json as ListingReceipt;
      compareData = compareRes.data.output_json as ListingReceipt;
    } else {
      // evroutine
      const cols =
        "id, fit_signal, fade_label, friction_bullets, why_not_100, risk_tags, inputs";

      const [baseRes, compareRes] = await Promise.all([
        supabase
          .from("evroutine_sessions")
          .select(cols)
          .eq("id", base_scenario_id)
          .maybeSingle(),
        supabase
          .from("evroutine_sessions")
          .select(cols)
          .eq("id", compare_scenario_id)
          .maybeSingle(),
      ]);

      if (!baseRes.data) {
        return NextResponse.json(
          { success: false, error: "Base evroutine session not found" },
          { status: 404 }
        );
      }
      if (!compareRes.data) {
        return NextResponse.json(
          { success: false, error: "Compare evroutine session not found" },
          { status: 404 }
        );
      }

      baseData = baseRes.data as StoredRoutineSession;
      compareData = compareRes.data as StoredRoutineSession;
    }

    // Compute comparison
    const comparison_result = computeComparison(
      scenario_type,
      baseData,
      compareData
    );

    // Persist (upsert)
    const { data: inserted, error: insertError } = await supabase
      .from("comparisons")
      .upsert(
        {
          user_id: user.id,
          scenario_type,
          base_scenario_id,
          compare_scenario_id,
          comparison_result,
        },
        { onConflict: "scenario_type,base_scenario_id,compare_scenario_id" }
      )
      .select("id")
      .single();

    if (insertError) {
      console.error("[Compare] Insert error:", insertError.message);
      return NextResponse.json(
        { success: false, error: "Failed to save comparison" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      comparison_id: inserted.id,
      comparison_result,
      was_cached: false,
    });
  } catch (err) {
    console.error(
      "[Compare] Error:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
