"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Zap, MapPin, ArrowRight, ExternalLink, Snowflake, CheckCircle2, Circle, ChevronUp } from "lucide-react";
import type { VehicleRecommendation } from "@/types/recommendations";
import type { MinimumViableRoutine } from "@/types/v2";
import { getCarGurusUrl } from "@/lib/cargurus-links";
import { ScoreImprovementSuggestions } from "./blocks/ScoreImprovementSuggestions";
import { useEventTracking } from "@/hooks/useEventTracking";
import VehicleImage from "./VehicleImage";

const fitColors: Record<string, { bg: string; text: string; border: string }> = {
  "Great Fit": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  "Good Fit": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Mixed Fit": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "High Friction": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

const scoreBadgeColors: Record<string, string> = {
  "Great Fit": "bg-green-600",
  "Good Fit": "bg-blue-600",
  "Mixed Fit": "bg-amber-500",
  "High Friction": "bg-red-500",
};

interface RecommendationCardProps {
  recommendation: VehicleRecommendation;
  onSelect: () => void;
  muted?: boolean;
  userZipCode?: string | null;
  weeklyMiles?: number;
  routine?: MinimumViableRoutine;
  isSelectedForCompare?: boolean;
  onToggleCompare?: (model: string) => void;
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
}: RecommendationCardProps) {
  const { trackExternalLinkClicked } = useEventTracking();
  const [expanded, setExpanded] = useState(false);
  const [showReceiptNudge, setShowReceiptNudge] = useState(false);
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
  const badgeBg = scoreBadgeColors[fitLabel] ?? "bg-gray-500";
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
    setShowReceiptNudge(true);
  };

  return (
    <div className={`rounded-2xl border-2 ${isSelectedForCompare ? "border-blue-500 shadow-md" : colors.border} ${muted ? "opacity-70" : ""} bg-white overflow-hidden transition-shadow hover:shadow-md`}>
      {/* Vehicle photo strip */}
      <div className="relative h-36 w-full">
        <VehicleImage
          make={rec.make}
          model={rec.model_short}
          year={rec.year}
          className="w-full h-full"
          imgClassName="w-full h-full object-cover"
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
        {/* Compare toggle — top right */}
        {onToggleCompare && (
          <button
            onClick={() => onToggleCompare(rec.model)}
            aria-label={isSelectedForCompare ? "Remove from compare" : "Add to compare"}
            className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-white/90 shadow-sm hover:bg-white transition-colors"
          >
            {isSelectedForCompare
              ? <><CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /><span className="text-blue-600">Selected</span></>
              : <><Circle className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-500">Compare</span></>
            }
          </button>
        )}
      </div>

      <div className="p-5">
        {/* Vehicle name + year */}
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{rec.model}</h3>
          <span className="text-xs text-gray-500">{rec.year}</span>
        </div>

        {/* Specs row */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
            <Zap className="w-3 h-3" />
            {rec.real_world_range_mi} mi range
          </span>
          {rangeFields && routine?.climate === "winter" && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
              <Snowflake className="w-3 h-3" />
              ~{rangeFields.winterRange} mi winter
            </span>
          )}
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
            {rec.battery_kwh} kWh
          </span>
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
            {rec.chemistry}
          </span>
          {charging1080Min !== null && (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
              ⚡ ~{charging1080Min} min 10–80%
            </span>
          )}
          {rec.incentive_new === true && (
            <span
              className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full cursor-help"
              title="Income and dealer-point restrictions apply — verify eligibility"
            >
              $7,500 fed. credit possible
            </span>
          )}
          {cost && cost.total > 0 && (
            <button
              onClick={() => setShowCostBreakdown(!showCostBreakdown)}
              className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded-full transition-colors"
            >
              ~${Math.round(cost.total / 1000)}k est. 5-yr cost
              {showCostBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Longest-day buffer */}
        {rangeFields && (
          <p className="mt-2 text-xs text-gray-500">
            Longest-day buffer: <span className={
              rangeFields.bufferLabel === "comfortable" ? "text-green-600 font-medium" :
              rangeFields.bufferLabel === "adequate"    ? "text-amber-600 font-medium" :
                                                          "text-red-600 font-medium"
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
              <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs space-y-1 text-gray-600">
                <p className="font-semibold text-gray-700 mb-1.5">Estimated 5-year costs</p>
                {cost.purchase_price > 0 && (
                  <div className="flex justify-between"><span>Purchase price</span><span>${cost.purchase_price.toLocaleString()}</span></div>
                )}
                <div className="flex justify-between"><span>Charging</span><span>${cost.charging_5y.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Maintenance</span><span>${cost.maintenance_5y.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Insurance</span><span>${cost.insurance_5y.toLocaleString()}</span></div>
                {cost.purchase_price > 0 && (
                  <div className="flex justify-between"><span>Depreciation</span><span>−${cost.depreciation_5y.toLocaleString()}</span></div>
                )}
                <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-200 pt-1 mt-1">
                  <span>5-yr running total</span><span>${cost.total.toLocaleString()}</span>
                </div>
                <p className="text-gray-400 mt-1">Estimates — US avg rates, transparent assumptions.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Score breakdown — "Why X/100?" */}
        {dimEntries.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="text-xs text-blue-500 hover:text-blue-700 underline"
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
                        <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                          <span>{label}</span>
                          <span className="font-medium text-gray-700">{Math.round(score)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${badgeBg}`}
                            style={{ width: `${Math.min(100, score)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {bestDim && (
                      <p className="text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1.5 mt-2">
                        ✓ {POSITIVE_NOTES[bestDim.key]}
                      </p>
                    )}
                    {worstDim && worstDim.score < 70 && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
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
          <p className="mt-3 text-sm text-gray-600 italic">
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
            className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" />
            Available at {rec.dealer_listings.length} OFFO dealer{rec.dealer_listings.length > 1 ? "s" : ""} ({totalListings} listing{totalListings > 1 ? "s" : ""})
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}

        {/* Action buttons */}
        <div className="mt-4 space-y-2">
          <button
            onClick={onSelect}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            See Full Report
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href={carGurusUrl}
            onClick={handleCarGurusClick}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            Search listings
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {searchHintVisible && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              <Zap className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              OFFO will apply your routine automatically on CarGurus.
            </div>
          )}
          {showReceiptNudge && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
              <p className="text-xs text-emerald-800 leading-snug">
                Found one you like?{" "}
                <a
                  href="/receipt"
                  className="font-semibold underline hover:text-emerald-900"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Paste the listing URL into the Receipt Analyzer
                </a>
                {" "}to get exact price, mileage, and negotiation feedback on that specific car.
              </p>
            </div>
          )}
        </div>
      </div>

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
            <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 space-y-2">
              {rec.dealer_listings.map((dealer) => (
                <Link
                  key={dealer.dealer_slug}
                  href={`/dealers/${dealer.dealer_slug}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                      {dealer.dealer_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {dealer.dealer_city}{dealer.dealer_state ? `, ${dealer.dealer_state}` : ""} &middot; {dealer.listing_count} listing{dealer.listing_count > 1 ? "s" : ""}
                    </p>
                  </div>
                  {dealer.price_range_cents && (
                    <span className="text-xs font-medium text-gray-600">
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
