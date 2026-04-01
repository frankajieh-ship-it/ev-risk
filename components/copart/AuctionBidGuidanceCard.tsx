"use client";

import { useState } from "react";
import { TrendingDown, ExternalLink, CircleDollarSign, Info, Calculator, ShieldCheck, TrendingUp, AlertTriangle, XCircle } from "lucide-react";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type { ArbitrageResult } from "@/lib/copart-arbitrage-engine";

interface AuctionBidGuidanceCardProps {
  result: SalvageRiskResult;
  /** Asking/listing price in dollars, if parsed from listing */
  askingPrice?: number | null;
  /** Current auction bid in dollars, if known */
  currentBid?: number | null;
  vin?: string | null;
  /** Arbitrage result, if available — used to derive Deal Quality score */
  arbitrage?: ArbitrageResult | null;
}

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function fmtProfit(n: number) {
  if (n >= 0) return "+" + fmt(n);
  return "−" + fmt(Math.abs(n));
}

/** Derive a 0–100 Deal Quality score from arbitrage financials */
function dealQualityScore(arbitrage: ArbitrageResult): {
  score: number;
  label: string;
  grade: "green" | "yellow" | "red";
  primary: number | null;
  strategy: "repair" | "parts";
} {
  const repairProfit = arbitrage.expected_profit_repair;
  const partsProfit = arbitrage.expected_profit_parts;
  const arv = arbitrage.arv;
  const strategy: "repair" | "parts" =
    partsProfit !== null && repairProfit !== null && partsProfit > repairProfit
      ? "parts"
      : "repair";

  // If no bid price but ARV + repair cost + market estimate available, compute proxy profit
  let bestProfit: number | null =
    repairProfit !== null && partsProfit !== null
      ? Math.max(repairProfit, partsProfit)
      : repairProfit ?? partsProfit;

  if (bestProfit === null && arv !== null && arbitrage.repair_cost_estimate > 0) {
    // Use market closing midpoint as proxy bid price when no current bid
    const proxyBid = arbitrage.market_closing_estimate?.midpoint ?? Math.round(arv * 0.38);
    bestProfit = arv - proxyBid - arbitrage.repair_cost_estimate - arbitrage.auction_fees_estimate;
  }

  // Last resort: if we have repair_cost_low/high and ARV, estimate using safe bid midpoint as proxy
  if (bestProfit === null && arv !== null && arbitrage.repair_cost_low > 0) {
    const proxyBid = arbitrage.market_closing_estimate?.midpoint ?? Math.round(arv * 0.38);
    const midRepair = Math.round((arbitrage.repair_cost_low + arbitrage.repair_cost_high) / 2);
    bestProfit = arv - proxyBid - midRepair - arbitrage.auction_fees_estimate;
  }

  // No ARV from market data — use market_closing_estimate midpoint as synthetic ARV
  // This allows Deal Quality to score even when Auto.dev returns no listings
  const effectiveArv = arv ?? (arbitrage.market_closing_estimate?.midpoint
    ? Math.round(arbitrage.market_closing_estimate.midpoint / 0.38) // back-solve from 38% closing ratio
    : null);

  if (bestProfit === null && effectiveArv !== null && arbitrage.repair_cost_estimate > 0) {
    const proxyBid = arbitrage.market_closing_estimate?.midpoint ?? Math.round(effectiveArv * 0.38);
    bestProfit = effectiveArv - proxyBid - arbitrage.repair_cost_estimate - arbitrage.auction_fees_estimate;
  }

  if (bestProfit === null || effectiveArv === null) {
    return { score: 50, label: "Calculating...", grade: "yellow", primary: null, strategy };
  }

  // Score: profit as % of ARV, mapped to 0–100
  const profitPct = bestProfit / effectiveArv;
  const score = Math.max(0, Math.min(100, Math.round(50 + profitPct * 200)));

  const grade: "green" | "yellow" | "red" = score >= 65 ? "green" : score >= 40 ? "yellow" : "red";
  const label = score >= 65 ? "Good Deal" : score >= 40 ? "Marginal Deal" : "Poor Deal";
  return { score, label, grade, primary: bestProfit, strategy };
}

export default function AuctionBidGuidanceCard({ result, askingPrice, currentBid, vin, arbitrage }: AuctionBidGuidanceCardProps) {
  const [manualBid, setManualBid] = useState("");
  const { grade, score, suggested_bid_discount } = result;

  // Repair Risk (structural/damage — from salvage score)
  const repairRiskLabel = grade === "green" ? "Low" : grade === "yellow" ? "Moderate" : "High";
  const repairRiskText = grade === "green" ? "text-green-700" : grade === "yellow" ? "text-amber-700" : "text-red-700";
  const repairRiskBg = grade === "green" ? "bg-green-50 border-green-200" : grade === "yellow" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  const RepairRiskIcon = grade === "green" ? ShieldCheck : grade === "yellow" ? AlertTriangle : XCircle;

  // Deal Quality (financial outcome — from arbitrage, if available)
  const dq = arbitrage ? dealQualityScore(arbitrage) : null;
  const dqText = dq ? (dq.grade === "green" ? "text-green-700" : dq.grade === "yellow" ? "text-amber-700" : "text-red-700") : "text-gray-500";
  const dqBg  = dq ? (dq.grade === "green" ? "bg-green-50 border-green-200" : dq.grade === "yellow" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200") : "bg-gray-50 border-gray-200";
  const DqIcon = dq ? (dq.grade === "green" ? TrendingUp : dq.grade === "yellow" ? AlertTriangle : XCircle) : Info;

  const gradeBg = grade === "green" ? "bg-green-50 border-green-200" : grade === "yellow" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  const discountNote =
    suggested_bid_discount > 0
      ? `Suggest bidding ${suggested_bid_discount}% below KBB clean private-party value to account for salvage title and unknown repair risk.`
      : "Risk score is strong. Verify title history, run a VIN check, and confirm no frame/structural damage before bidding.";

  // Determine reference price: asking price > current bid > manual entry
  const manualParsed = parseFloat(manualBid.replace(/[^0-9.]/g, ""));
  const manualValid = !isNaN(manualParsed) && manualParsed > 0;
  const refPrice = askingPrice || currentBid || (manualValid ? manualParsed : null);
  const showManualInput = !askingPrice && !currentBid;

  // Safe bid range: apply discount with ±buffer
  let safeBidLow: number | null = null;
  let safeBidHigh: number | null = null;
  if (refPrice && suggested_bid_discount > 0) {
    const discFraction = suggested_bid_discount / 100;
    safeBidLow  = Math.max(0, Math.round(refPrice * (1 - discFraction - 0.08) / 100) * 100);
    safeBidHigh = Math.max(0, Math.round(refPrice * (1 - discFraction + 0.04) / 100) * 100);
  } else if (refPrice && suggested_bid_discount === 0) {
    // Low-risk lot: light 5% buffer still gives a useful range
    safeBidLow  = Math.max(0, Math.round(refPrice * 0.90 / 100) * 100);
    safeBidHigh = Math.max(0, Math.round(refPrice * 0.97 / 100) * 100);
  }

  const refLabel = askingPrice ? "listing price" : currentBid ? "current bid" : "entered bid";

  const nhtsaUrl = vin
    ? `https://api.nhtsa.gov/recalls/recallsByVehicle?vin=${encodeURIComponent(vin)}`
    : "https://www.nhtsa.gov/vehicle-safety/recalls";

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${gradeBg}`}>
      <div className="flex items-center gap-2">
        <CircleDollarSign className="w-5 h-5 text-gray-600" />
        <h3 className="text-base font-bold text-gray-900">Bid Guidance</h3>
      </div>

      {/* Two-score split: Repair Risk + Deal Quality */}
      <div className="grid grid-cols-2 gap-3">
        {/* Repair Risk */}
        <div className={`rounded-xl border p-3 space-y-1 ${repairRiskBg}`}>
          <div className="flex items-center gap-1.5">
            <RepairRiskIcon className={`w-3.5 h-3.5 ${repairRiskText}`} />
            <p className="text-xs font-semibold text-gray-600">Repair Risk</p>
          </div>
          <p className={`text-lg font-bold ${repairRiskText}`}>{repairRiskLabel}</p>
          <p className="text-xs text-gray-500">{score}/100 structural</p>
        </div>
        {/* Deal Quality */}
        <div className={`rounded-xl border p-3 space-y-1 ${dqBg}`}>
          <div className="flex items-center gap-1.5">
            <DqIcon className={`w-3.5 h-3.5 ${dqText}`} />
            <p className="text-xs font-semibold text-gray-600">Deal Quality</p>
          </div>
          {dq ? (
            <>
              <p className={`text-lg font-bold ${dqText}`}>{dq.label}</p>
              <p className="text-xs text-gray-500">{dq.score}/100 financial</p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-gray-400">—</p>
              <p className="text-xs text-gray-400">Run full analysis</p>
            </>
          )}
        </div>
      </div>

      {/* Discount recommendation */}
      {suggested_bid_discount > 0 && (
        <div className="flex items-start gap-2 p-3 bg-white/70 rounded-xl border border-white/50">
          <TrendingDown className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-800">{discountNote}</p>
        </div>
      )}

      {suggested_bid_discount === 0 && (
        <div className="flex items-start gap-2 p-3 bg-white/70 rounded-xl border border-white/50">
          <Info className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700">{discountNote}</p>
        </div>
      )}

      {/* ARV hint — shown when heuristic estimate is available */}
      {result.arv_hint_low != null && result.arv_hint_high != null && (
        <div className="p-3 bg-white/70 rounded-xl border border-white/50 space-y-1">
          <p className="text-xs font-semibold text-gray-600">Estimated post-repair market value</p>
          <p className="text-lg font-bold text-gray-900">
            {fmt(result.arv_hint_low)} – {fmt(result.arv_hint_high)}
          </p>
          <p className="text-xs text-gray-400">
            Rough range based on damage grade ·{" "}
            <span className="text-orange-600">Unlock for live ARV from market comps</span>
          </p>
        </div>
      )}

      {/* Manual bid entry — shown when no price was parsed from listing */}
      {showManualInput && suggested_bid_discount > 0 && (
        <div className="p-3 bg-white/70 rounded-xl border border-white/50 space-y-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-gray-700">Enter current auction bid for instant estimate</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="number"
              value={manualBid}
              onChange={(e) => setManualBid(e.target.value)}
              placeholder="e.g. 8500"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
            />
          </div>
        </div>
      )}

      {/* Safe bid range */}
      {safeBidLow !== null && safeBidHigh !== null && (
        <div className="p-3 bg-white rounded-xl border border-orange-200 space-y-1">
          <p className="text-xs font-semibold text-gray-600">
            Based on {refLabel}, estimated safe bid range:
          </p>
          <p className="text-xl font-bold text-gray-900">
            {fmt(safeBidLow)} – {fmt(safeBidHigh)}
          </p>
          <p className="text-xs text-gray-400">
            Rough estimate · {suggested_bid_discount}% risk discount applied.{" "}
            <span className="text-orange-600">Unlock full report for ARV-based precision.</span>
          </p>
        </div>
      )}

      {/* NHTSA link */}
      <a
        href={nhtsaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
        Check open recalls on NHTSA
      </a>
    </div>
  );
}
