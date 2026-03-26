/**
 * GET /api/dealer/buyer-profiles
 *
 * Returns anonymized buyer profiles: users who saved or researched a vehicle
 * matching this dealer's active inventory. No PII is returned.
 * Protected by dealer_admin or dealer_user role.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";
import { createHash } from "crypto";

export const maxDuration = 15;

export interface BuyerProfile {
  profile_id: string;       // sha256(user_id + dealership_id) — stable, non-reversible
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  home_charging: boolean | null;
  weekly_miles: number | null;
  fit_score: number | null;
  geo_metro: string | null;
  researched_at: string;
}

function anonymize(userId: string, dealershipId: string): string {
  return createHash("sha256")
    .update(`${userId}:${dealershipId}`)
    .digest("hex")
    .slice(0, 16);
}

export async function GET(req: NextRequest) {
  const authResult = await requireRole(req, "dealer_admin", "dealer_user");
  if (authResult instanceof NextResponse) return authResult;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const dealershipId = await getDealershipId(authResult.id);
  if (!dealershipId) {
    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
  }

  // Fetch active inventory for this dealership (make + model list)
  const { data: inventory } = await supabase
    .from("dealer_inventory")
    .select("make, model")
    .eq("dealership_id", dealershipId)
    .eq("status", "active");

  if (!inventory?.length) {
    return NextResponse.json({ profiles: [] });
  }

  const inventoryPairs = inventory.map((i) => ({
    make: i.make.toLowerCase().trim(),
    model: i.model.toLowerCase().trim(),
  }));

  // Fetch saved scenarios linked to garage vehicles (with user_id for hashing)
  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: scenarios } = await supabase
    .from("saved_scenarios")
    .select("user_id, scenario_data, created_at")
    .gte("created_at", since60d)
    .not("user_id", "is", null)
    .limit(500);

  // Fetch garage vehicles for matching
  const { data: garageVehicles } = await supabase
    .from("garage_vehicles")
    .select("user_id, make, model, year, created_at")
    .gte("created_at", since60d)
    .not("user_id", "is", null)
    .limit(500);

  const profiles: BuyerProfile[] = [];

  // Match garage vehicles to dealer inventory
  for (const gv of garageVehicles || []) {
    const gvMake = gv.make.toLowerCase().trim();
    const gvModel = gv.model.toLowerCase().trim();
    const matches = inventoryPairs.some(
      (inv) => inv.make === gvMake && gvModel.includes(inv.model)
    );
    if (!matches) continue;

    // Find associated scenario for fit_score / routine data
    const scenario = (scenarios || []).find((s) => s.user_id === gv.user_id);
    const sd = scenario?.scenario_data || {};

    profiles.push({
      profile_id: anonymize(gv.user_id, dealershipId),
      vehicle_make: gv.make,
      vehicle_model: gv.model,
      vehicle_year: gv.year ?? null,
      home_charging: sd.home_charging ?? null,
      weekly_miles: sd.weekly_miles ?? null,
      fit_score: sd.fit_score ?? null,
      geo_metro: null, // not stored on garage_vehicles — enriched in future phase
      researched_at: gv.created_at,
    });
  }

  // Deduplicate by profile_id + make + model
  const seen = new Set<string>();
  const unique = profiles.filter((p) => {
    const key = `${p.profile_id}|${p.vehicle_make}|${p.vehicle_model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by most recent
  unique.sort(
    (a, b) =>
      new Date(b.researched_at).getTime() - new Date(a.researched_at).getTime()
  );

  return NextResponse.json({ profiles: unique.slice(0, 50) });
}
