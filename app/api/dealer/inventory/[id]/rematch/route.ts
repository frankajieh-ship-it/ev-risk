/**
 * POST /api/dealer/inventory/[id]/rematch
 *
 * Re-runs buyer profile matching for a specific inventory vehicle.
 * Clears stale buyer_profiles rows for this make+model, then rebuilds
 * by triggering generate for all matching garage vehicle users.
 *
 * Useful when inventory is updated, price changes, or a new VIN is added.
 * Protected by dealer_admin or dealer_user role.
 *
 * Returns: { matched_profiles: number, refreshed_at: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";
import {
  anonymizeProfileId,
  computeMatchScore,
  deriveBuyerTypeTags,
  buildAnonymizedSummary,
  aggregateSignals,
} from "@/lib/dealer-scoring";

export const maxDuration = 25;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: vehicleId } = await params;

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

  // Verify vehicle belongs to this dealership
  const { data: vehicle, error: vErr } = await supabase
    .from("dealer_inventory")
    .select("id, make, model, year")
    .eq("id", vehicleId)
    .eq("dealership_id", dealershipId)
    .single();

  if (vErr || !vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // Find all garage vehicles matching this make+model
  const { data: garageVehicles } = await supabase
    .from("garage_vehicles")
    .select("id, user_id, make, model, year, created_at")
    .ilike("make", vehicle.make)
    .ilike("model", `%${vehicle.model}%`)
    .gte("created_at", since60d)
    .limit(200);

  if (!garageVehicles?.length) {
    return NextResponse.json({ matched_profiles: 0, refreshed_at: new Date().toISOString() });
  }

  const invEntry = {
    make: vehicle.make.toLowerCase().trim(),
    model: vehicle.model.toLowerCase().trim(),
  };

  // Fetch scenarios for matched users
  const userIds = garageVehicles.map((gv) => gv.user_id);
  const { data: scenarios } = await supabase
    .from("saved_scenarios")
    .select("user_id, scenario_data")
    .in("user_id", userIds)
    .gte("created_at", since60d);

  // Fetch chat signals batch
  const gvIds = garageVehicles.map((gv) => gv.id);
  const { data: chatMsgs } = await supabase
    .from("chat_messages")
    .select("scenario_id, extracted_signals")
    .in("scenario_id", gvIds)
    .not("extracted_signals", "is", null)
    .gte("created_at", since60d);

  const signalsByVehicle = new Map<string, Array<{ extracted_signals: unknown }>>();
  for (const msg of chatMsgs || []) {
    if (!signalsByVehicle.has(msg.scenario_id)) signalsByVehicle.set(msg.scenario_id, []);
    signalsByVehicle.get(msg.scenario_id)!.push({ extracted_signals: msg.extracted_signals });
  }

  const upsertRows: Record<string, unknown>[] = [];

  for (const gv of garageVehicles) {
    const scenario = (scenarios || []).find((s) => s.user_id === gv.user_id);
    const sd: Record<string, unknown> = scenario?.scenario_data || {};

    const msgSet = signalsByVehicle.get(gv.id) || [];
    const { signals, signal_strength } = aggregateSignals(msgSet);
    const { score, breakdown } = computeMatchScore(gv, invEntry, sd, signals);
    const tags = deriveBuyerTypeTags(sd, signals);
    const summary = buildAnonymizedSummary(gv, sd, tags, score);
    const profileId = anonymizeProfileId(gv.user_id, dealershipId);

    upsertRows.push({
      profile_id: profileId,
      dealership_id: dealershipId,
      garage_vehicle_id: gv.id,
      vehicle_make: gv.make,
      vehicle_model: gv.model,
      vehicle_year: gv.year ?? null,
      home_charging: (sd.home_charging as boolean) ?? null,
      weekly_miles: (sd.weekly_miles as number) ?? null,
      fit_score: (sd.fit_score as number) ?? null,
      inventory_match_score: score,
      score_breakdown: breakdown,
      buyer_type_tags: tags,
      anonymized_summary: summary,
      ai_chat_signals: signals.length > 0 ? { signals, signal_strength } : null,
      signal_strength: signals.length > 0 ? signal_strength : null,
      last_active_at: gv.created_at,
    });
  }

  if (upsertRows.length > 0) {
    await supabase
      .from("buyer_profiles")
      .upsert(upsertRows, {
        onConflict: "profile_id,dealership_id,vehicle_make,vehicle_model",
      });
  }

  // Also mark pricing insight as stale so it refreshes on next GET
  await supabase
    .from("pricing_insights")
    .update({ is_stale: true })
    .eq("vehicle_id", vehicleId)
    .eq("dealership_id", dealershipId);

  return NextResponse.json({
    matched_profiles: upsertRows.length,
    refreshed_at: new Date().toISOString(),
  });
}
