/**
 * POST /api/internal/buyer-profiles/generate
 *
 * Generates and upserts a buyer profile for a specific user + dealership pair.
 * Reuses the same deterministic scoring from GET /api/dealer/buyer-profiles.
 * Idempotent — safe to call multiple times for the same pair.
 *
 * Internal server-to-server only (INTERNAL_API_SECRET required).
 *
 * Body: { user_id: string, dealership_id: string }
 * Returns: { profiles_generated: number, profiles: BuyerProfile[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import {
  anonymizeProfileId,
  computeMatchScore,
  deriveBuyerTypeTags,
  buildAnonymizedSummary,
  aggregateSignals,
  type BuyerProfile,
} from "@/lib/dealer-scoring";

export const maxDuration = 20;

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;
  if (expected && secret === expected) return true;
  const serviceKey = req.headers.get("x-service-role-key");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { user_id?: string; dealership_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id, dealership_id } = body;
  if (!user_id || !dealership_id) {
    return NextResponse.json({ error: "user_id and dealership_id are required" }, { status: 400 });
  }

  // Fetch dealer inventory
  const { data: inventory } = await supabase
    .from("dealer_inventory")
    .select("make, model")
    .eq("dealership_id", dealership_id)
    .eq("status", "active");

  if (!inventory?.length) {
    return NextResponse.json({ profiles_generated: 0, profiles: [] });
  }

  const inventoryPairs = inventory.map((i) => ({
    make: i.make.toLowerCase().trim(),
    model: i.model.toLowerCase().trim(),
  }));

  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch this user's garage vehicles
  const { data: garageVehicles } = await supabase
    .from("garage_vehicles")
    .select("id, user_id, make, model, year, created_at")
    .eq("user_id", user_id)
    .gte("created_at", since60d);

  if (!garageVehicles?.length) {
    return NextResponse.json({ profiles_generated: 0, profiles: [] });
  }

  // Fetch user's saved scenario for routine data
  const { data: scenarios } = await supabase
    .from("saved_scenarios")
    .select("user_id, scenario_data")
    .eq("user_id", user_id)
    .gte("created_at", since60d)
    .limit(5);

  const profiles: BuyerProfile[] = [];
  const upsertRows: Record<string, unknown>[] = [];

  for (const gv of garageVehicles) {
    const gvMake = gv.make.toLowerCase().trim();
    const gvModel = gv.model.toLowerCase().trim();
    const matchedInv = inventoryPairs.find(
      (inv) => inv.make === gvMake && gvModel.includes(inv.model)
    );
    if (!matchedInv) continue;

    const scenario = (scenarios || []).find((s) => s.user_id === gv.user_id);
    const sd: Record<string, unknown> = scenario?.scenario_data || {};

    // Fetch chat signals for this vehicle
    const { data: chatMsgs } = await supabase
      .from("chat_messages")
      .select("extracted_signals")
      .eq("scenario_id", gv.id)
      .not("extracted_signals", "is", null)
      .gte("created_at", since60d);

    const msgSet = (chatMsgs || []).map((m) => ({ extracted_signals: m.extracted_signals }));
    const { signals, signal_strength } = aggregateSignals(msgSet);
    const { score, breakdown } = computeMatchScore(gv, matchedInv, sd, signals);
    const tags = deriveBuyerTypeTags(sd, signals);
    const summary = buildAnonymizedSummary(gv, sd, tags, score);
    const profileId = anonymizeProfileId(gv.user_id, dealership_id);

    const profile: BuyerProfile = {
      profile_id: profileId,
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
    };

    profiles.push(profile);

    upsertRows.push({
      profile_id: profileId,
      dealership_id: dealership_id,
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

  // Upsert into buyer_profiles table (idempotent)
  if (upsertRows.length > 0) {
    await supabase
      .from("buyer_profiles")
      .upsert(upsertRows, {
        onConflict: "profile_id,dealership_id,vehicle_make,vehicle_model",
      });
  }

  return NextResponse.json({
    profiles_generated: profiles.length,
    profiles,
  });
}
