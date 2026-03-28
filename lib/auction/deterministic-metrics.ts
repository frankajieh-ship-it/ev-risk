/**
 * Auction Deterministic Metrics Pre-Pass
 *
 * Computes all deterministic values that MUST be calculated before AI is invoked.
 * The AI chain synthesizes and explains — it does not invent core numbers.
 *
 * Computed here (no LLM):
 *   salvage_risk_score       — 0–100 safety score from computeSalvageRisk()
 *   title_risk_factor        — normalized 0–1 from title_impact / 100
 *   damage_severity_baseline — heuristic from condition notes + damage fields
 *   mileage_adjustment       — % penalty on ARV for high mileage EVs
 *   source_confidence        — how reliable the provider data is
 *   comp_availability_status — whether market comps exist for ARV
 *   rough_arv_floor          — floor bid guardrail from salvage score heuristic
 *   rough_arv_ceiling        — ceiling bid guardrail from ARV or asking price
 */

import { computeSalvageRisk, type SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type { NormalizedAuctionLot, NhtsaRecallSummary } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DamageSeverityBaseline = "minor" | "moderate" | "severe" | "total_loss";
export type SourceConfidence = "high" | "medium" | "low";
export type CompAvailabilityStatus = "available" | "limited" | "unavailable";

export interface DeterministicMetrics {
  /** 0–100 safety score — higher = safer to bid on */
  salvage_risk_score: number;
  salvage_risk_grade: "green" | "yellow" | "red";
  salvage_risk_factors: SalvageRiskResult["factors"];
  /** Normalized 0.0–1.0 title risk factor */
  title_risk_factor: number;
  /** Heuristic damage severity derived from conditions notes + fields (no AI) */
  damage_severity_baseline: DamageSeverityBaseline;
  /** % ARV reduction for mileage (0 = no penalty) */
  mileage_adjustment: number;
  /** How reliable is the source provider data */
  source_confidence: SourceConfidence;
  /** Whether Auto.dev returned usable market comps */
  comp_availability_status: CompAvailabilityStatus;
  /** Conservative floor bid guardrail ($) */
  rough_arv_floor: number | null;
  /** ARV ceiling from market data or asking price proxy ($) */
  rough_arv_ceiling: number | null;
  /** Active recall count for display */
  recall_count: number;
  /** Suggested bid discount % from salvage scorer */
  suggested_bid_discount: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const TOTAL_LOSS_KEYWORDS = [
  "total loss", "totaled", "complete loss", "unibody damage",
  "rollover", "burned", "fire damage", "flood", "submerged",
];

const SEVERE_KEYWORDS = [
  "frame damage", "frame bent", "structural damage", "airbag deployed",
  "multiple impacts", "battery damage", "hv damage", "high voltage damage",
  "pack damage", "not running", "does not run",
];

const MODERATE_KEYWORDS = [
  "front impact", "rear impact", "side impact", "door damage",
  "deployed", "collision", "accident", "major dents",
];

function classifyDamageSeverity(lot: NormalizedAuctionLot): DamageSeverityBaseline {
  const text = [
    lot.condition_notes,
    lot.primary_damage,
    lot.secondary_damage,
    lot.loss_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (TOTAL_LOSS_KEYWORDS.some((k) => text.includes(k))) return "total_loss";
  if (SEVERE_KEYWORDS.some((k) => text.includes(k))) return "severe";
  if (MODERATE_KEYWORDS.some((k) => text.includes(k))) return "moderate";

  // Title status overrides if no keyword match
  const title = (lot.title_status ?? "").toLowerCase();
  if (title === "salvage") return "severe";
  if (title === "rebuilt") return "moderate";

  return "minor";
}

function computeMileageAdjustment(odometer: number | null): number {
  if (!odometer) return 0;
  // EV battery degradation: meaningful penalty above 80k miles
  if (odometer >= 200_000) return 0.25;
  if (odometer >= 150_000) return 0.18;
  if (odometer >= 100_000) return 0.12;
  if (odometer >= 80_000) return 0.07;
  if (odometer >= 60_000) return 0.03;
  return 0;
}

function assessSourceConfidence(lot: NormalizedAuctionLot): SourceConfidence {
  // Direct API data is most reliable; Apify/scrape is less so
  if (lot.provider_name === "copart_api" || lot.provider_name === "iaai_api") {
    return lot.vin ? "high" : "medium";
  }
  // Apify or other scraping fallback
  return "low";
}

function assessCompAvailability(
  arv: number | null,
  arvListingCount: number,
  vinData: boolean
): CompAvailabilityStatus {
  if (arv !== null && arvListingCount >= 3) return "available";
  if (arv !== null && arvListingCount > 0) return "limited";
  if (vinData) return "limited";
  return "unavailable";
}

function computeRoughGuardrails(
  lot: NormalizedAuctionLot,
  arv: number | null,
  salvageScore: number
): { floor: number | null; ceiling: number | null } {
  const askingPrice = lot.current_bid ?? lot.buy_now_price;

  // Ceiling: prefer real ARV; fall back to 2× asking (rough heuristic)
  const ceiling = arv ?? (askingPrice ? Math.round(askingPrice * 2) : null);

  // Floor: salvage score drives bid floor
  // Score 70+ = 25% of ceiling; Score 50–69 = 15%; Score <50 = no floor (too risky)
  if (ceiling === null) return { floor: null, ceiling: null };

  let floorPct = 0;
  if (salvageScore >= 70) floorPct = 0.25;
  else if (salvageScore >= 50) floorPct = 0.15;

  const floor = floorPct > 0 ? Math.round(ceiling * floorPct) : null;

  return { floor, ceiling };
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface EnrichmentSummary {
  arv: number | null;
  arvListingCount: number;
  hasVinData: boolean;
}

export function computeDeterministicMetrics(
  lot: NormalizedAuctionLot,
  enrichment: EnrichmentSummary,
  recalls: NhtsaRecallSummary[]
): DeterministicMetrics {
  // Delegate core salvage risk to existing scorer
  // Build a composite text blob so the scorer sees all damage signals,
  // not just condition_notes (which may be empty for URL-slug sourced lots)
  const listingText = [
    lot.condition_notes,
    lot.primary_damage,
    lot.secondary_damage,
    lot.loss_type,
  ].filter(Boolean).join(" ");

  const salvageRisk = computeSalvageRisk({
    title_status: lot.title_status,
    mileage: lot.odometer,
    price: lot.current_bid,
    listing_text: listingText,
    receipt: { active_recalls: recalls.length },
  });

  const damageSeverity = classifyDamageSeverity(lot);
  const mileageAdjustment = computeMileageAdjustment(lot.odometer);
  const sourceConfidence = assessSourceConfidence(lot);
  const compAvailability = assessCompAvailability(
    enrichment.arv,
    enrichment.arvListingCount,
    enrichment.hasVinData
  );
  const guardrails = computeRoughGuardrails(lot, enrichment.arv, salvageRisk.score);

  return {
    salvage_risk_score: salvageRisk.score,
    salvage_risk_grade: salvageRisk.grade,
    salvage_risk_factors: salvageRisk.factors,
    title_risk_factor: Math.round(salvageRisk.factors.title_impact) / 100,
    damage_severity_baseline: damageSeverity,
    mileage_adjustment: mileageAdjustment,
    source_confidence: sourceConfidence,
    comp_availability_status: compAvailability,
    rough_arv_floor: guardrails.floor,
    rough_arv_ceiling: guardrails.ceiling,
    recall_count: recalls.length,
    suggested_bid_discount: salvageRisk.suggested_bid_discount,
  };
}
