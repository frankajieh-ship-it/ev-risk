/**
 * GET /api/dealer/dashboard
 *
 * Returns aggregated KPIs and top-model demand for the authenticated
 * dealer's geographic area. Protected by dealer_admin or dealer_user role.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";
import { getInventoryMatches } from "@/lib/dealer-match";
import { audit } from "@/lib/audit-logger";

export const maxDuration = 15;

/** Format a delta as "+N" / "-N" / null when insufficient data. */
function formatCountDelta(current: number, prior: number): string | null {
  if (prior === 0 && current === 0) return null;
  const diff = current - prior;
  return diff >= 0 ? `+${diff} vs last week` : `${diff} vs last week`;
}

/** Format a view-count delta as a percentage string, or null. */
function formatPctDelta(current: number, prior: number): string | null {
  if (prior === 0) return null;
  const pct = Math.round(((current - prior) / prior) * 100);
  return pct >= 0 ? `+${pct}% vs last week` : `${pct}% vs last week`;
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

  // Fetch dealership meta (city/state for metro label + subscription info)
  const { data: dealership } = await supabase
    .from("dealerships")
    .select("id, name, city, state, subscription_tier, subscription_status")
    .eq("id", dealershipId)
    .single();

  const metro = dealership?.city && dealership?.state
    ? `${dealership.city}, ${dealership.state}`
    : null;

  const now = new Date();
  const since7d  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString();
  const since14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Run all queries in parallel
  const [
    highIntentResult,
    highIntentPriorResult,
    topModelsResult,
    funnelViewsResult,
    funnelViewsPriorResult,
    funnelReportsResult,
    funnelReceiptsResult,
    avgDaysResult,
    inventoryCountResult,
  ] = await Promise.allSettled([
    // 1. Weekly high-intent views in dealer metro (current 7d)
    supabase
      .from("user_events")
      .select("id", { count: "exact", head: true })
      .in("event_name", ["routine_result_viewed", "report_view", "receipt_generate"])
      .gte("timestamp", since7d)
      .eq("geo_metro", metro || ""),

    // 2. Weekly high-intent views — prior 7d (for delta)
    supabase
      .from("user_events")
      .select("id", { count: "exact", head: true })
      .in("event_name", ["routine_result_viewed", "report_view", "receipt_generate"])
      .gte("timestamp", since14d)
      .lt("timestamp", since7d)
      .eq("geo_metro", metro || ""),

    // 3. Top 5 models researched in last 30d in dealer metro
    supabase
      .from("user_events")
      .select("event_data")
      .in("event_name", ["routine_result_viewed", "report_view"])
      .gte("timestamp", since30d)
      .eq("geo_metro", metro || "")
      .limit(500),

    // 4. Funnel: views (current 7d)
    supabase
      .from("user_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "report_view")
      .gte("timestamp", since7d),

    // 5. Funnel: views (prior 7d, for delta)
    supabase
      .from("user_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "report_view")
      .gte("timestamp", since14d)
      .lt("timestamp", since7d),

    // 6. Funnel: reports generated (30d)
    supabase
      .from("user_events")
      .select("id", { count: "exact", head: true })
      .in("event_name", ["routine_result_viewed", "evfit_completed"])
      .gte("timestamp", since30d),

    // 7. Funnel: receipts analyzed (30d)
    supabase
      .from("user_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "receipt_generate")
      .gte("timestamp", since30d),

    // 8. Avg days on lot for this dealership
    supabase
      .from("dealer_inventory")
      .select("created_at")
      .eq("dealership_id", dealershipId)
      .eq("status", "active"),

    // 9. Inventory count for onboarding checklist
    supabase
      .from("dealer_inventory")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealershipId)
      .eq("status", "active"),
  ]);

  // Weekly high-intent count + delta
  const weeklyHighIntent =
    highIntentResult.status === "fulfilled"
      ? (highIntentResult.value.count ?? 0)
      : 0;
  const weeklyHighIntentPrior =
    highIntentPriorResult.status === "fulfilled"
      ? (highIntentPriorResult.value.count ?? 0)
      : 0;
  const deltaHighIntent = formatCountDelta(weeklyHighIntent, weeklyHighIntentPrior);

  // Top models from event_data
  const topModelsMap = new Map<string, number>();
  if (topModelsResult.status === "fulfilled") {
    for (const ev of topModelsResult.value.data || []) {
      const make = (ev.event_data?.make || ev.event_data?.vehicle?.make || "").trim();
      const model = (ev.event_data?.model || ev.event_data?.vehicle?.model || "").trim();
      if (!make || !model) continue;
      const key = `${make}||${model}`;
      topModelsMap.set(key, (topModelsMap.get(key) || 0) + 1);
    }
  }
  const topModelsRaw = Array.from(topModelsMap.entries())
    .map(([key, count]) => {
      const [make, model] = key.split("||");
      return { make, model, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Inventory matches
  const inventoryMatches = await getInventoryMatches(dealershipId, metro);
  const matchedMakeModels = new Set(
    inventoryMatches
      .filter((m) => m.inventory_count > 0)
      .map((m) => `${m.make.toLowerCase()}||${m.model.toLowerCase()}`)
  );
  const topModels = topModelsRaw.map((tm) => ({
    ...tm,
    in_inventory: matchedMakeModels.has(`${tm.make.toLowerCase()}||${tm.model.toLowerCase()}`),
  }));
  const inventoryMatchCount = inventoryMatches.filter(
    (m) => m.research_count > 0 && m.inventory_count > 0
  ).length;

  // Avg days on lot
  let avgDaysOnLot: number | null = null;
  if (avgDaysResult.status === "fulfilled" && avgDaysResult.value.data?.length) {
    const now2 = Date.now();
    const days = avgDaysResult.value.data.map(
      (r) => (now2 - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    avgDaysOnLot = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
  }

  // Funnel views delta
  const currentViews = funnelViewsResult.status === "fulfilled" ? (funnelViewsResult.value.count ?? 0) : 0;
  const priorViews   = funnelViewsPriorResult.status === "fulfilled" ? (funnelViewsPriorResult.value.count ?? 0) : 0;
  const deltaViewsPct = formatPctDelta(currentViews, priorViews);

  // Funnel
  const funnel = {
    views:    currentViews,
    reports:  funnelReportsResult.status === "fulfilled" ? (funnelReportsResult.value.count ?? 0) : 0,
    receipts: funnelReceiptsResult.status === "fulfilled" ? (funnelReceiptsResult.value.count ?? 0) : 0,
  };

  // Inventory count
  const inventoryCount =
    inventoryCountResult.status === "fulfilled"
      ? (inventoryCountResult.value.count ?? 0)
      : 0;

  audit({
    actor_id: authResult.id,
    actor_type: "user",
    action: "dealer_dashboard.accessed",
    resource: `dealership:${dealershipId}`,
    result: "ok",
  });

  return NextResponse.json({
    dealership_id: dealershipId,
    dealership_name: dealership?.name || null,
    metro,
    weekly_high_intent: weeklyHighIntent,
    delta_high_intent: deltaHighIntent,
    top_models: topModels,
    inventory_match_count: inventoryMatchCount,
    avg_days_on_lot: avgDaysOnLot,
    funnel,
    delta_views_pct: deltaViewsPct,
    inventory_count: inventoryCount,
    subscription_tier: dealership?.subscription_tier ?? null,
    subscription_status: dealership?.subscription_status ?? null,
    computed_at: now.toISOString(),
  });
}
