"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2, TrendingUp, Wrench, DollarSign, ChevronDown, ChevronUp,
  AlertTriangle, Info, PencilLine, CheckCircle, Zap, Package,
} from "lucide-react";
import type { ArbitrageResult, CopartFeeBreakdown, MarketClosingRange } from "@/lib/copart-arbitrage-engine";
import { computeMaxSafeBid, computeExpectedProfits, computeSafeBidRange, computeProfitScenarios } from "@/lib/copart-arbitrage-engine";
import { Badge } from "@/components/ui";

// ── Fee breakdown sub-component ──────────────────────────────────────────────

function FeeBreakdown({ breakdown }: { breakdown: CopartFeeBreakdown }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
      >
        <Info className="w-3 h-3" />
        Auction fees: {fmt(breakdown.total)}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-1 pl-4 text-xs text-gray-500">
          <div className="flex justify-between"><span>Buyer fee (tiered)</span><span>{fmt(breakdown.buyer_fee)}</span></div>
          <div className="flex justify-between"><span>Gate / processing</span><span>{fmt(breakdown.gate_fee)}</span></div>
          <div className="flex justify-between"><span>Internet fee</span><span>{fmt(breakdown.internet_fee)}</span></div>
          <div className="flex justify-between"><span>Title / transfer</span><span>{fmt(breakdown.title_fee)}</span></div>
          {breakdown.transport_estimate > 0 && (
            <div className="flex justify-between"><span>Transport estimate</span><span>{fmt(breakdown.transport_estimate)}</span></div>
          )}
          <div className="flex justify-between font-semibold text-gray-700 pt-1 border-t border-gray-200">
            <span>Total fees</span><span>{fmt(breakdown.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── OFFO vs Market comparison ─────────────────────────────────────────────────

function OFFOvsMarket({
  offoRange,
  market,
}: {
  offoRange: { low: number; high: number };
  market: MarketClosingRange;
}) {
  let signal: string;
  let signalClass: string;
  if (offoRange.high < market.low) {
    signal = "Strong position — your ceiling is below where market closes";
    signalClass = "text-green-700 bg-green-50 border-green-200";
  } else if (offoRange.low > market.high) {
    signal = "Market pricing is low — verify condition carefully";
    signalClass = "text-amber-700 bg-amber-50 border-amber-200";
  } else {
    signal = "In the zone — you\u2019re competitive with market bidders";
    signalClass = "text-blue-700 bg-blue-50 border-blue-200";
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-600">OFFO vs Market</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        <div className="p-3">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">OFFO Safe Bid</p>
          <p className="text-sm font-bold text-gray-900">{fmt(offoRange.low)} – {fmt(offoRange.high)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Your protected range</p>
        </div>
        <div className="p-3">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Market Est. Close</p>
          <p className="text-sm font-bold text-gray-900">{fmt(market.low)} – {fmt(market.high)}</p>
          <p className="text-xs text-gray-400 mt-0.5">~{fmt(market.midpoint)} median</p>
        </div>
      </div>
      <div className={`px-4 py-2 border-t border-gray-100 text-xs font-medium ${signalClass}`}>
        {signal}
      </div>
      <div className="px-4 py-1.5 bg-white">
        <p className="text-xs text-gray-400">{market.note}</p>
      </div>
    </div>
  );
}

interface ArbitrageCalculatorCardProps {
  receiptId: string;
  vin: string | null;
  listingText: string;
  askingPrice: number | null;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  /** Copart primary damage field (e.g. "Front End") — used directly, bypasses text inference */
  primaryDamage?: string | null;
  receiptToken: string;
  /** Called once when the arbitrage result is fetched — allows parent to show Deal Quality */
  onResult?: (result: ArbitrageResult) => void;
}

type FetchState = "idle" | "loading" | "done" | "error";
type Strategy = "repair" | "parts";

const CONFIDENCE_CONFIG = {
  high:   { label: "High confidence",                   class: "text-green-700 bg-green-50 border-green-200" },
  medium: { label: "Moderate confidence",               class: "text-amber-700 bg-amber-50 border-amber-200" },
  low:    { label: "Low confidence — inspect before bidding", class: "text-red-700 bg-red-50 border-red-200" },
};

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function fmtProfit(n: number) {
  return (n >= 0 ? "+" : "−") + fmt(Math.abs(n));
}

const DAMAGE_TYPE_OPTIONS = [
  { value: "front impact",    label: "Front-end impact" },
  { value: "rear impact",     label: "Rear-end impact" },
  { value: "side impact",     label: "Side impact / T-bone" },
  { value: "hail damage",     label: "Hail damage" },
  { value: "flood/water damage", label: "Flood / water damage" },
  { value: "fire damage",     label: "Fire damage" },
  { value: "rollover damage", label: "Rollover" },
  { value: "theft recovery",  label: "Theft recovery" },
];

const CONFIDENCE_REASONS: Record<string, string> = {
  low: "Damage type is unspecified or vague — repair cost range is wide. Narrowed once you confirm damage type below.",
  medium: "Damage involves electrical systems or partial information — estimate has moderate uncertainty.",
  high: "Damage type and vehicle data are clear — estimate is reliable.",
};

export default function ArbitrageCalculatorCard({
  receiptId, vin, listingText, askingPrice, make, model, year, trim, primaryDamage, receiptToken, onResult,
}: ArbitrageCalculatorCardProps) {
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [result, setResult] = useState<ArbitrageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetMargin, setTargetMargin] = useState(20);
  const [repairOpen, setRepairOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [customArv, setCustomArv] = useState<string>("");
  const [editingArv, setEditingArv] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("repair");
  const [selectedDamageType, setSelectedDamageType] = useState<string>("");
  const [repairCostAdj, setRepairCostAdj] = useState<number | null>(null); // user override multiplier (null = use API value)
  const [showBidExplainer, setShowBidExplainer] = useState(false);

   
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
          primary_damage: primaryDamage ?? null,
        }),
      });

      let data: { success: boolean; result?: ArbitrageResult; error?: string };
      try {
        data = await res.json();
      } catch {
        // Non-JSON response (504 timeout, Netlify function limit, HTML error page)
        setError(`Server error (HTTP ${res.status}) — tap "Try again" to retry.`);
        setFetchState("error");
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.error || `Request failed (${res.status}). Please try again.`);
        setFetchState("error");
        return;
      }
      const r = data.result as ArbitrageResult;
      setResult(r);
      onResult?.(r);
      // Default to recommended strategy if available
      if (r.recommended_strategy) setStrategy(r.recommended_strategy);
      setFetchState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection error.");
      setFetchState("error");
    }
  }, [receiptId, receiptToken, vin, listingText, askingPrice, make, model, year, trim, primaryDamage, onResult]);  

  useEffect(() => {
    if (fetchState === "idle") fetchArbitrage(); // eslint-disable-line react-hooks/set-state-in-effect
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Effective ARV: custom override > API result > synthetic back-solve from market closing estimate
  const effectiveArv = useMemo(() => {
    const parsed = parseFloat(customArv.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed > 0) return parsed;
    if (result?.arv != null) return result.arv;
    // Synthesize ARV from market closing midpoint (historically closes at ~38% of clean ARV)
    if (result?.market_closing_estimate?.midpoint) {
      return Math.round(result.market_closing_estimate.midpoint / 0.38 / 100) * 100;
    }
    return null;
  }, [customArv, result]);

  // Repair cost values — use user adjustment if set, otherwise API values
  const effectiveRepairMid = useMemo(() => {
    if (!result) return 0;
    return repairCostAdj !== null ? repairCostAdj : result.repair_cost_estimate;
  }, [result, repairCostAdj]);

  const effectiveRepairLow = useMemo(() => {
    if (!result) return 0;
    if (repairCostAdj !== null) return repairCostAdj * 0.85;
    return result.repair_cost_low > 0 ? result.repair_cost_low : result.repair_cost_estimate * 0.85;
  }, [result, repairCostAdj]);

  const effectiveRepairHigh = useMemo(() => {
    if (!result) return 0;
    if (repairCostAdj !== null) return repairCostAdj * 1.15;
    return result.repair_cost_high > 0 ? result.repair_cost_high : result.repair_cost_estimate * 1.15;
  }, [result, repairCostAdj]);

  // Live max safe bid (repair strategy midpoint)
  const maxSafeBid = useMemo(() => {
    if (!effectiveArv || !result) return null;
    return computeMaxSafeBid(effectiveArv, effectiveRepairMid, result.auction_fees_estimate, targetMargin);
  }, [effectiveArv, result, targetMargin, effectiveRepairMid]);

  // Live safe bid range
  const liveSafeBidRange = useMemo(() => {
    if (!effectiveArv || !result) return null;
    if (effectiveRepairLow > 0) {
      return computeSafeBidRange(effectiveArv, effectiveRepairLow, effectiveRepairHigh, result.auction_fees_estimate, targetMargin);
    }
    return null;
  }, [effectiveArv, result, targetMargin, effectiveRepairLow, effectiveRepairHigh]);

  // Live expected profit at asking price
  const { repair: liveExpectedRepair, parts: liveExpectedParts } = useMemo(() => {
    if (!result) return { repair: null, parts: null };
    return computeExpectedProfits(effectiveArv, result.parts_value, askingPrice, effectiveRepairMid, result.auction_fees_estimate);
  }, [effectiveArv, result, askingPrice, effectiveRepairMid]);

  // Live profit scenarios for repair strategy
  const liveProfitScenarios = useMemo(() => {
    if (!effectiveArv || !result || !askingPrice || effectiveRepairMid <= 0) return null;
    return computeProfitScenarios(effectiveArv, askingPrice, effectiveRepairLow, effectiveRepairMid, effectiveRepairHigh, result.auction_fees_estimate);
  }, [effectiveArv, result, askingPrice, effectiveRepairLow, effectiveRepairMid, effectiveRepairHigh]);

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
  const repairUnviable = maxSafeBid !== null && maxSafeBid <= 0;
  const isUnspecifiedDamage = result.damage_type_inferred === "unspecified damage";
  // Use user-selected damage type label for display when original is unspecified
  const displayDamage = isUnspecifiedDamage && selectedDamageType
    ? DAMAGE_TYPE_OPTIONS.find(o => o.value === selectedDamageType)?.label ?? result.damage_type_inferred
    : result.damage_type_inferred;

  const activeProfit = strategy === "repair" ? liveExpectedRepair : liveExpectedParts;

  return (
    <div className="card-base overflow-hidden border-orange-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Arbitrage Calculator</h3>
          <Badge variant={
            result.confidence === "high" ? "success" :
            result.confidence === "medium" ? "warning" : "danger"
          }>
            {confidenceCfg.label}
          </Badge>
        </div>
        <p className="text-xs text-orange-100 mt-0.5">
          Damage: {displayDamage}
        </p>
        {/* Confidence reason — shown inline under the badge */}
        {result.confidence !== "high" && (
          <p className="text-xs text-orange-200 mt-1.5">
            {CONFIDENCE_REASONS[result.confidence]}
          </p>
        )}
      </div>

      <div className="p-5 space-y-5">

        {/* ── OFFO Safe Bid Hero — always first ── */}
        <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">OFFO Safe Bid</p>
              <button
                onClick={() => setShowBidExplainer((v) => !v)}
                className="text-gray-500 hover:text-gray-300"
                title="What's the difference?"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            {result.market_closing_estimate && (
              <p className="text-xs text-gray-400">
                Market closes ~{fmt(result.market_closing_estimate.midpoint)}
              </p>
            )}
          </div>
          {showBidExplainer && (
            <div className="rounded-lg bg-gray-800 border border-gray-700 p-3 space-y-2 text-xs text-gray-300">
              <p><span className="text-orange-400 font-semibold">OFFO Safe Bid</span> — the max <em>you</em> should pay to hit your profit margin target after repair costs, auction fees, and your buffer.</p>
              <p><span className="text-gray-200 font-semibold">Market Est. Close</span> — what the auction crowd will likely bid. Salvage lots typically close at 35–45% of clean market value.</p>
              <p className="text-gray-400">If your Safe Bid is <em>above</em> market close → you have room. If it&apos;s <em>below</em> → the crowd will outbid a profitable purchase.</p>
            </div>
          )}

          {liveSafeBidRange ? (
            <div>
              <p className="text-4xl font-extrabold text-white tracking-tight">
                {fmt(liveSafeBidRange.low)} – {fmt(liveSafeBidRange.high)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {targetMargin}% margin · based on repair cost range · {confidenceCfg.label}
              </p>
            </div>
          ) : repairUnviable ? (
            <div>
              <p className="text-2xl font-extrabold text-red-400">Not viable at {targetMargin}%</p>
              <p className="text-xs text-gray-400 mt-1">Repair costs + fees exceed ARV — try Parts strategy</p>
            </div>
          ) : (
            <div>
              <p className="text-2xl font-extrabold text-gray-500">—</p>
              <p className="text-xs text-gray-500 mt-1">Enter ARV above to calculate</p>
            </div>
          )}

          {/* Margin slider inline */}
          {effectiveArv && (
            <div className="space-y-1 pt-1">
              <input
                type="range"
                min={10}
                max={30}
                step={5}
                value={targetMargin}
                onChange={(e) => setTargetMargin(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                {[10, 15, 20, 25, 30].map((v) => (
                  <span key={v} className={targetMargin === v ? "text-orange-400 font-bold" : ""}>{v}%</span>
                ))}
              </div>
            </div>
          )}

          {/* OFFO vs Market inline */}
          {result.market_closing_estimate && liveSafeBidRange && (
            <div className="pt-1 border-t border-white/10 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Your range</p>
                <p className="text-sm font-bold text-white">{fmt(liveSafeBidRange.low)} – {fmt(liveSafeBidRange.high)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Market est. close</p>
                <p className="text-sm font-bold text-gray-300">{fmt(result.market_closing_estimate.low)} – {fmt(result.market_closing_estimate.high)}</p>
              </div>
            </div>
          )}

          {/* Fee summary */}
          {result.auction_fees_breakdown ? (
            <div className="pt-1">
              <FeeBreakdown breakdown={result.auction_fees_breakdown} />
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Est. auction fees: {fmt(result.auction_fees_estimate)} included
            </p>
          )}
        </div>

        {/* ── Strategy Switcher ── */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setStrategy("repair")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
              strategy === "repair"
                ? "bg-orange-500 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Repair Strategy
            {result.recommended_strategy === "repair" && (
              <span className={`ml-1 px-1 py-0.5 rounded text-xs font-bold ${strategy === "repair" ? "bg-white/30 text-white" : "bg-orange-100 text-orange-700"}`}>
                REC
              </span>
            )}
          </button>
          <div className="w-px bg-gray-200" />
          <button
            onClick={() => setStrategy("parts")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
              strategy === "parts"
                ? "bg-orange-500 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Parts Strategy
            {result.recommended_strategy === "parts" && (
              <span className={`ml-1 px-1 py-0.5 rounded text-xs font-bold ${strategy === "parts" ? "bg-white/30 text-white" : "bg-orange-100 text-orange-700"}`}>
                REC
              </span>
            )}
          </button>
        </div>

        {/* ── Expected Profit (strategy-aware, prominent) ── */}
        {activeProfit !== null && (
          <div className={`rounded-xl border p-4 ${activeProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <p className="text-xs font-semibold text-gray-500 mb-1">
              Expected Profit — {strategy === "repair" ? "Repair" : "Parts"} Strategy
            </p>
            <p className={`text-3xl font-extrabold ${activeProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
              {fmtProfit(activeProfit)}
            </p>
            <p className="text-xs text-gray-400 mt-1">At asking price · no margin — raw P&L</p>
          </div>
        )}

        {/* ── ARV row ── */}
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
              {result.arv_source === "depreciation_curve" && (
                <p className="text-xs text-amber-600 font-medium">Estimated — no live listings found</p>
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
              <button onClick={() => setEditingArv(true)} className="text-xs text-orange-600 underline">
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
              <button onClick={() => setEditingArv(false)} className="text-green-600 hover:text-green-800">
                <CheckCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ── Damage type refinement (shown when damage is unspecified) ── */}
        {isUnspecifiedDamage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-800">Damage type unspecified — refine estimate</p>
            </div>
            <select
              value={selectedDamageType}
              onChange={(e) => setSelectedDamageType(e.target.value)}
              className="w-full text-sm border border-amber-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 text-gray-700"
            >
              <option value="">— Select damage type —</option>
              {DAMAGE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {selectedDamageType && (
              <p className="text-xs text-amber-700">
                Repair costs updated for <strong>{DAMAGE_TYPE_OPTIONS.find(o => o.value === selectedDamageType)?.label}</strong>.
                For a precise re-analysis, save this and re-run with updated listing text.
              </p>
            )}
          </div>
        )}

        {/* ── Repair cost row (shown in repair strategy) ── */}
        {strategy === "repair" && (
          <div className="space-y-2">
            <button
              onClick={() => setRepairOpen((o) => !o)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-gray-400" />
                <div className="text-left">
                  <p className="text-xs text-gray-500 font-medium">
                    Repair Cost Estimate
                    {repairCostAdj !== null && (
                      <span className="ml-1.5 text-orange-500 text-xs font-semibold">ADJUSTED</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {fmt(effectiveRepairLow)} – {fmt(effectiveRepairHigh)} range
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-gray-900">{fmt(effectiveRepairMid)}</span>
                {repairOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Repair cost adjustment slider */}
            {result.repair_cost_estimate > 0 && (
              <div className="px-1 space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Adjust estimate</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">{fmt(effectiveRepairMid)}</span>
                    {repairCostAdj !== null && (
                      <button
                        onClick={() => setRepairCostAdj(null)}
                        className="text-orange-500 underline text-xs"
                      >reset</button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={Math.round(result.repair_cost_estimate * 0.25)}
                  max={Math.round(result.repair_cost_estimate * 2.5)}
                  step={250}
                  value={repairCostAdj ?? result.repair_cost_estimate}
                  onChange={(e) => setRepairCostAdj(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{fmt(result.repair_cost_estimate * 0.25)}</span>
                  <span className="text-gray-300">AI estimate: {fmt(result.repair_cost_estimate)}</span>
                  <span>{fmt(result.repair_cost_estimate * 2.5)}</span>
                </div>
              </div>
            )}

            {repairOpen && result.repair_cost_breakdown.length > 0 && (
              <div className="mt-1 space-y-1.5 pl-6">
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
        )}

        {/* ── Parts value (shown in parts strategy) ── */}
        {strategy === "parts" && result.parts_value > 0 && (
          <div>
            <button
              onClick={() => setPartsOpen((o) => !o)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-500 font-medium text-left">
                  Parts-Only Value
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

        {/* Asking price warning — shown below strategy when relevant */}
        {strategy === "repair" && isBelowAskingPrice && liveSafeBidRange && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700 font-medium">
              Safe bid ceiling ({fmt(liveSafeBidRange.high)}) is below asking price ({fmt(askingPrice!)})
            </p>
          </div>
        )}

        {/* ── Best / Worst / Likely scenarios (repair strategy, when data available) ── */}
        {strategy === "repair" && liveProfitScenarios && (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600">Profit Scenarios — Repair</p>
              <Badge variant={
                result.confidence === "high" ? "success" :
                result.confidence === "medium" ? "warning" : "danger"
              }>
                {confidenceCfg.label}
              </Badge>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                { label: "Best case",    value: liveProfitScenarios.best,   note: "optimistic repair cost" },
                { label: "Most likely",  value: liveProfitScenarios.likely, note: "midpoint estimate" },
                { label: "Worst case",   value: liveProfitScenarios.worst,  note: "conservative repair cost" },
              ].map(({ label, value, note }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span className="text-xs font-medium text-gray-700">{label}</span>
                    <span className="text-xs text-gray-400 ml-1.5">{note}</span>
                  </div>
                  <span className={`text-sm font-bold ${value >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {fmtProfit(value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Uncertainty range: {fmt(Math.abs(liveProfitScenarios.best - liveProfitScenarios.worst))} · Narrowed by getting a shop estimate first.
              </p>
            </div>
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
