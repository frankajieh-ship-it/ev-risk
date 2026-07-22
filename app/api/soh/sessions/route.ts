/**
 * GET /api/soh/sessions?dealer_id=<uuid>&limit=50
 *
 * Returns recent SOH scan sessions for a dealer workspace.
 * Authenticated — caller must be a member of dealer_id.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getUserFromRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dealerId = searchParams.get("dealer_id");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  if (!dealerId) return NextResponse.json({ error: "dealer_id is required" }, { status: 400 });

  const { data: membership } = await supabase
    .from("dealer_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("dealership_id", dealerId)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "Not a member of this dealership" }, { status: 403 });

  const { data, error } = await supabase
    .from("soh_scan_sessions")
    .select(`
      id,
      vin,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      odometer_miles,
      pid_profile,
      status,
      created_at,
      battery_scan_id,
      battery_scans ( soh_percent, capacity_kwh, scanned_at )
    `)
    .eq("dealer_id", dealerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[soh/sessions] query error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }

  return NextResponse.json({ sessions: data ?? [] });
}
