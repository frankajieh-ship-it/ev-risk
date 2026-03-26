"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2, TrendingUp, Wrench, DollarSign, ChevronDown, ChevronUp,
  AlertTriangle, Info, PencilLine, CheckCircle,
} from "lucide-react";
import type { ArbitrageResult } from "@/lib/copart-arbitrage-engine";
import { computeMaxSafeBid } from "@/lib/copart-arbitrage-engine";

interface ArbitrageCalculatorCardProps {
  receiptId: string;
  vin: string | null;
  listingText: string;
  askingPrice: number | null;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  receiptToken: string;
}

type FetchState = "idle" | "loading" | "done" | "error";

const CONFIDENCE_CONFIG = {
  high: { label: "High confidence", class: "text-green-700 bg-green-50 border-green-200" },
  medium: { label: "Moderate confidence", class: "text-amber-700 bg-amber-50 border-amber-200" },
  low: { label: "Low confidence — inspect before bidding", class: "text-red-700 bg-red-50 border-red-200" },
};

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

export default function ArbitrageCalculatorCard({
  receiptId, vin, listingText, askingPrice, make, model, year, trim, receiptToken,
}: ArbitrageCalculatorCardProps) {
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [result, setResult] = useState<ArbitrageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetMargin, setTargetMargin] = useState(20);
  const [repairOpen, setRepairOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [customArv, setCustomArv] = useState<string>("");
  const [editingArv, setEditingArv] = useState(false);

  const fetchArbitrage = useCallback(async () => {
    setFetchState("loading");
    setError(null);
    try {
      const res = await fetch("/api/copart/arbitrage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: receiptId,
          receipt_token: receiptToken,
          vin,
          listing_text: listingText,
          asking_price: askingPrice,
          make,
          model,
          year,
          trim,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Analysis failed.");
        setFetchState("error");
        return;
      }
      setResult(data.result as ArbitrageResult);
      setFetchState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection error.");
      setFetchState("error");
    }
  }, [receiptId, receiptToken, vin, listingText, askingPrice, make, model, year, trim]);

  useEffect(() => {
    if (fetchState === "idle") fetchArbitrage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Effective ARV: custom override > API result
  const effectiveArv = useMemo(() => {
    const parsed = parseFloat(customArv.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return result?.arv ?? null;
  }, [customArv, result]);

  // Live max safe bid — pure client math
  const maxSafeBid = useMemo(() => {
    if (!effectiveArv || !result) return null;
    return computeMaxSafeBid(
      effectiveArv,
      result.repair_cost_estimate,
      result.auction_fees_estimate,
      targetMargin
    );
  }, [effectiveArv, result, targetMargin]);

  if (fetchState === "loading") {
    return (
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
        <p className="text-sm text-orange-700 font-medium">Running arbitrage analysis...</p>
        <p className="text-xs text-orange-500">Fetching market data + repair estimates</p>
      </div>
    );
  }

  if (fetchState === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <button onClick={fetchArbitrage} className="text-xs text-red-600 underline hover:text-red-800">
          Try again
        </button>
      </div>
    );
  }

  if (!result) return null;

  const confidenceCfg = CONFIDENCE_CONFIG[result.confidence];
  const isBelowAskingPrice = askingPrice && maxSafeBid !== null && maxSafeBid < askingPrice;
  const partsOnlyBetter = maxSafeBid !== null && maxSafeBid <= 0;

  return (
    <div className="rounded-2xl border border-orange-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Arbitrage Calculator</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${confidenceCfg.class}`}>
            {confidenceCfg.label}
          </span>
        </div>
        <p className="text-xs text-orange-100 mt-0.5">
          Damage: {result.damage_type_inferred}
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* ARV row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500 font-medium">After-Repair Value (ARV)</p>
              {result.arv_source === "auto_dev_listings" && result.arv_range && (
                <p className="text-xs text-gray-400">
                  Based on {result.arv_listing_count} comparable listings
                  ({fmt(result.arv_range.low)} – {fmt(result.arv_range.high)})
                </p>
              )}
              {result.arv_source === "vin_msrp" && (
                <p className="text-xs text-gray-400">From VIN market data (no live listings found)</p>
              )}
            </div>
          </div>

          {result.arv !== null && !editingArv ? (
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-gray-900">{fmt(effectiveArv ?? result.arv)}</span>
              <button
                onClick={() => { setEditingArv(true); setCustomArv(String(effectiveArv ?? result.arv ?? "")); }}
                className="text-gray-400 hover:text-gray-600"
                title="Override ARV"
              >
                <PencilLine className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : result.arv === null && !editingArv ? (
            <div className="flex flex-col items-end gap-1">
              <p className="text-xs text-gray-400">Market data unavailable</p>
              <button
                onClick={() => setEditingArv(true)}
                className="text-xs text-orange-600 underline"
              >
                Enter known ARV
              </button>
            </div>
          ) : null}

          {editingArv && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-500">$</span>
              <input
                type="number"
                value={customArv}
                onChange={(e) => setCustomArv(e.target.value)}
                placeholder="e.g. 32000"
                className="w-28 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <button
                onClick={() => setEditingArv(false)}
                className="text-green-600 hover:text-green-800"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Repair cost row */}
        <div>
          <button
            onClick={() => setRepairOpen((o) => !o)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-gray-400" />
              <div className="text-left">
                <p className="text-xs text-gray-500 font-medium">Repair Cost Estimate</p>
                <p className="text-xs text-gray-400">
                  {fmt(result.repair_cost_low)} – {fmt(result.repair_cost_high)} range
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-gray-900">{fmt(result.repair_cost_estimate)}</span>
              {repairOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {repairOpen && result.repair_cost_breakdown.length > 0 && (
            <div className="mt-2 space-y-1.5 pl-6">
              {result.repair_cost_breakdown.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-xs">
                  <div>
                    <span className="text-gray-700 font-medium">{item.component}</span>
                    {item.notes && <span className="text-gray-400 ml-1">— {item.notes}</span>}
                  </div>
                  <span className="text-gray-600 flex-shrink-0">
                    {fmt(item.cost_low)} – {fmt(item.cost_high)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Max safe bid + margin slider */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">
              Max Safe Bid ({targetMargin}% margin)
            </p>
            {isBelowAskingPrice && (
              <span className="text-xs text-red-600 font-medium">
                Below asking price ({fmt(askingPrice!)})
              </span>
            )}
          </div>

          {partsOnlyBetter ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700">Parts-only strategy recommended</p>
                <p className="text-xs text-red-600 mt-0.5">
                  At {targetMargin}% margin, repair costs + fees exceed ARV. Strip for parts instead.
                  Estimated parts value: <span className="font-semibold">{fmt(result.parts_value)}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-3xl font-bold text-gray-900">
              {maxSafeBid !== null ? fmt(maxSafeBid) : "—"}
            </p>
          )}

          {/* Margin slider */}
          {effectiveArv && (
            <div className="space-y-1">
              <input
                type="range"
                min={10}
                max={30}
                step={5}
                value={targetMargin}
                onChange={(e) => setTargetMargin(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-400">
                {[10, 15, 20, 25, 30].map((v) => (
                  <span key={v} className={targetMargin === v ? "text-orange-600 font-semibold" : ""}>{v}%</span>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center">
                Adjust target profit margin — bid updates live
              </p>
            </div>
          )}

          {/* Fee breakdown note */}
          <div className="flex items-start gap-1.5 text-xs text-gray-400">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              Includes est. auction fees of {fmt(result.auction_fees_estimate)} (buyer fee + title + transport).
            </span>
          </div>
        </div>

        {/* Parts value accordion */}
        {result.parts_value > 0 && (
          <div>
            <button
              onClick={() => setPartsOpen((o) => !o)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-500 font-medium text-left">
                  Parts-Only Value
                  <span className="text-gray-400 ml-1">(if not worth repairing)</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-gray-900">{fmt(result.parts_value)}</span>
                {partsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {partsOpen && result.parts_value_breakdown.length > 0 && (
              <div className="mt-2 space-y-1.5 pl-6">
                {result.parts_value_breakdown.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <span className="text-gray-700 font-medium">{item.component}</span>
                      {item.notes && <span className="text-gray-400 ml-1">— {item.notes}</span>}
                    </div>
                    <span className="text-gray-600 flex-shrink-0">
                      {fmt(item.cost_low)} – {fmt(item.cost_high)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Caveats */}
        {result.caveats.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500">Things to verify before bidding:</p>
            {result.caveats.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                {c}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
