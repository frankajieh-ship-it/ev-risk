/**
 * Recall API
 *
 * GET /api/recalls                   — all active recalls for the authenticated user
 * GET /api/recalls?vehicle_id=<uuid> — recalls for a specific garage vehicle
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const vehicleId = req.nextUrl.searchParams.get("vehicle_id");

  let query = supabase
    .from("vehicle_recalls")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("routine_impact_score", { ascending: false });

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    recalls: data || [],
    count: (data || []).length,
  });
}
