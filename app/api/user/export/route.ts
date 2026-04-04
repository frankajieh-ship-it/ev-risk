/**
 * GET /api/user/export
 *
 * GDPR Article 20 — Right to Data Portability.
 *
 * Returns a JSON document containing all user-owned data:
 * - Profile
 * - Receipts (input + output JSON)
 * - Garage vehicles
 * - Routine runs + profiles
 * - Compare sessions
 * - Deal watch searches
 * - Purchases
 * - Saved scenarios
 *
 * The response is served as a downloadable JSON file.
 * Rate-limited to 3 exports per 24h per user (stored in-memory; acceptable
 * because this is a low-frequency operation and the limiter resets on deploy).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

// Simple in-memory throttle: userId → last export timestamp[]
const exportThrottle = new Map<string, number[]>();
const MAX_EXPORTS_PER_DAY = 3;

function checkExportThrottle(userId: string): boolean {
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  const timestamps = (exportThrottle.get(userId) ?? []).filter(
    (t) => now - t < windowMs
  );
  if (timestamps.length >= MAX_EXPORTS_PER_DAY) return false;
  exportThrottle.set(userId, [...timestamps, now]);
  return true;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id: userId } = auth;

  if (!checkExportThrottle(userId)) {
    return NextResponse.json(
      { error: "Export limit reached. You can export up to 3 times per 24 hours." },
      { status: 429 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Fetch all user-owned data in parallel
  const [
    profileResult,
    receiptsResult,
    garageResult,
    routineRunsResult,
    routineProfilesResult,
    compareResult,
    dealWatchResult,
    purchasesResult,
    savedScenariosResult,
  ] = await Promise.allSettled([
    supabase
      .from("user_profiles")
      .select("display_name, charging_access, weekly_miles, notifications_enabled, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("receipts")
      .select("id, created_at, listing_url, listing_text, input_json, output_json, source, is_pro")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("garage_vehicles")
      .select("id, created_at, make, model, year, trim, mileage, purchase_price, notes")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("routine_runs")
      .select("id, created_at, input_json, output_json")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("routine_profiles")
      .select("id, created_at, profile_json")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("compare_sessions")
      .select("id, created_at, vehicle_a_id, vehicle_b_id, result_json")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("deal_watch_searches")
      .select("id, created_at, make, model, year_min, year_max, max_price, zip_code, is_active")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("purchases")
      .select("purchase_id, created_at, status, scenario_type, amount, currency, stripe_session_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_scenarios")
      .select("id, created_at, scenario_json")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const getValue = <T>(result: PromiseSettledResult<{ data: T | null; error: unknown }>) =>
    result.status === "fulfilled" ? (result.value.data ?? null) : null;

  const exportPayload = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    email: auth.email,
    profile: getValue(profileResult),
    receipts: getValue(receiptsResult) ?? [],
    garage_vehicles: getValue(garageResult) ?? [],
    routine_runs: getValue(routineRunsResult) ?? [],
    routine_profiles: getValue(routineProfilesResult) ?? [],
    compare_sessions: getValue(compareResult) ?? [],
    deal_watch_searches: getValue(dealWatchResult) ?? [],
    purchases: getValue(purchasesResult) ?? [],
    saved_scenarios: getValue(savedScenariosResult) ?? [],
  };

  const filename = `offo-data-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
