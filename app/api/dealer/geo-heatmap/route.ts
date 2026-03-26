/**
 * GET /api/dealer/geo-heatmap
 *
 * Returns metro-level aggregated demand counts for the dealer heat map.
 * Filtered to the last 30 days. Protected by dealer role.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 15;

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

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch high-intent events with geo data in last 30d
  const { data: events, error } = await supabase
    .from("user_events")
    .select("geo_metro, geo_state, geo_lat, geo_lon")
    .in("event_name", ["routine_result_viewed", "report_view", "receipt_generate", "evfit_completed"])
    .gte("timestamp", since30d)
    .not("geo_metro", "is", null)
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate counts per metro
  const metroMap = new Map<
    string,
    { metro: string; state: string; lat: number; lon: number; count: number }
  >();

  for (const ev of events || []) {
    if (!ev.geo_metro || ev.geo_lat == null || ev.geo_lon == null) continue;
    if (!metroMap.has(ev.geo_metro)) {
      metroMap.set(ev.geo_metro, {
        metro: ev.geo_metro,
        state: ev.geo_state || "",
        lat: Number(ev.geo_lat),
        lon: Number(ev.geo_lon),
        count: 0,
      });
    }
    metroMap.get(ev.geo_metro)!.count++;
  }

  const points: HeatmapPoint[] = Array.from(metroMap.values()).sort(
    (a, b) => b.count - a.count
  );

  return NextResponse.json({ points });
}
