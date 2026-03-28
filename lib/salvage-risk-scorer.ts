/**
 * Salvage Risk Scorer
 *
 * Computes a 0–100 risk score for salvage/rebuilt/auction vehicles.
 * Lower score = higher risk (inverse of "fit" scores used elsewhere).
 *
 * Weights:
 *   Battery damage risk    35%
 *   Structural/charging    25%
 *   Title branding impact  15%
 *   Recall overlap         10%
 *   Repair cost vs routine 10%
 *   Mileage penalty         5%
 */

export interface SalvageRiskFactors {
  battery_risk: number;       // 0–100, higher = more risky
  structural_risk: number;
  title_impact: number;
  recall_overlap: number;
  repair_cost_risk: number;
  mileage_penalty: number;
}

export type SalvageGrade = "green" | "yellow" | "red";

export interface SalvageRiskResult {
  /** 0–100 safety score — higher = safer to bid on */
  score: number;
  grade: SalvageGrade;
  factors: SalvageRiskFactors;
  routine_impact_summary: string;
  /** Suggested bid discount % (0 if no discount recommended) */
  suggested_bid_discount: number;
  /** Rough ARV hint derived from asking price + damage multiplier (heuristic, not market data) */
  arv_hint_low?: number;
  arv_hint_high?: number;
}

// Keywords that suggest battery or thermal damage
const BATTERY_DAMAGE_KEYWORDS = [
  "battery damage", "thermal event", "fire", "flood", "water damage",
  "submerged", "lightning", "surge", "electrical fire", "battery fire",
  "pack replacement", "hv damage", "high voltage damage",
];

// Keywords that suggest structural or charging system damage
const STRUCTURAL_KEYWORDS = [
  "frame damage", "frame bent", "unibody", "structural damage",
  "rollover", "roof damage", "underbody", "charging port damage",
  "onboard charger", "dcdc converter", "ac damage",
  // Common Copart primary_damage field values
  "front end", "all over", "side", "rear end", "undercarriage",
  "suspension", "collision", "impact",
];

function containsKeyword(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k)).length;
}

interface MinimalReceiptInput {
  title_status?: string | null;
  accidents_reported?: string | null;
  mileage?: number | null;
  price?: number | null;
  listing_text?: string | null;
  zip_or_postcode?: string | null;
  // from receipt body if available
  receipt?: {
    active_recalls?: number | null;
    market_value?: number | null;
    listing_summary?: { vehicle?: { mileage?: number; price?: number } } | null;
  } | null;
}

/**
 * Compute salvage risk from available listing data.
 * Input is intentionally loose — pass whatever you have.
 */
export function computeSalvageRisk(input: MinimalReceiptInput): SalvageRiskResult {
  const listingText = input.listing_text ?? "";
  const titleStatus = (input.title_status ?? "unknown").toLowerCase();
  const accidents = (input.accidents_reported ?? "unknown").toLowerCase();
  const mileage = input.mileage ?? input.receipt?.listing_summary?.vehicle?.mileage ?? 0;
  const price = input.price ?? input.receipt?.listing_summary?.vehicle?.price ?? 0;
  const marketValue = input.receipt?.market_value ?? price;
  const activeRecalls = input.receipt?.active_recalls ?? 0;

  console.log(`[SalvageScorer] listingText="${listingText}"`);
  console.log(`[SalvageScorer] titleStatus="${titleStatus}" mileage=${mileage} price=${price} marketValue=${marketValue} activeRecalls=${activeRecalls}`);

  // ── 1. Battery damage risk (35 pts weight) ──────────────────────────────
  let batteryRisk = 0;
  // Apply a floor when there's no listing text — unknown risk ≠ no risk
  if (!listingText) batteryRisk = 15;
  const batteryHits = containsKeyword(listingText, BATTERY_DAMAGE_KEYWORDS);
  const batteryMatched = BATTERY_DAMAGE_KEYWORDS.filter(k => listingText.toLowerCase().includes(k));
  batteryRisk += Math.min(batteryHits * 25, 75); // up to 75 from keywords

  if (titleStatus === "salvage") batteryRisk += 15;
  if (titleStatus === "rebuilt") batteryRisk += 5;
  if (accidents === "yes") batteryRisk += 10;
  batteryRisk = Math.min(batteryRisk, 100);
  console.log(`[SalvageScorer] batteryHits=${batteryHits} matched=${JSON.stringify(batteryMatched)} batteryRisk=${batteryRisk}`);

  // ── 2. Structural / charging risk (25 pts weight) ────────────────────────
  let structuralRisk = 0;
  const structuralHits = containsKeyword(listingText, STRUCTURAL_KEYWORDS);
  const structuralMatched = STRUCTURAL_KEYWORDS.filter(k => listingText.toLowerCase().includes(k));
  structuralRisk += Math.min(structuralHits * 20, 60);
  console.log(`[SalvageScorer] structuralHits=${structuralHits} matched=${JSON.stringify(structuralMatched)} (pre-title structuralRisk=${structuralRisk})`);

  if (titleStatus === "salvage") structuralRisk += 20;
  else if (titleStatus === "rebuilt") structuralRisk += 8;
  // If we have no listing text at all (slug/unavailable lot), apply a floor
  // so the score reflects data uncertainty rather than implying zero risk
  if (!listingText && structuralRisk === 0) structuralRisk = 25;
  structuralRisk = Math.min(structuralRisk, 100);
  console.log(`[SalvageScorer] structuralRisk (final)=${structuralRisk} titleImpact contribution: salvage=+20 rebuilt=+8`);

  // ── 3. Title branding impact (15 pts weight) ─────────────────────────────
  let titleImpact = 0;
  if (titleStatus === "salvage") titleImpact = 80;
  else if (titleStatus === "rebuilt") titleImpact = 40;
  else if (titleStatus === "clean") titleImpact = 0;
  else titleImpact = 30; // unknown

  // State/location multiplier — high-humidity states add risk
  const zip = (input.zip_or_postcode ?? "").toLowerCase();
  const highHumidityPrefixes = ["fl", "la", "tx", "al", "ms", "sc", "ga", "3", "7"]; // rough proxies
  if (highHumidityPrefixes.some((p) => zip.startsWith(p))) {
    titleImpact = Math.min(titleImpact + 10, 100);
  }

  // ── 4. Recall overlap (10 pts weight) ────────────────────────────────────
  let recallOverlap = 0;
  if (activeRecalls >= 3) recallOverlap = 80;
  else if (activeRecalls === 2) recallOverlap = 50;
  else if (activeRecalls === 1) recallOverlap = 25;

  // ── 5. Repair cost vs routine (10 pts weight) ────────────────────────────
  let repairCostRisk = 0;
  if (marketValue > 0 && price > 0) {
    const priceRatio = price / marketValue;
    // If price is suspiciously low (<60% of market), assume hidden damage
    if (priceRatio < 0.4) repairCostRisk = 90;
    else if (priceRatio < 0.6) repairCostRisk = 60;
    else if (priceRatio < 0.8) repairCostRisk = 30;
  } else {
    repairCostRisk = 20; // unknown — moderate risk
  }

  // ── 6. Mileage penalty (5 pts weight) ────────────────────────────────────
  let milagePenalty = 0;
  if (mileage > 150000) milagePenalty = 80;
  else if (mileage > 100000) milagePenalty = 50;
  else if (mileage > 75000) milagePenalty = 25;

  console.log(`[SalvageScorer] titleImpact=${titleImpact} recallOverlap=${recallOverlap} repairCostRisk=${repairCostRisk} milagePenalty=${milagePenalty}`);

  // ── Weighted composite risk score (0–100, higher = riskier) ─────────────
  const rawRisk =
    batteryRisk * 0.35 +
    structuralRisk * 0.25 +
    titleImpact * 0.15 +
    recallOverlap * 0.10 +
    repairCostRisk * 0.10 +
    milagePenalty * 0.05;

  console.log(`[SalvageScorer] rawRisk=${rawRisk.toFixed(2)} → score=${Math.round(100 - rawRisk)}`);
  // Invert: safety score = 100 - risk
  const score = Math.round(Math.max(0, Math.min(100, 100 - rawRisk)));

  const grade: SalvageGrade =
    score >= 65 ? "green" : score >= 40 ? "yellow" : "red";

  // ── Bid discount recommendation ──────────────────────────────────────────
  let suggested_bid_discount = 0;
  if (score < 40) suggested_bid_discount = 30;
  else if (score < 55) suggested_bid_discount = 20;
  else if (score < 65) suggested_bid_discount = 15;
  else if (score < 75) suggested_bid_discount = 10;

  // ── Routine impact summary ────────────────────────────────────────────────
  const routine_impact_summary = buildSummary(grade, titleStatus, batteryHits, structuralHits, activeRecalls);

  // ── ARV hint: rough intact retail estimate based on damage severity ───────
  // Multiplier = how much the damage depresses value vs intact retail
  // grade green → vehicle needs light repair (~20–35% off retail)
  // grade yellow → moderate damage (~35–55% off retail)
  // grade red → severe damage (~55–75% off retail)
  let arv_hint_low: number | undefined;
  let arv_hint_high: number | undefined;
  if (price > 0) {
    const [dampLow, dampHigh] =
      grade === "green"  ? [0.20, 0.35] :
      grade === "yellow" ? [0.35, 0.55] :
                           [0.55, 0.75];
    arv_hint_low  = Math.round(price / (1 - dampLow)  / 500) * 500;
    arv_hint_high = Math.round(price / (1 - dampHigh) / 500) * 500;
  }

  return {
    score,
    grade,
    factors: {
      battery_risk: Math.round(batteryRisk),
      structural_risk: Math.round(structuralRisk),
      title_impact: Math.round(titleImpact),
      recall_overlap: Math.round(recallOverlap),
      repair_cost_risk: Math.round(repairCostRisk),
      mileage_penalty: Math.round(milagePenalty),
    },
    routine_impact_summary,
    suggested_bid_discount,
    arv_hint_low,
    arv_hint_high,
  };
}

function buildSummary(
  grade: SalvageGrade,
  titleStatus: string,
  batteryHits: number,
  structuralHits: number,
  recalls: number
): string {
  if (grade === "green") {
    return "Low salvage risk. Rebuilt or clean title with no significant damage indicators. Suitable for routine EV use if mechanically inspected.";
  }
  if (grade === "yellow") {
    const parts: string[] = ["Moderate salvage risk."];
    if (titleStatus === "salvage") parts.push("Salvage title requires careful inspection.");
    if (batteryHits > 0) parts.push("Possible battery-related damage detected in listing.");
    if (structuralHits > 0) parts.push("Structural or charging system keywords flagged.");
    if (recalls > 0) parts.push(`${recalls} open recall(s) — verify completion before bidding.`);
    parts.push("Factor in repair costs before bidding.");
    return parts.join(" ");
  }
  // red
  const parts: string[] = ["High salvage risk."];
  if (batteryHits > 1) parts.push("Multiple battery damage indicators in listing.");
  if (structuralHits > 1) parts.push("Structural damage keywords detected.");
  if (titleStatus === "salvage") parts.push("Salvage title significantly reduces resale value.");
  if (recalls > 1) parts.push(`${recalls} open recalls outstanding.`);
  parts.push("Deep inspection by an EV specialist strongly recommended before bidding.");
  return parts.join(" ");
}
