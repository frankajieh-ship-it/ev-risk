/**
 * OFFO Receipt Renderer
 *
 * Deterministic templates that convert structured receipt JSON into
 * OFFO-voice prose. Applied after multi-provider generation to ensure
 * consistent tone regardless of which provider produced the output.
 *
 * Rules enforced:
 *   - No "AI", "algorithm", "model", "our system"
 *   - No verdict language ("good deal", "skip it", "hard pass", "avoid")
 *   - Cautious: "may", "worth confirming", "tends to" — not "will", "definitely"
 *   - Numbers are concrete where available
 *   - Neutral framing — states facts, doesn't advise
 */

import type { ListingReceipt } from "@/types/receipt";
import { RULES_BY_ID, type ListingSignalId } from "@/lib/receipt-rules";

// ---------------------------------------------------------------------------
// Verdict reason renderer
// ---------------------------------------------------------------------------

/**
 * Rewrites verdict_reason using top signals and cautious language.
 * Falls back to AI-generated text if signals are empty or rendering fails.
 */
export function renderVerdictReason(receipt: ListingReceipt): string {
  const signals = (receipt.listing_signals ?? []) as ListingSignalId[];
  const verdict = receipt.verdict;

  if (signals.length === 0) {
    return receipt.verdict_reason;
  }

  const hardBlockers = signals.filter((id) => {
    const rule = RULES_BY_ID[id];
    return rule?.type === "hard_blocker";
  });

  const fitPenalties = signals.filter((id) => {
    const rule = RULES_BY_ID[id];
    return rule?.type === "fit_penalty";
  });

  const evidenceBonuses = signals.filter((id) => {
    const rule = RULES_BY_ID[id];
    return rule?.type === "evidence_bonus";
  });

  const evidencePenalties = signals.filter((id) => {
    const rule = RULES_BY_ID[id];
    return rule?.type === "evidence_penalty";
  });

  // Build signal-derived reason
  if (verdict === "RED" && hardBlockers.length > 0) {
    const topBlocker = RULES_BY_ID[hardBlockers[0]];
    const label = topBlocker?.label ?? "a critical issue";
    return `This listing shows ${label.toLowerCase()} — worth investigating carefully before proceeding.`;
  }

  if (verdict === "GREEN") {
    const positives: string[] = [];
    if (evidenceBonuses.includes("clean_title_explicit")) positives.push("clean title confirmed");
    if (evidenceBonuses.includes("battery_report_recent")) positives.push("recent battery report available");
    if (evidenceBonuses.includes("service_records_shown")) positives.push("service records shown");
    if (evidenceBonuses.includes("vin_decoded")) positives.push("VIN decoded");
    if (evidenceBonuses.includes("ownership_history_clear")) positives.push("ownership history clear");

    if (positives.length >= 2) {
      return `Listing shows ${positives.slice(0, 2).join(" and ")} with no major red flags flagged.`;
    }
    if (positives.length === 1) {
      return `Listing shows ${positives[0]} with no major concerns identified.`;
    }
  }

  if (verdict === "YELLOW") {
    const concerns: string[] = [];
    for (const id of evidencePenalties.slice(0, 2)) {
      const rule = RULES_BY_ID[id];
      if (rule) concerns.push(rule.label.toLowerCase());
    }
    for (const id of fitPenalties.slice(0, 1)) {
      const rule = RULES_BY_ID[id];
      if (rule) concerns.push(rule.label.toLowerCase());
    }

    if (concerns.length > 0) {
      return `Worth verifying ${concerns.slice(0, 2).join(" and ")} before committing.`;
    }
  }

  // Default: return the AI-generated text (already validated)
  return receipt.verdict_reason;
}

// ---------------------------------------------------------------------------
// Price sanity renderer
// ---------------------------------------------------------------------------

/**
 * Renders a concise price comparison sentence from structured price_sanity data.
 */
export function renderPriceSanity(receipt: ListingReceipt): string {
  const ps = receipt.price_sanity;
  if (!ps || ps.label === "UNKNOWN") {
    return ps?.rationale_short ?? "Price comparison not available — listing data was insufficient.";
  }

  const price = receipt.listing_summary?.price;
  const currency = receipt.listing_summary?.currency ?? "USD";
  const symbol = currency === "GBP" ? "£" : "$";
  const priceStr = price ? `${symbol}${price.toLocaleString()}` : "the listed price";

  const rangeNote = ps.user_market_range
    ? ` (market range ${symbol}${ps.user_market_range.low.toLocaleString()}–${symbol}${ps.user_market_range.high.toLocaleString()})`
    : "";

  switch (ps.label) {
    case "UNDERPRICED":
      return `${priceStr} may be below typical market range for this vehicle${rangeNote}.`;
    case "FAIR":
      return `${priceStr} appears within typical market range for this vehicle${rangeNote}.`;
    case "OVERPRICED":
      return `${priceStr} may be above typical market range for this vehicle${rangeNote} — worth negotiating.`;
    default:
      return ps.rationale_short;
  }
}

// ---------------------------------------------------------------------------
// Negotiation opener renderer
// ---------------------------------------------------------------------------

/**
 * Rewrites negotiation_opener to strip any verdict language.
 * Keeps AI-generated text if it passes the rule check.
 */

const BANNED_PHRASES = [
  "good deal", "bad deal", "great deal", "terrible deal",
  "buy it", "skip it", "walk away", "avoid this", "hard pass",
  "must buy", "don't buy", "I'd lean", "i'd lean",
  "steer you", "red flag", "green light",
];

export function renderNegotiationOpener(receipt: ListingReceipt): string {
  const opener = receipt.negotiation_opener ?? "";
  const lower = opener.toLowerCase();

  const hasBanned = BANNED_PHRASES.some((phrase) => lower.includes(phrase));
  if (!hasBanned) return opener;

  // Rewrite opener without banned phrases
  const vehicle = buildVehicleLabel(receipt);
  const price = receipt.listing_summary?.price;
  const currency = receipt.listing_summary?.currency ?? "USD";
  const symbol = currency === "GBP" ? "£" : "$";

  if (price) {
    return `For a ${vehicle} at ${symbol}${price.toLocaleString()}, consider leading with specific concerns from the listing rather than a general price question.`;
  }
  return `For this ${vehicle}, consider leading with specific items you want verified before committing to a price.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVehicleLabel(receipt: ListingReceipt): string {
  const ls = receipt.listing_summary;
  if (!ls) return "vehicle";
  const parts = [ls.year, ls.make, ls.model, ls.trim].filter(Boolean);
  return parts.join(" ") || "vehicle";
}

// ---------------------------------------------------------------------------
// Apply all renderers to a receipt
// ---------------------------------------------------------------------------

/**
 * Run all renderers over a receipt in-place and return the patched receipt.
 * Called in the background function after scoring, before DB save.
 */
export function applyRenderer(receipt: ListingReceipt): ListingReceipt {
  return {
    ...receipt,
    verdict_reason: renderVerdictReason(receipt),
    negotiation_opener: renderNegotiationOpener(receipt),
    price_sanity: receipt.price_sanity
      ? {
          ...receipt.price_sanity,
          rationale_short: renderPriceSanity(receipt),
        }
      : receipt.price_sanity,
  };
}
