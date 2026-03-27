/**
 * GET /api/dealer/buyer-profiles
 *
 * Returns anonymized buyer profiles: users who saved or researched a vehicle
 * matching this dealer's active inventory. No PII is returned.
 * Protected by dealer_admin or dealer_user role.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";
import {
  anonymizeProfileId,
  computeMatchScore,
  deriveBuyerTypeTags,
  buildAnonymizedSummary,
  aggregateSignals,
  type BuyerProfile,
  type ChatSignal,
} from "@/lib/dealer-scoring";

export const maxDuration = 20;

// Re-export types for the dashboard page
export type { BuyerProfile, ChatSignal };

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

  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: scenarios } = await supabase
    .from("saved_scenarios")
    .select("user_id, scenario_data, created_at")
    .gte("created_at", since60d)
    .not("user_id", "is", null)
    .limit(500);

  const { data: garageVehicles } = await supabase
    .from("garage_vehicles")
    .select("id, user_id, make, model, year, created_at")
    .gte("created_at", since60d)
    .not("user_id", "is", null)
    .limit(500);

  if (!garageVehicles?.length) {
    return NextResponse.json({ profiles: [] });
  }

  // Collect matching garage_vehicle ids for chat signal batch fetch
  const matchingGvIds: string[] = [];
  for (const gv of garageVehicles) {
    const gvMake = gv.make.toLowerCase().trim();
    const gvModel = gv.model.toLowerCase().trim();
    if (inventoryPairs.some((inv) => inv.make === gvMake && gvModel.includes(inv.model))) {
      matchingGvIds.push(gv.id);
    }
  }

  // Batch-fetch chat signals for matching vehicles
  const chatSignalsByVehicle = new Map<string, Array<{ extracted_signals: unknown }>>();
  if (matchingGvIds.length > 0) {
    const { data: chatMsgs } = await supabase
      .from("chat_messages")
      .select("scenario_id, extracted_signals")
      .in("scenario_id", matchingGvIds)
      .not("extracted_signals", "is", null)
      .gte("created_at", since60d);

    if (chatMsgs) {
      for (const msg of chatMsgs) {
        if (!chatSignalsByVehicle.has(msg.scenario_id)) {
          chatSignalsByVehicle.set(msg.scenario_id, []);
        }
        chatSignalsByVehicle.get(msg.scenario_id)!.push({ extracted_signals: msg.extracted_signals });
      }
    }
  }

  const profiles: BuyerProfile[] = [];

  for (const gv of garageVehicles) {
    const gvMake = gv.make.toLowerCase().trim();
    const gvModel = gv.model.toLowerCase().trim();
    const matchedInv = inventoryPairs.find(
      (inv) => inv.make === gvMake && gvModel.includes(inv.model)
    );
    if (!matchedInv) continue;

    const scenario = (scenarios || []).find((s) => s.user_id === gv.user_id);
    const sd: Record<string, unknown> = scenario?.scenario_data || {};

    const msgSet = chatSignalsByVehicle.get(gv.id) || [];
    const { signals, signal_strength } = aggregateSignals(msgSet);
    const { score, breakdown } = computeMatchScore(gv, matchedInv, sd, signals);
    const tags = deriveBuyerTypeTags(sd, signals);
    const summary = buildAnonymizedSummary(gv, sd, tags, score);

    profiles.push({
      profile_id: anonymizeProfileId(gv.user_id, dealershipId),
      vehicle_make: gv.make,
      vehicle_model: gv.model,
      vehicle_year: gv.year ?? null,
      home_charging: (sd.home_charging as boolean) ?? null,
      weekly_miles: (sd.weekly_miles as number) ?? null,
      fit_score: (sd.fit_score as number) ?? null,
      geo_metro: null,
      researched_at: gv.created_at,
      inventory_match_score: score,
      score_breakdown: breakdown,
      signal_strength: signals.length > 0 ? signal_strength : null,
      ai_chat_signals: signals,
      buyer_type_tags: tags,
      anonymized_summary: summary,
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

  unique.sort((a, b) => {
    const scoreDiff = (b.inventory_match_score ?? 0) - (a.inventory_match_score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.researched_at).getTime() - new Date(a.researched_at).getTime();
  });

  return NextResponse.json({ profiles: unique.slice(0, 50) });
}
