/**
 * Shared dealer scoring utilities.
 * Used by:
 *  - GET /api/dealer/buyer-profiles
 *  - POST /api/internal/buyer-profiles/generate
 */

import { createHash } from "crypto";

export interface ChatSignal {
  text: string;
  confidence: number;
  category: string;
  count_mentions: number;
}

export interface ScoreBreakdown {
  vehicle_similarity: number;   // max 35
  charging_compat: number;      // max 20
  commute_fit: number;          // max 20
  winter_suitability: number;   // max 15
  engagement_strength: number;  // max 10
}

export interface BuyerProfile {
  profile_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  home_charging: boolean | null;
  weekly_miles: number | null;
  fit_score: number | null;
  geo_metro: string | null;
  researched_at: string;
  inventory_match_score: number | null;
  score_breakdown: ScoreBreakdown | null;
  signal_strength: "high" | "medium" | "low" | "none" | null;
  ai_chat_signals: ChatSignal[];
  buyer_type_tags: string[];
  anonymized_summary: string | null;
}

export function anonymizeProfileId(userId: string, dealershipId: string): string {
  return createHash("sha256")
    .update(`${userId}:${dealershipId}`)
    .digest("hex")
    .slice(0, 16);
}

export function computeMatchScore(
  gv: { make: string; model: string; year?: number | null },
  inv: { make: string; model: string },
  sd: Record<string, unknown>,
  signals: ChatSignal[],
): { score: number; breakdown: ScoreBreakdown } {
  const makeMatch = gv.make.toLowerCase().trim() === inv.make.toLowerCase().trim();
  const modelMatch = gv.model.toLowerCase().trim().includes(inv.model.toLowerCase().trim());
  const vehicleSimilarity = makeMatch && modelMatch ? 35 : makeMatch ? 18 : 0;

  const homeCharging = sd.home_charging;
  const chargingCompat = homeCharging === true ? 20 : homeCharging === false ? 8 : 12;

  const weeklyMiles = typeof sd.weekly_miles === "number" ? sd.weekly_miles : null;
  let commuteFit = 10;
  if (weeklyMiles !== null) {
    commuteFit = weeklyMiles <= 200 ? 20 : weeklyMiles <= 350 ? 14 : 6;
  }

  const hasWinterConcern = signals.some((s) => s.category === "winter");
  const winterSuitability = hasWinterConcern ? 8 : 15;

  const fitScore = typeof sd.fit_score === "number" ? sd.fit_score : null;
  const signalCount = signals.length;
  let engagementStrength = 2;
  if (fitScore !== null && fitScore >= 70) engagementStrength += 4;
  if (signalCount >= 3) engagementStrength += 4;
  else if (signalCount >= 1) engagementStrength += 2;

  const breakdown: ScoreBreakdown = {
    vehicle_similarity: vehicleSimilarity,
    charging_compat: chargingCompat,
    commute_fit: commuteFit,
    winter_suitability: winterSuitability,
    engagement_strength: Math.min(engagementStrength, 10),
  };

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score: Math.min(score, 100), breakdown };
}

export function deriveBuyerTypeTags(
  sd: Record<string, unknown>,
  signals: ChatSignal[],
): string[] {
  const tags: string[] = [];
  const weeklyMiles = typeof sd.weekly_miles === "number" ? sd.weekly_miles : null;
  if (weeklyMiles !== null && weeklyMiles <= 150) tags.push("daily_commuter");
  if (weeklyMiles !== null && weeklyMiles > 300) tags.push("high_mileage");
  if (sd.home_charging === true) tags.push("home_charger");
  if (sd.home_charging === false) tags.push("public_charger_only");
  if (signals.some((s) => s.category === "winter")) tags.push("cold_climate_concern");
  if (signals.some((s) => s.category === "budget" || s.category === "financing"))
    tags.push("budget_sensitive");
  if (signals.some((s) => s.category === "comparison")) tags.push("comparison_shopper");
  if (signals.some((s) => s.category === "range")) tags.push("range_anxious");
  if (signals.some((s) => s.category === "repair" || s.category === "title"))
    tags.push("risk_aware");
  return tags;
}

export function buildAnonymizedSummary(
  gv: { make: string; model: string; year?: number | null },
  sd: Record<string, unknown>,
  tags: string[],
  score: number,
): string {
  const vehicle = `${gv.year ? gv.year + " " : ""}${gv.make} ${gv.model}`;
  const chargingStr =
    sd.home_charging === true
      ? "home charging available"
      : sd.home_charging === false
        ? "public charging only"
        : "charging situation unknown";
  const milesStr =
    typeof sd.weekly_miles === "number" ? `~${sd.weekly_miles} mi/week` : "mileage unknown";
  const fitLabel =
    score >= 80 ? "strong" : score >= 60 ? "good" : score >= 40 ? "moderate" : "low";
  return `Buyer researching ${vehicle} · ${chargingStr} · ${milesStr} · ${fitLabel} match${tags.length ? " · " + tags.slice(0, 3).join(", ") : ""}`;
}

export function aggregateSignals(
  messageSets: Array<{ extracted_signals: unknown }>,
): { signals: ChatSignal[]; signal_strength: "high" | "medium" | "low" | "none" } {
  const allSignals: ChatSignal[] = [];
  for (const msg of messageSets) {
    const es = msg.extracted_signals as Record<string, unknown> | null;
    if (!es || !Array.isArray(es.signals)) continue;
    for (const sig of es.signals as ChatSignal[]) {
      allSignals.push(sig);
    }
  }

  if (allSignals.length === 0) return { signals: [], signal_strength: "none" };

  const byCategory = new Map<string, ChatSignal>();
  for (const sig of allSignals) {
    const existing = byCategory.get(sig.category);
    if (!existing || sig.confidence > existing.confidence) {
      byCategory.set(sig.category, {
        ...sig,
        count_mentions: (existing?.count_mentions ?? 0) + sig.count_mentions,
      });
    }
  }

  const deduped = [...byCategory.values()].sort((a, b) => b.confidence - a.confidence);
  const avgConfidence = deduped.reduce((s, x) => s + x.confidence, 0) / deduped.length;

  const signalStrength: "high" | "medium" | "low" | "none" =
    avgConfidence >= 75 && deduped.length >= 2
      ? "high"
      : avgConfidence >= 55 || deduped.length >= 1
        ? "medium"
        : "low";

  return { signals: deduped.slice(0, 8), signal_strength: signalStrength };
}
