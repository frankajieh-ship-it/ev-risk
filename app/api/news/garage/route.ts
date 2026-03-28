/**
 * GET /api/news/garage
 *
 * Returns news articles personalized to the authenticated user's garage vehicles
 * and routine (charging, commute, winter concerns).
 *
 * Feature-flagged: FLAG_GARAGE_NEWS_ENABLED=true required.
 * Internal QA / admin preview only until buyer-profile and Copart work is stable.
 *
 * Algorithm:
 *  1. Fetch user's garage vehicles (make, model) + saved_scenarios (routine tags)
 *  2. Derive a set of relevance tags from vehicle categories and routine
 *  3. Filter daily_routine_news by key_routine_effects overlapping relevance tags
 *  4. Apply +10 impact_score boost for articles matching friction signal tags
 *  5. Return top articles sorted by adjusted score (min 50)
 *
 * Response adds matched_vehicles[] per article — no raw chat data.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getSupabaseAdmin } from "@/lib/api-auth";
import { getIntelligenceFlags } from "@/lib/rollout-flags";

export const maxDuration = 15;

// Tags from routine/scenario data that map to article relevance
const ROUTINE_TAG_MAP: Record<string, string[]> = {
  home_charging_false:  ["public_charging", "charging_access", "charging_speed"],
  home_charging_true:   ["home_charging", "level2", "charging_cost"],
  winter:               ["cold_weather", "winter_range", "battery_heat"],
  range_anxious:        ["range", "battery", "charging_network"],
  high_mileage:         ["range", "charging_network", "battery_degradation"],
  daily_commuter:       ["commute", "efficiency", "charging_cost"],
};

// Vehicle-category tags
function vehicleToTags(make: string, model: string): string[] {
  const key = `${make} ${model}`.toLowerCase();
  const tags: string[] = ["ev", "electric_vehicle"];
  if (key.includes("tesla")) tags.push("tesla");
  if (key.includes("rivian")) tags.push("rivian");
  if (key.includes("ford") || key.includes("f-150") || key.includes("mach-e")) tags.push("ford");
  if (key.includes("chevy") || key.includes("chevrolet") || key.includes("bolt")) tags.push("gm");
  if (key.includes("hyundai") || key.includes("kia")) tags.push("hyundai_kia");
  return tags;
}

export async function GET(req: NextRequest) {
  // Feature flag gate
  if (!getIntelligenceFlags().garage_news_enabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);
  const hours = Math.min(parseInt(url.searchParams.get("hours") ?? "48", 10), 168);

  // Fetch user's garage vehicles (owned + auction)
  const { data: garageVehicles } = await supabase
    .from("garage_vehicles")
    .select("make, model, year, is_owned_ev, source, auction_source")
    .eq("user_id", user.id)
    .limit(10);

  if (!garageVehicles?.length) {
    return NextResponse.json({ articles: [], reason: "no_garage_vehicles" });
  }

  // Fetch user's saved scenario for routine tags
  const { data: scenario } = await supabase
    .from("saved_scenarios")
    .select("scenario_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const sd: Record<string, unknown> = scenario?.scenario_data || {};

  // Build relevance tag set
  const relevanceTags = new Set<string>();

  // From vehicles
  for (const gv of garageVehicles) {
    vehicleToTags(gv.make, gv.model).forEach((t) => relevanceTags.add(t));
  }

  // From routine
  if (sd.home_charging === false) {
    ROUTINE_TAG_MAP.home_charging_false.forEach((t) => relevanceTags.add(t));
  } else if (sd.home_charging === true) {
    ROUTINE_TAG_MAP.home_charging_true.forEach((t) => relevanceTags.add(t));
  }

  // From weekly miles
  const weeklyMiles = typeof sd.weekly_miles === "number" ? sd.weekly_miles : null;
  if (weeklyMiles !== null && weeklyMiles > 300) {
    ROUTINE_TAG_MAP.high_mileage.forEach((t) => relevanceTags.add(t));
  } else if (weeklyMiles !== null && weeklyMiles <= 150) {
    ROUTINE_TAG_MAP.daily_commuter.forEach((t) => relevanceTags.add(t));
  }

  // Tags for scoring boost (friction signals)
  const frictionBoostTags = new Set<string>();
  if (Array.isArray(sd.friction_tags)) {
    for (const tag of sd.friction_tags as string[]) {
      const lower = tag.toLowerCase();
      if (lower.includes("winter") || lower.includes("cold")) {
        ROUTINE_TAG_MAP.winter.forEach((t) => frictionBoostTags.add(t));
      }
      if (lower.includes("range")) {
        ROUTINE_TAG_MAP.range_anxious.forEach((t) => frictionBoostTags.add(t));
      }
    }
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Fetch recent news with minimum score 50 (lower than global 65 for personalized)
  const { data: articles, error } = await supabase
    .from("daily_routine_news")
    .select("id, title, summary, url, source, published_at, impact_score, key_routine_effects, ai_summary")
    .eq("is_routine_impact", true)
    .gte("impact_score", 50)
    .gte("scored_at", since)
    .order("impact_score", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Score and filter articles by relevance
  const scored: Array<{
    id: string;
    title: string;
    summary: string;
    url: string;
    source: string;
    published_at: string;
    impact_score: number;
    adjusted_score: number;
    ai_summary: string | null;
    matched_vehicles: string[];
  }> = [];

  for (const article of articles || []) {
    const effects: string[] = Array.isArray(article.key_routine_effects)
      ? article.key_routine_effects
      : [];

    // Check if any effect overlaps with user's relevance tags
    const effectsLower = effects.map((e: string) => e.toLowerCase());
    const hasRelevance = effectsLower.some((e) => {
      for (const tag of relevanceTags) {
        if (e.includes(tag) || tag.includes(e)) return true;
      }
      return false;
    });

    if (!hasRelevance && relevanceTags.size > 0) continue;

    // Boost score for friction-matched articles
    const hasBoost = effectsLower.some((e) => {
      for (const tag of frictionBoostTags) {
        if (e.includes(tag) || tag.includes(e)) return true;
      }
      return false;
    });

    // Build matched_vehicles list (which of user's vehicles this is relevant to)
    const matchedVehicles: string[] = [];
    for (const gv of garageVehicles) {
      const gvTags = vehicleToTags(gv.make, gv.model);
      const isMatch =
        effectsLower.some((e) => gvTags.some((t) => e.includes(t) || t.includes(e)));
      if (isMatch) {
        matchedVehicles.push(`${gv.year ? gv.year + " " : ""}${gv.make} ${gv.model}`);
      }
    }

    // Extra +10 boost for articles matched to an owned EV or an auction vehicle
    const hasOwnedEvBoost = matchedVehicles.length > 0 &&
      garageVehicles.some((gv) => {
        if (!gv.is_owned_ev && gv.source !== "auction") return false;
        const gvTags = vehicleToTags(gv.make, gv.model);
        return effectsLower.some((e) => gvTags.some((t) => e.includes(t) || t.includes(e)));
      });

    scored.push({
      id: article.id,
      title: article.title,
      summary: article.summary,
      url: article.url,
      source: article.source,
      published_at: article.published_at,
      impact_score: article.impact_score,
      adjusted_score: article.impact_score + (hasBoost ? 10 : 0) + (hasOwnedEvBoost ? 10 : 0),
      ai_summary: article.ai_summary ?? null,
      matched_vehicles: matchedVehicles,
    });
  }

  // Sort by adjusted score, return top N
  scored.sort((a, b) => b.adjusted_score - a.adjusted_score);

  return NextResponse.json({
    articles: scored.slice(0, limit),
    garage_vehicles: garageVehicles.map((gv) => `${gv.year ? gv.year + " " : ""}${gv.make} ${gv.model}`),
  });
}
