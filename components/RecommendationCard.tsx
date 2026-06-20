"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Zap, MapPin, ExternalLink, Snowflake, CheckCircle2, Circle, ChevronUp, Bookmark } from "lucide-react";
import type { VehicleRecommendation } from "@/types/recommendations";
import type { MinimumViableRoutine } from "@/types/v2";
import { getCarGurusUrl } from "@/lib/cargurus-links";
import { ScoreImprovementSuggestions } from "./blocks/ScoreImprovementSuggestions";
import { useEventTracking } from "@/hooks/useEventTracking";
import VehicleImage from "./VehicleImage";
import { addToAnonGarage } from "@/lib/anon-garage";

const fitColors: Record<string, { bg: string; text: string; border: string }> = {
  "Great Fit":    { bg: "bg-[#00d97e]/10", text: "text-[#00d97e]", border: "border-[#00d97e]/20" },
  "Good Fit":     { bg: "bg-[#00d97e]/10", text: "text-[#00d97e]", border: "border-[#00d97e]/20" },
  "Mixed Fit":    { bg: "bg-[#00d97e]/10", text: "text-[#00d97e]", border: "border-[#00d97e]/20" },
  "High Friction":{ bg: "bg-[#00d97e]/10", text: "text-[#00d97e]", border: "border-[#00d97e]/20" },
};

const scoreBadgeColors: Record<string, string> = {
  "Great Fit":    "bg-[#00a862]",
  "Good Fit":     "bg-[#00a862]",
  "Mixed Fit":    "bg-[#00a862]",
  "High Friction":"bg-[#00a862]",
};

// ---- Matched Deal Strip ----

const SAVED_DEALS_KEY = "offo_saved_deals";

const SOURCE_LABELS: Record<string, string> = {
  cargurus: "CarGurus",
  autotrader: "AutoTrader",
  carsdotcom: "Cars.com",
  carmax: "CarMax",
};


function MatchedDealStrip({ deal }: { deal: NonNullable<VehicleRecommendation["matched_deals"]>[0] }) {
  const [saved, setSaved] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem(SAVED_DEALS_KEY) || "[]") as string[]).includes(deal.id);
    } catch { return false; }
  });

  const toggleSave = useCallback(() => {
    try {
      const existing: string[] = JSON.parse(localStorage.getItem(SAVED_DEALS_KEY) || "[]");
      if (saved) {
        localStorage.setItem(SAVED_DEALS_KEY, JSON.stringify(existing.filter((id) => id !== deal.id)));
      } else {
        localStorage.setItem(SAVED_DEALS_KEY, JSON.stringify([deal.id, ...existing]));
      }
      setSaved(!saved);
    } catch { /* ignore */ }
  }, [saved, deal.id]);

  return (
    <div className="border-t border-white/[0.08] px-5 py-3 bg-white/[0.02]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">Deal Watch Match</p>
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
        {deal.make && (
          <VehicleImage
            make={deal.make}
            model={deal.model ?? undefined}
            year={deal.year ?? undefined}
            className="w-full h-24"
            imgClassName="w-full h-full object-cover"
          />
        )}
        <div className="p-3">
          <p className="text-xs font-semibold text-white/90 leading-tight mb-1">{deal.vehicle_label}</p>
          <div className="text-sm font-bold text-white">
            {deal.price ? `$${deal.price.toLocaleString()}` : "—"}
            {deal.mileage ? <span className="text-white/40 text-xs font-normal ml-1.5">· {deal.mileage.toLocaleString()} mi</span> : null}
          </div>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={toggleSave}
              title={saved ? "Remove from garage" : "Save to garage"}
              className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors shrink-0 ${saved ? "border-[#00d97e]/40 text-[#00d97e] bg-[#00d97e]/10" : "border-white/[0.10] text-white/40 hover:text-white/70 hover:border-white/20"}`}
            >
              <svg className="w-3.5 h-3.5" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            <a
              href={deal.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs py-1.5 rounded-lg border border-white/[0.10] text-white/60 hover:text-white hover:border-white/20 transition-colors"
            >
              See Listing →
            </a>
            <a
              href={`/receipt?url=${encodeURIComponent(deal.listing_url)}&src=ev_routine`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs py-1.5 rounded-lg bg-[#00d97e]/10 text-[#00d97e] hover:bg-[#00d97e]/20 transition-colors"
            >
              See Full Report →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- End Matched Deal Strip ----

interface RecommendationCardProps {
  recommendation: VehicleRecommendation;
  onSelect: () => void;
  muted?: boolean;
  userZipCode?: string | null;
  weeklyMiles?: number;
  routine?: MinimumViableRoutine;
  isSelectedForCompare?: boolean;
  onToggleCompare?: (model: string) => void;
  onShortlistSave?: () => void;
}

const DIMENSION_DISPLAY: { key: keyof NonNullable<VehicleRecommendation["dimensions"]>; label: string }[] = [
  { key: "charging", label: "Charging fit"   },
  { key: "range",    label: "Range fit"      },
  { key: "budget",   label: "Cost fit"       },
  { key: "climate",  label: "Climate fit"    },
  { key: "recovery", label: "Longest-day fit"},
  { key: "utility",  label: "Utility fit"   },
];

const POSITIVE_NOTES: Record<string, string> = {
  charging: "Low charging burden for your setup",
  range:    "Comfortable range buffer for your miles",
  budget:   "Fits within your budget",
  climate:  "Handles your climate well",
  recovery: "Low risk on your longest days",
  utility:  "Matches your size and utility needs",
};
const LIMITING_NOTES: Record<string, string> = {
  charging: "Charging setup may add friction",
  range:    "Range may feel tight on longer days",
  budget:   "Slightly over your budget target",
  climate:  "Range reduction expected in your climate",
  recovery: "Longer days may require charging stops",
  utility:  "Body style or towing may not fully match",
};

function deriveRangeFields(rec: VehicleRecommendation, routine: MinimumViableRoutine) {
  const base = rec.real_world_range_mi;
  const winterMultiplier =
    routine.climate === "winter"
      ? routine.parking_exposure === "street"  ? 0.80
      : routine.parking_exposure === "outdoor" ? 0.85
      : 0.88
      : 1.0;
  const winterRange = Math.round(base * winterMultiplier);

  const peakMiles = Math.max(
    routine.commute_miles_roundtrip ?? 0,
    routine.longest_day_miles ?? (routine.weekly_miles ?? 100) / 5,
  );
  const bufferPct = Math.round(((base - peakMiles) / base) * 100);
  const bufferLabel = bufferPct >= 40 ? "comfortable" : bufferPct >= 20 ? "adequate" : "tight";
  return { winterRange, bufferPct, bufferLabel };
}

function formatPrice(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString();
}

function scoreToLabel(score: number): string {
  if (score >= 80) return "Great Fit";
  if (score >= 65) return "Good Fit";
  if (score >= 45) return "Mixed Fit";
  return "High Friction";
}

export default function RecommendationCard({
  recommendation: rec,
  onSelect,
  muted,
  userZipCode,
  weeklyMiles,
  routine,
  isSelectedForCompare,
  onToggleCompare,
  onShortlistSave,
}: RecommendationCardProps) {
  const { trackExternalLinkClicked } = useEventTracking();
  const [expanded, setExpanded] = useState(false);
  const [shortlistSaved, setShortlistSaved] = useState(false);
  const [shortlistToast, setShortlistToast] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [searchHintVisible, setSearchHintVisible] = useState(false);

  const rangeFields = routine ? deriveRangeFields(rec, routine) : null;
  const cost = rec.ownership_cost_5y ?? null;

  // Score breakdown helpers
  const dims = rec.dimensions;
  const dimEntries = dims
    ? DIMENSION_DISPLAY.map((d) => ({ ...d, score: dims[d.key] ?? 75 }))
    : [];
  const bestDim  = dimEntries.length ? dimEntries.reduce((a, b) => a.score >= b.score ? a : b) : null;
  const worstDim = dimEntries.length ? dimEntries.reduce((a, b) => a.score <= b.score ? a : b) : null;
  const fitLabel = scoreToLabel(rec.fit_score);
  const colors = fitColors[fitLabel] ?? fitColors["Mixed Fit"];
  const badgeBg = scoreBadgeColors[fitLabel] ?? "bg-white/20";
  const hasDealers = rec.dealer_listings.length > 0;
  const totalListings = rec.dealer_listings.reduce((sum, d) => sum + d.listing_count, 0);

  // Generate CarGurus URL
  const carGurusUrl = getCarGurusUrl(rec.make, rec.model_short, {
    year: rec.year,
    zip: userZipCode ?? undefined,
    range_mi: rec.real_world_range_mi,
    weekly_miles: weeklyMiles,
    budget_max: routine?.budget_max,
  });

  // Estimate 10–80% charge time from DC fast rate
  const charging1080Min = rec.dc_fast_kw && rec.dc_fast_kw > 0
    ? Math.round((0.70 * rec.battery_kwh / rec.dc_fast_kw) * 60)
    : null;

  // Handle external link clicks
  const handleCarGurusClick = (e: React.MouseEvent) => {
    e.preventDefault();
    trackExternalLinkClicked({
      link_type: "other",
      destination_url: carGurusUrl,
      vehicle_context: {
        make: rec.make,
        model: rec.model_short,
        year: rec.year,
      },
      clicked_from_page: window.location.pathname,
      link_text: "Search listings",
      session_id: "", // Will be added by tracking hook
    });
    // Show extension hint if available, then open tab
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasExtension = !!(window as any).chrome?.runtime?.sendMessage;
    if (hasExtension) {
      setSearchHintVisible(true);
      setTimeout(() => {
        setSearchHintVisible(false);
        window.open(carGurusUrl, "_blank", "noopener,noreferrer");
      }, 1500);
    } else {
      window.open(carGurusUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleShortlistSave = () => {
    addToAnonGarage({
      type: "shortlist",
      label: `${rec.year} ${rec.make} ${rec.model_short}`,
      data: {
        make: rec.make,
        model: rec.model_short,
        year: rec.year,
        fit_score: rec.fit_score,
        fit_label: rec.fit_label,
        epa_range_mi: rec.epa_range_mi,
      },
    });
    setShortlistSaved(true);
    setShortlistToast(true);
    onShortlistSave?.();
    setTimeout(() => setShortlistToast(false), 2000);
  };

  return (
    <div className={`rounded-2xl border-2 ${isSelectedForCompare ? "border-[#00d97e] shadow-lg shadow-[#00d97e]/10" : colors.border} ${muted ? "opacity-50" : ""} bg-white/[0.05] overflow-hidden transition-shadow hover:shadow-md`}>
      {/* Vehicle photo strip */}
      <div className="relative h-44 w-full bg-[#161b22]">
        <VehicleImage
          make={rec.make}
          model={rec.model_short}
          year={rec.year}
          className="w-full h-full"
          imgClassName="w-full h-full object-contain"
        />
        {/* Score badge overlaid on photo */}
        <div className={`absolute top-3 left-3 ${badgeBg} text-white w-12 h-12 rounded-xl flex flex-col items-center justify-center shadow-md`}>
          <span className="text-lg font-bold leading-none">{rec.fit_score}</span>
        </div>
        {/* Fit label overlaid on photo */}
        <div className="absolute bottom-3 left-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm ${colors.bg} ${colors.text}`}>
            {fitLabel}
          </span>
        </div>
        {/* Top-right controls: bookmark + compare toggle */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            onClick={handleShortlistSave}
            disabled={shortlistSaved}
            aria-label={shortlistSaved ? "Saved to shortlist" : "Save to shortlist"}
            className={`flex items-center justify-center w-7 h-7 rounded-full backdrop-blur-sm shadow-sm border transition-colors ${
              shortlistSaved
                ? "bg-[#00d97e]/20 border-[#00d97e]/40 text-[#00d97e]"
                : "bg-[#0d1117]/70 border-white/10 text-white/60 hover:text-white hover:bg-[#0d1117]/90"
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${shortlistSaved ? "fill-current" : ""}`} />
          </button>
          {onToggleCompare && (
            <button
              onClick={() => onToggleCompare(rec.model)}
              aria-label={isSelectedForCompare ? "Remove from compare" : "Add to compare"}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#0d1117]/70 backdrop-blur-sm shadow-sm hover:bg-[#0d1117]/90 transition-colors border border-white/10"
            >
              {isSelectedForCompare
                ? <><CheckCircle2 className="w-3.5 h-3.5 text-[#00d97e]" /><span className="text-[#00d97e]">Selected</span></>
                : <><Circle className="w-3.5 h-3.5 text-white/40" /><span className="text-white/60">Compare</span></>
              }
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Vehicle name + year */}
        <div className="mb-3">
          <h3 className="text-lg font-bold text-white leading-tight">{rec.model}</h3>
          <span className="text-xs text-white/40">{rec.year}</span>
        </div>

        {/* Specs row */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1 text-xs bg-white/[0.07] text-white/70 px-2 py-1 rounded-full">
            <Zap className="w-3 h-3" />
            {rec.real_world_range_mi} mi range
          </span>
          {rangeFields && routine?.climate === "winter" && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full">
              <Snowflake className="w-3 h-3" />
              ~{rangeFields.winterRange} mi winter
            </span>
          )}
          <span className="text-xs bg-white/[0.07] text-white/70 px-2 py-1 rounded-full">
            {rec.battery_kwh} kWh
          </span>
          <span className="text-xs bg-white/[0.07] text-white/70 px-2 py-1 rounded-full">
            {rec.chemistry}
          </span>
          {charging1080Min !== null && (
            <span className="inline-flex items-center gap-1 text-xs bg-white/[0.07] text-white/70 px-2 py-1 rounded-full">
              ⚡ ~{charging1080Min} min 10–80%
            </span>
          )}
          {rec.incentive_new === true && (
            <span
              className="inline-flex items-center gap-1 text-xs bg-[#00d97e]/10 text-[#00d97e] border border-[#00d97e]/20 px-2 py-1 rounded-full cursor-help"
              title="Income and dealer-point restrictions apply — verify eligibility"
            >
              $7,500 fed. credit possible
            </span>
          )}
          {rec.seating_capacity && rec.seating_capacity >= 6 && (
            <span className="inline-flex items-center gap-1 text-xs bg-white/[0.07] text-white/70 px-2 py-1 rounded-full">
              🪑 {rec.seating_capacity}-seat
            </span>
          )}
          {rec.tow_capacity_lbs && rec.tow_capacity_lbs >= 1000 && (
            <span className="inline-flex items-center gap-1 text-xs bg-white/[0.07] text-white/70 px-2 py-1 rounded-full">
              🔗 Tows {rec.tow_capacity_lbs.toLocaleString()} lbs
            </span>
          )}
          {rec.zero_to_60_sec && rec.zero_to_60_sec <= 4.0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded-full">
              ⚡ 0–60 in {rec.zero_to_60_sec}s
            </span>
          )}
          {cost && cost.total > 0 && (
            <button
              onClick={() => setShowCostBreakdown(!showCostBreakdown)}
              className="inline-flex items-center gap-1 text-xs bg-white/[0.07] text-white/60 hover:bg-white/[0.10] px-2 py-1 rounded-full transition-colors"
            >
              ~${Math.round(cost.total / 1000)}k est. 5-yr cost
              {showCostBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Longest-day buffer */}
        {rangeFields && (
          <p className="mt-2 text-xs text-white/40">
            Longest-day buffer: <span className={
              rangeFields.bufferLabel === "comfortable" ? "text-[#00d97e] font-medium" :
              rangeFields.bufferLabel === "adequate"    ? "text-amber-400 font-medium" :
                                                          "text-red-400 font-medium"
            }>{rangeFields.bufferLabel}</span>
            {" "}({rangeFields.bufferPct}% margin)
          </p>
        )}

        {/* Cost breakdown */}
        <AnimatePresence>
          {showCostBreakdown && cost && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-xs space-y-1 text-white/60">
                <p className="font-semibold text-white/80 mb-1.5">Estimated 5-year costs</p>
                {cost.purchase_price > 0 && (
                  <div className="flex justify-between"><span>Purchase price</span><span>${cost.purchase_price.toLocaleString()}</span></div>
                )}
                <div className="flex justify-between"><span>Charging</span><span>${cost.charging_5y.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Maintenance</span><span>${cost.maintenance_5y.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Insurance</span><span>${cost.insurance_5y.toLocaleString()}</span></div>
                {cost.purchase_price > 0 && (
                  <div className="flex justify-between"><span>Depreciation</span><span>−${cost.depreciation_5y.toLocaleString()}</span></div>
                )}
                <div className="flex justify-between font-semibold text-white/80 border-t border-white/10 pt-1 mt-1">
                  <span>5-yr running total</span><span>${cost.total.toLocaleString()}</span>
                </div>
                <p className="text-white/30 mt-1">Estimates — US avg rates, transparent assumptions.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Score breakdown — "Why X/100?" */}
        {dimEntries.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="text-xs text-[#00d97e]/70 hover:text-[#00d97e] underline"
            >
              Why {rec.fit_score}/100?
            </button>
            <AnimatePresence>
              {showBreakdown && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2">
                    {dimEntries.map(({ key, label, score }) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs text-white/40 mb-0.5">
                          <span>{label}</span>
                          <span className="font-medium text-white/70">{Math.round(score)}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${badgeBg}`}
                            style={{ width: `${Math.min(100, score)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {bestDim && (
                      <p className="text-xs text-[#00d97e] bg-[#00d97e]/10 rounded-lg px-2 py-1.5 mt-2">
                        ✓ {POSITIVE_NOTES[bestDim.key]}
                      </p>
                    )}
                    {worstDim && worstDim.score < 70 && (
                      <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-2 py-1.5">
                        ↓ {LIMITING_NOTES[worstDim.key]}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Top stress flag insight */}
        {rec.top_stress_flag && (
          <p className="mt-3 text-sm text-white/50 italic">
            &ldquo;{rec.top_stress_flag}&rdquo;
          </p>
        )}

        {/* Score improvement suggestions */}
        {rec.score_improvements && (
          <ScoreImprovementSuggestions improvements={rec.score_improvements} />
        )}

        {/* Dealer availability */}
        {hasDealers && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1.5 text-sm text-[#00d97e]/70 hover:text-[#00d97e] transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" />
            Available at {rec.dealer_listings.length} OFFO dealer{rec.dealer_listings.length > 1 ? "s" : ""} ({totalListings} listing{totalListings > 1 ? "s" : ""})
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}

        {/* Action buttons */}
        <div className="mt-4 space-y-2">
          {shortlistToast && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-lg text-xs text-[#00d97e]">
              <Bookmark className="w-3.5 h-3.5 shrink-0 fill-current" />
              Saved to your shortlist
            </div>
          )}
          <Link
            href={`/receipt?make=${encodeURIComponent(rec.make)}&model=${encodeURIComponent(rec.model_short)}&year=${rec.year}&src=routine_rec`}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold hover:bg-[#00c970] transition-colors"
          >
            Analyze a listing →
          </Link>
          <a
            href={carGurusUrl}
            onClick={handleCarGurusClick}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-white/40 hover:text-[#00d97e]/80 transition-colors"
          >
            Search listings
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {searchHintVisible && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-lg text-xs text-[#00d97e]">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              OFFO will apply your routine automatically on CarGurus.
            </div>
          )}
        </div>
      </div>

      {/* Best Available Deal from curated_deals DB */}
      {rec.matched_deals && rec.matched_deals.length > 0 && (() => {
        const deal = rec.matched_deals[0];
        return (
          <MatchedDealStrip deal={deal} />
        );
      })()}


      {/* Expanded dealer listings */}
      <AnimatePresence>
        {expanded && hasDealers && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.08] px-5 py-3 bg-white/[0.03] space-y-2">
              {rec.dealer_listings.map((dealer) => (
                <Link
                  key={dealer.dealer_slug}
                  href={`/dealers/${dealer.dealer_slug}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.05] transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-white/80 group-hover:text-[#00d97e]">
                      {dealer.dealer_name}
                    </p>
                    <p className="text-xs text-white/40">
                      {dealer.dealer_city}{dealer.dealer_state ? `, ${dealer.dealer_state}` : ""} &middot; {dealer.listing_count} listing{dealer.listing_count > 1 ? "s" : ""}
                    </p>
                  </div>
                  {dealer.price_range_cents && (
                    <span className="text-xs font-medium text-white/60">
                      {dealer.price_range_cents.min === dealer.price_range_cents.max
                        ? formatPrice(dealer.price_range_cents.min)
                        : `${formatPrice(dealer.price_range_cents.min)} - ${formatPrice(dealer.price_range_cents.max)}`}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
