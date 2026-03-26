"use client";

import { useState } from "react";
import { TrendingDown, ExternalLink, CircleDollarSign, Info, Calculator } from "lucide-react";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";

interface AuctionBidGuidanceCardProps {
  result: SalvageRiskResult;
  /** Asking/listing price in dollars, if parsed from listing */
  askingPrice?: number | null;
  /** Current auction bid in dollars, if known */
  currentBid?: number | null;
  vin?: string | null;
}

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

export default function AuctionBidGuidanceCard({ result, askingPrice, currentBid, vin }: AuctionBidGuidanceCardProps) {
  const [manualBid, setManualBid] = useState("");
  const { grade, score, suggested_bid_discount } = result;

  const gradeLabel = grade === "green" ? "Low Risk" : grade === "yellow" ? "Moderate Risk" : "High Risk";
  const gradeBg = grade === "green" ? "bg-green-50 border-green-200" : grade === "yellow" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  const gradeText = grade === "green" ? "text-green-800" : grade === "yellow" ? "text-amber-800" : "text-red-800";

  const discountNote =
    suggested_bid_discount > 0
      ? `Suggest bidding ${suggested_bid_discount}% below retail book value to account for salvage risk.`
      : "This vehicle scores well — standard auction bidding applies.";

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

      {/* Grade summary */}
      <div className={`text-sm font-semibold ${gradeText}`}>
        Risk rating: <span className="font-bold">{gradeLabel}</span> ({score}/100 safety score)
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
