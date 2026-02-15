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
      receipt_id,
      scenario_type = "evroutine",
      scenario_hash,
      vehicle_model,
      vehicle_year,
      fit_signal,
      one_sentence_verdict,
      inputs,
      is_comparison = false,
      comparison_data,
      notes,
      title,
    } = body;

    // Validate scenario_type
    if (scenario_type !== "receipt" && scenario_type !== "evroutine") {
      return NextResponse.json(
        { success: false, error: "Invalid scenario_type. Must be 'receipt' or 'evroutine'" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!scenario_hash || !vehicle_model || !vehicle_year) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: scenario_hash, vehicle_model, vehicle_year" },
        { status: 400 }
      );
    }

    // Ensure user_profiles row exists (auto-create for users who signed up
    // before the migration or whose trigger didn't fire)
    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert(
        { id: user.id, email: user.email },
        { onConflict: "id", ignoreDuplicates: true }
      );

    if (profileError) {
      console.error("[Save Scenario] Failed to ensure user profile:", profileError.message);
    }

    // Validate reference ID based on scenario_type
    let validSessionId: string | null = null;
    let validReceiptId: string | null = null;

    if (scenario_type === "evroutine" && session_id) {
      // Validate session_id exists in evroutine_sessions (FK constraint)
      const { data: sessionRow } = await supabase
        .from("evroutine_sessions")
        .select("id")
        .eq("id", session_id)
        .maybeSingle();
      if (sessionRow) {
        validSessionId = session_id;
      }
    } else if (scenario_type === "receipt" && receipt_id) {
      // Validate receipt_id exists in receipts table
      const { data: receiptRow } = await supabase
        .from("receipts")
        .select("id")
        .eq("id", receipt_id)
        .maybeSingle();
      if (receiptRow) {
        validReceiptId = receipt_id;
      }
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
          notes: notes || undefined,
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
        session_id: validSessionId,
        receipt_id: validReceiptId,
        scenario_type,
        scenario_hash,
        vehicle_model,
        vehicle_year,
        fit_signal: fit_signal || null,
        one_sentence_verdict: one_sentence_verdict || null,
        inputs: inputs || {},
        is_comparison,
        comparison_data: comparison_data || null,
        notes: notes || null,
        title: title || null,
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
