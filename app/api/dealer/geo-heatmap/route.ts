/**
 * GET /api/dealer/geo-heatmap
 *
 * Returns metro-level aggregated demand counts for the dealer heat map.
 * Filtered to last 30 days. Protected by dealer role.
 *
 * Privacy rules (Step 12 fix):
 *  - Only shows demand from users who researched vehicles matching THIS dealer's inventory
 *  - Metro areas with fewer than 5 unique buyers are suppressed (MIN_BUYERS_PER_METRO)
 *  - Returns metro + state + lat/lon for map centering only — no exact household coords
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 15;

const MIN_BUYERS_PER_METRO = 5;

export interface HeatmapPoint {
  metro: string;
  state: string;
  lat: number;
  lon: number;
  count: number;
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

  // Step 1: Fetch this dealer's active inventory (make + model)
  const { data: inventory } = await supabase
    .from("dealer_inventory")
    .select("make, model")
    .eq("dealership_id", dealershipId)
    .eq("status", "active");

  if (!inventory?.length) {
    return NextResponse.json({ points: [] });
  }

  const inventoryPairs = inventory.map((i) => ({
    make: i.make.toLowerCase().trim(),
    model: i.model.toLowerCase().trim(),
  }));

  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // Step 2: Find user_ids who researched matching vehicles via garage_vehicles
  const { data: garageVehicles } = await supabase
    .from("garage_vehicles")
    .select("user_id, make, model")
    .gte("created_at", since60d)
    .not("user_id", "is", null)
    .limit(1000);

  const matchingUserIds = new Set<string>();
  for (const gv of garageVehicles || []) {
    const gvMake = gv.make.toLowerCase().trim();
    const gvModel = gv.model.toLowerCase().trim();
    if (
      inventoryPairs.some(
        (inv) => inv.make === gvMake && gvModel.includes(inv.model)
      )
    ) {
      matchingUserIds.add(gv.user_id);
    }
  }

  if (matchingUserIds.size === 0) {
    return NextResponse.json({ points: [] });
  }

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Step 3: Fetch high-intent events for matched users with geo data
  const { data: events, error } = await supabase
    .from("user_events")
    .select("geo_metro, geo_state, geo_lat, geo_lon, user_id")
    .in("event_name", ["routine_result_viewed", "report_view", "receipt_generate", "evfit_completed"])
    .in("user_id", [...matchingUserIds].slice(0, 500))  // Supabase IN limit guard
    .gte("timestamp", since30d)
    .not("geo_metro", "is", null)
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Step 4: Aggregate by metro, track unique buyer count per metro
  const metroMap = new Map<
    string,
    { metro: string; state: string; lat: number; lon: number; userIds: Set<string> }
  >();

  for (const ev of events || []) {
    if (!ev.geo_metro || ev.geo_lat == null || ev.geo_lon == null) continue;
    if (!metroMap.has(ev.geo_metro)) {
      metroMap.set(ev.geo_metro, {
        metro: ev.geo_metro,
        state: ev.geo_state || "",
        lat: Number(ev.geo_lat),
        lon: Number(ev.geo_lon),
        userIds: new Set(),
      });
    }
    if (ev.user_id) {
      metroMap.get(ev.geo_metro)!.userIds.add(ev.user_id);
    }
  }

  // Step 5: Suppress metros below MIN_BUYERS_PER_METRO threshold
  const points: HeatmapPoint[] = [];
  for (const entry of metroMap.values()) {
    if (entry.userIds.size < MIN_BUYERS_PER_METRO) continue; // privacy threshold
    points.push({
      metro: entry.metro,
      state: entry.state,
      lat: entry.lat,
      lon: entry.lon,
      count: entry.userIds.size,
    });
  }

  points.sort((a, b) => b.count - a.count);

  return NextResponse.json({ points });
}
