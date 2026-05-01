"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, AlertCircle, MessageSquare, ChevronDown, ChevronUp, Lightbulb, SlidersHorizontal, Bookmark, Check, LayoutGrid, LayoutList, List } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import RecommendationCard from "./RecommendationCard";
import RecommendationCardGrid from "./RecommendationCardGrid";
import RecommendationCardList from "./RecommendationCardList";
import ExtensionNudge from "./ExtensionNudge";
import RefineStep, { type RefinePrefs } from "./RefineStep";
import Link from "next/link";
import { addToAnonGarage } from "@/lib/anon-garage";
import { SourcesFooter } from "@/components/blocks/SourcesFooter";
import { DataSourcesBadge } from "@/components/blocks/DataSourcesBadge";
import type { MinimumViableRoutine } from "@/types/v2";
import type { VehicleRecommendation, RecommendationsResponse, DataSources } from "@/types/recommendations";
import { computeConfidencePct } from "@/lib/routine-confidence";

interface VehicleRecommendationsProps {
  routine: MinimumViableRoutine;
  onSelectVehicle: (vehicle: { model: string; year: number }) => void;
  onSwitchToManual: () => void;
  onBack: () => void;
}

const CATEGORY_FILTERS = [
  { value: "all", label: "All" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "truck", label: "Truck" },
  { value: "hatchback", label: "Hatch" },
];

const chargingLabels: Record<string, string> = {
  home: "Home",
  work: "Workplace",
  public: "Public",
};

type DecisionPriority = "friction" | "spend" | "space" | null;
type ViewMode = "card" | "grid" | "list";

function SkeletonCard() {
  return (
    <div className="rounded-2xl border-2 border-white/[0.08] bg-white/[0.04] p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/10" />
        <div className="flex-1">
          <div className="h-5 w-48 bg-white/10 rounded mb-2" />
          <div className="h-4 w-24 bg-white/[0.07] rounded" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <div className="h-6 w-20 bg-white/[0.07] rounded-full" />
        <div className="h-6 w-16 bg-white/[0.07] rounded-full" />
        <div className="h-6 w-14 bg-white/[0.07] rounded-full" />
      </div>
      <div className="h-10 w-full bg-white/[0.07] rounded-xl mt-4" />
    </div>
  );
}


/** Compute a weighted tie-break score for re-sorting after priority choice */
function computeTieScore(
  rec: VehicleRecommendation,
  routine: MinimumViableRoutine,
  priority: DecisionPriority
): number {
  const d = rec.dimensions;
  if (!d) return rec.fit_score;

  const homePriority = routine.charging_access === "home";
  const w = {
    range:    homePriority ? 0.35 : 0.25,
    charging: homePriority ? 0.20 : 0.40,
    budget:   0.20,
    recovery: homePriority ? 0.10 : 0.15,
    utility:  0.15,
  };

  // Boost selected priority weight by 1.5×
  if (priority === "friction") w.charging *= 1.5;
  if (priority === "spend")    w.budget   *= 1.5;
  if (priority === "space")    w.utility  *= 1.5;

  return (
    d.range    * w.range    +
    d.charging * w.charging +
    d.budget   * w.budget   +
    d.recovery * w.recovery +
    d.utility  * w.utility
  );
}

/**
 * Generate coach guidance sentence for the top pick.
 * Uses the top vehicle's weakest dimension to explain the #1 recommendation.
 */
function getCoachGuidance(
  top: VehicleRecommendation,
  routine: MinimumViableRoutine,
  weeklyMiles: number
): string {
  const name = `${top.year} ${top.model_short}`;
  const charging = chargingLabels[routine.charging_access] ?? routine.charging_access;

  // Lead with what makes it the top pick based on charging access
  if (routine.charging_access === "home") {
    return `${name} ranks #1 because its ${top.real_world_range_mi} mi real-world range gives you the most comfortable buffer for your ~${weeklyMiles} mi/week — and you can top it up every night at home without relying on public stops.`;
  }
  if (routine.charging_access === "work") {
    return `${name} ranks #1 because its range and ${charging.toLowerCase()} charging setup align well with your ~${weeklyMiles} mi/week routine, minimizing the days you need a public fast-charge.`;
  }
  // public
  return `${name} ranks #1 because it has the lowest charging friction for a ${charging.toLowerCase()}-charging lifestyle — its DC fast-charge speed means shorter stops on your ~${weeklyMiles} mi/week routine.`;
}

/** Generate comparison bullets across top 3 — only where vehicles actually differ */
function getDiffBullets(top3: VehicleRecommendation[]): string[] {
  if (top3.length < 2) return [];
  const bullets: string[] = [];

  const buffers = top3.map(r => r.tie_chips?.buffer);
  if (buffers.some(b => b !== buffers[0])) {
    const best = top3.find(r => r.tie_chips?.buffer === "strong") ?? top3[0];
    bullets.push(`<strong>${best.model_short}</strong> has the strongest range buffer for your longest day`);
  }

  const charging = top3.map(r => r.tie_chips?.charging);
  if (charging.some(c => c !== charging[0])) {
    const best = top3.find(r => r.tie_chips?.charging === "low") ?? top3[0];
    bullets.push(`<strong>${best.model_short}</strong> has the lowest weekly charging friction`);
  }

  const budgets = top3.map(r => r.tie_chips?.budget);
  if (budgets.some(b => b !== budgets[0])) {
    const likely = top3.filter(r => r.tie_chips?.budget === "likely");
    if (likely.length === 1) {
      bullets.push(`<strong>${likely[0].model_short}</strong> is most likely to fit your budget`);
    }
  }

  const winters = top3.map(r => r.tie_chips?.winter);
  if (winters.some(w => w !== winters[0])) {
    const best = top3.find(r => r.tie_chips?.winter === "safe") ?? top3[0];
    bullets.push(`<strong>${best.model_short}</strong> handles cold weather better — less range loss in winter`);
  }

  return bullets.slice(0, 3);
}

export default function VehicleRecommendations({
  routine,
  onSelectVehicle,
  onSwitchToManual,
  onBack,
}: VehicleRecommendationsProps) {
  const { trackEvent, trackVehicleListGenerated, trackVehicleFullReportClicked, getPersistentSessionId } = useEventTracking();

  const [recommendations, setRecommendations] = useState<VehicleRecommendation[]>([]);
  const [dealerQuestions, setDealerQuestions] = useState<string[]>([]);
  const [userZipCode, setUserZipCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showLowFit, setShowLowFit] = useState(false);
  const [showAlsoFits, setShowAlsoFits] = useState(false);
  const [decisionPriority, setDecisionPriority] = useState<DecisionPriority>(null);
  const [refinePhase, setRefinePhase] = useState<"browse" | "refine" | "refined">("browse");
  const [refinedList, setRefinedList] = useState<VehicleRecommendation[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [compareSelected, setCompareSelected] = useState<Set<string>>(new Set());
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);

  // Quick-adjust state
  const [localRoutine, setLocalRoutine] = useState<MinimumViableRoutine>(() => routine);
  const [prevRecommendations, setPrevRecommendations] = useState<VehicleRecommendation[]>([]);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [adjustedLabel, setAdjustedLabel] = useState(false);
  const [showAdjustBar, setShowAdjustBar] = useState(false);
  const [adjustExpanded, setAdjustExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Trust & methodology state
  const [dataSources, setDataSources] = useState<DataSources | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);

  const handleToggleCompare = (model: string) => {
    setCompareSelected((prev) => {
      const next = new Set(prev);
      if (next.has(model)) {
        next.delete(model);
      } else if (next.size < 3) {
        next.add(model);
      }
      return next;
    });
  };

  // Track page load time for "See Full Report" click tracking
  const pageLoadTimeRef = useRef(Date.now());
  const clusterTrackedRef = useRef(false);

  const weeklyMiles = routine.weekly_miles
    ?? (routine.commute_miles_roundtrip ? routine.commute_miles_roundtrip * 5 : 100);

  // Re-POST with a mutated routine (quick-adjust)
  async function recomputeWithRoutine(updated: MinimumViableRoutine) {
    setIsRecomputing(true);
    setPrevRecommendations(recommendations);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routine: updated, zip_code: userZipCode }),
      });
      if (res.ok) {
        const data: RecommendationsResponse = await res.json();
        if (data.success) {
          setRecommendations(data.recommendations);
          setDataSources(data.data_sources ?? null);
          setAdjustedLabel(true);
        }
      }
    } catch { /* ignore — keep existing results */ }
    setIsRecomputing(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchRecommendations() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routine }),
        });

        const data: RecommendationsResponse = await res.json();

        if (!res.ok || !data.success) {
          throw new Error("Failed to load recommendations");
        }

        if (!cancelled) {
          setRecommendations(data.recommendations);
          setDealerQuestions(data.dealer_questions.top_3);
          setUserZipCode(data.user_zip_code ?? null);
          setDataSources(data.data_sources ?? null);
          setShowAdjustBar(true);

          // Auto-save this EVFit result to anon-garage (syncs to server on login)
          addToAnonGarage({
            type: "fit_profile",
            label: `EVFit — ${chargingLabels[routine.charging_access] ?? routine.charging_access} charging, ${routine.climate}`,
            data: {
              routine,
              top_results: data.recommendations.slice(0, 5).map(r => ({
                make: r.make,
                model: r.model_short,
                year: r.year,
                fit_score: r.fit_score,
                fit_label: r.fit_label,
              })),
            },
          });

          // Show save prompt once per session (after results load)
          try {
            if (!sessionStorage.getItem("offo_routine_save_prompted")) {
              setShowSavePrompt(true);
            }
          } catch { /* ignore */ }

          trackEvent("recommendations_viewed", {
            count: data.recommendations.length,
            great_fit_count: data.recommendations.filter(r => r.fit_label === "Great Fit").length,
            good_fit_count: data.recommendations.filter(r => r.fit_label === "Good Fit").length,
          });

          const topVehicle = data.recommendations[0];
          if (topVehicle) {
            trackVehicleListGenerated({
              total_vehicles_shown: data.recommendations.length,
              top_vehicle: {
                make: topVehicle.make,
                model: topVehicle.model_short,
                year: topVehicle.year,
                fit_score: topVehicle.fit_score,
                fit_label: topVehicle.fit_label,
                range_mi: topVehicle.real_world_range_mi,
                battery_kwh: topVehicle.battery_kwh,
              },
              user_routine: {
                daily_miles: weeklyMiles / 7,
                home_charging: routine.charging_access === "home",
                zip: data.user_zip_code || "",
                shared_charger: false,
              },
              generation_time_ms: 0,
              session_id: "",
            });
          }
        }
      } catch {
        if (!cancelled) {
          setError("Could not load recommendations. Please try again.");
          trackEvent("recommendations_error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRecommendations();
    return () => { cancelled = true; };
  }, [routine]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter by category
  const filtered = categoryFilter === "all"
    ? recommendations
    : recommendations.filter(r => r.sub_category === categoryFilter);

  const recommended = filtered.filter(r => r.fit_score >= 65);
  const lowFit = filtered.filter(r => r.fit_score < 65);

  // Tie detection (for analytics only)
  const topScore = recommended[0]?.fit_score ?? 0;
  const tiedCount = recommended.filter(r => topScore - r.fit_score <= 2).length;

  // Top 3 / also fits split (re-sort top3 if priority is selected)
  const sortedRecommended = decisionPriority
    ? [...recommended].sort((a, b) => {
        if (b.fit_score !== a.fit_score) return b.fit_score - a.fit_score;
        return computeTieScore(b, routine, decisionPriority) - computeTieScore(a, routine, decisionPriority);
      })
    : recommended;

  const top3 = sortedRecommended.slice(0, 3);
  const alsoFits = sortedRecommended.slice(3);

  // Tie-break question gate: show when top 1 vs top 2 tie_score delta < 5
  const top1TieScore = top3[0]?.dimensions ? computeTieScore(top3[0], routine, null) : null;
  const top2TieScore = top3[1]?.dimensions ? computeTieScore(top3[1], routine, null) : null;
  const showTieBreakQuestion =
    decisionPriority === null &&
    top1TieScore !== null &&
    top2TieScore !== null &&
    Math.abs(top1TieScore - top2TieScore) < 5;

  // Analytics: cluster detection (fire once when data loads)
  useEffect(() => {
    if (!loading && !clusterTrackedRef.current && tiedCount >= 2) {
      clusterTrackedRef.current = true;
      trackEvent("results_cluster_detected", { count: tiedCount });
    }
  }, [loading, tiedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics: top 3 rendered (fire once when data loads)
  useEffect(() => {
    if (!loading && top3.length > 0) {
      trackEvent("top3_rendered", { top3_models: top3.map(r => r.model_short) });
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics: tie-break question shown
  useEffect(() => {
    if (showTieBreakQuestion && top1TieScore !== null && top2TieScore !== null) {
      trackEvent("tie_break_question_shown", { delta: Math.abs(top1TieScore - top2TieScore) });
    }
  }, [showTieBreakQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Available category filters
  const availableCategories = CATEGORY_FILTERS.filter(
    f => f.value === "all" || recommendations.some(r => r.sub_category === f.value)
  );

  const handleSelect = (rec: VehicleRecommendation, rank: number) => {
    trackEvent("recommendation_selected", {
      model: rec.model,
      year: rec.year,
      fit_score: rec.fit_score,
      fit_label: rec.fit_label,
    });

    trackEvent("winner_selected", { model: rec.model_short, rank });

    const positionInList = recommendations.findIndex(r =>
      r.make === rec.make && r.model_short === rec.model_short && r.year === rec.year
    ) + 1;

    trackVehicleFullReportClicked({
      vehicle: {
        make: rec.make,
        model: rec.model_short,
        year: rec.year,
        fit_score: rec.fit_score,
        fit_label: rec.fit_label,
      },
      position_in_list: positionInList,
      total_vehicles_in_list: recommendations.length,
      time_on_page_seconds: Math.floor((Date.now() - pageLoadTimeRef.current) / 1000),
      clicked_from: "vehicle_card",
      session_id: "",
    });

    onSelectVehicle({ model: rec.model, year: rec.year });
  };

  const diffBullets = getDiffBullets(top3);
  const coachGuidance = top3[0] ? getCoachGuidance(top3[0], routine, weeklyMiles) : null;

  function applyRefinePrefs(prefs: RefinePrefs) {
    const US_BRANDS = ["chevrolet", "ford", "rivian", "gmc", "cadillac", "chrysler", "jeep", "ram"];
    let result = [...recommendations];

    if (prefs.budgetCeiling && prefs.budgetCeiling < 50000) {
      // Use fit_score as a proxy when price isn't directly available — filter loosely
      // Real price filtering would need price data on VehicleRecommendation
      // For now, prefer cheaper models by lower battery_kwh as rough proxy
      result = result.filter(r => r.battery_kwh <= prefs.budgetCeiling! / 800);
    }
    if (prefs.seatCount === 7) {
      result = result.filter(r => r.sub_category === "suv" || r.sub_category === "truck");
    }
    if (prefs.needsTow === true) {
      result = result.filter(r => r.sub_category === "truck" || r.sub_category === "suv");
    }
    if (prefs.brandPref === "us_only") {
      result = result.filter(r => US_BRANDS.includes(r.make.toLowerCase()));
    }
    if (prefs.brandPref === "no_tesla") {
      result = result.filter(r => r.make.toLowerCase() !== "tesla");
    }
    // Re-sort by priority
    if (prefs.priority === "friction") {
      result.sort((a, b) => (b.dimensions?.charging ?? b.fit_score) - (a.dimensions?.charging ?? a.fit_score));
    } else if (prefs.priority === "cargo") {
      result.sort((a, b) => (b.dimensions?.utility ?? b.fit_score) - (a.dimensions?.utility ?? a.fit_score));
    } else {
      result.sort((a, b) => b.fit_score - a.fit_score);
    }

    // Fallback: if filtering leaves < 3, relax to full sorted list
    if (result.length < 3) result = [...recommendations].sort((a, b) => b.fit_score - a.fit_score);

    const top3Models = result.slice(0, 3).map(r => r.model_short);
    setRefinedList(result.slice(0, 3));
    setRefinePhase("refined");
    trackEvent("refine_submitted", { priority: prefs.priority, brand: prefs.brandPref });
    const anonId = getPersistentSessionId();
    fetch("/api/routine/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "completed",
        anon_id: anonId,
        tie_break_mode: "filters",
        winner_declared: false,
        top3_models: top3Models,
        tie_break_factors_used: [
          prefs.priority, prefs.brandPref, prefs.mustHave,
          prefs.seatCount !== null ? "seats" : null,
          prefs.needsTow !== null ? "tow" : null,
          prefs.budgetCeiling !== null ? "budget" : null,
        ].filter(Boolean),
      }),
    }).catch(() => {});
  }

  function handleAddToGarage(rec: VehicleRecommendation) {
    const key = `${rec.year}-${rec.model}`;
    addToAnonGarage({
      type: "shortlist",
      label: `${rec.year} ${rec.make} ${rec.model_short}`,
      data: {
        run_id: key,
        vehicle_label: `${rec.year} ${rec.make} ${rec.model_short}`,
        fit_score: { label: rec.fit_label, score: rec.fit_score } as unknown as import("@/types/v2").RoutineFitScore,
      },
    });
    setSavedIds(prev => new Set([...prev, key]));
    trackEvent("top3_add_to_garage", { model: rec.model_short });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Back button */}
      <div className="mb-4">
        <button
          onClick={onBack}
          className="flex items-center text-white/50 hover:text-white/80 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to routine
        </button>
      </div>

      {/* Sticky compare bar — appears when 2+ cards selected */}
      <AnimatePresence>
        {compareSelected.size >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="sticky top-2 z-20 mb-4 flex items-center justify-between gap-3 bg-[#00d97e] text-[#0d1117] px-4 py-3 rounded-2xl shadow-lg"
          >
            <span className="text-sm font-medium">
              {compareSelected.size} vehicle{compareSelected.size > 1 ? "s" : ""} selected
            </span>
            <a
              href="#routine-compare-panel"
              className="px-3 py-1.5 bg-[#0d1117]/20 text-[#0d1117] rounded-xl text-sm font-semibold hover:bg-[#0d1117]/30 transition-colors"
              onClick={() => trackEvent("compare_bar_clicked", { count: compareSelected.size })}
            >
              Compare selected →
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">EVs That Match Your Routine</h2>
        <p className="text-sm text-white/50 mt-1">
          Based on {chargingLabels[routine.charging_access] ?? routine.charging_access} charging, ~{weeklyMiles} mi/week, {routine.climate} climate
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-white/60 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#00d97e] text-[#0d1117] rounded-lg text-sm font-medium hover:bg-[#00f090] transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <>
          {/* Recommendation confidence — shown once results load */}
          {recommendations.length > 0 && (
            <div className="mb-5">
              {(() => {
                const pct = computeConfidencePct(routine);
                return (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#00d97e] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className="text-xs text-white/40 shrink-0 cursor-help"
                      title="Reflects how complete your routine inputs are and how strongly OFFO can distinguish between vehicle fits."
                    >
                      Recommendation confidence: {pct}%
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* "How are these ranked?" methodology accordion */}
          {recommendations.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowMethodology(!showMethodology)}
                className="text-xs text-white/40 hover:text-white/60 transition-colors flex items-center gap-1"
              >
                How are these ranked?
                {showMethodology ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <AnimatePresence>
                {showMethodology && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 p-4 bg-white/[0.04] rounded-2xl border border-white/[0.08] space-y-3 text-xs text-white/60">
                      <div>
                        <p className="font-semibold text-white/80 mb-1">Fit score (0–100)</p>
                        <p>Weighted average of 6 dimensions: <strong>Charging fit (30%)</strong> · Range fit (25%) · Cost fit (15%) · Climate fit (10%) · Longest-day recovery (10%) · Utility fit (10%). Score ≥ 80 = Great Fit, 65–79 = Good Fit, 45–64 = Mixed Fit.</p>
                      </div>
                      <div>
                        <p className="font-semibold text-white/80 mb-1">Range estimates</p>
                        <p>EPA-certified range adjusted by the AAA real-world variance per vehicle (typically −5% to −15%). Winter climate applies an additional reduction based on your parking: garage −12%, outdoor −15%, street −20% (AAA cold-weather studies).</p>
                      </div>
                      <div>
                        <p className="font-semibold text-white/80 mb-1">5-year cost estimate</p>
                        <p>MSRP purchase price · Charging at $0.16/kWh (US avg 2024) · Maintenance $600/yr (EV avg, no oil changes) · Insurance $1,800/yr · Depreciation 45% of MSRP over 5 years. Estimates only — your costs will vary.</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Quick-adjust bar */}
          {showAdjustBar && recommendations.length > 0 && (
            <div className="mb-5">
              {/* Collapsed summary line */}
              {!adjustExpanded && (
                <div className="flex items-center justify-between gap-2 text-xs text-white/50 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
                  <span className="truncate">
                    Budget: {localRoutine.budget_max ? `$${Math.round(localRoutine.budget_max / 1000)}k` : "Any"}
                    {" · "}Body: {localRoutine.body_style ?? "Any"}
                    {" · "}
                    {localRoutine.weekly_miles
                      ? `~${Math.round(localRoutine.weekly_miles / 7)} mi/day`
                      : localRoutine.commute_miles_roundtrip
                      ? `~${Math.round(localRoutine.commute_miles_roundtrip * 5 / 7)} mi/day`
                      : "~14 mi/day"}
                    {" · "}Charging: {chargingLabels[localRoutine.charging_access] ?? localRoutine.charging_access}
                  </span>
                  <button
                    onClick={() => setAdjustExpanded(true)}
                    className="shrink-0 flex items-center gap-1 text-[#00d97e] font-medium hover:text-[#00f090] transition-colors"
                  >
                    Adjust <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Expanded controls */}
              <AnimatePresence>
                {adjustExpanded && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-4 space-y-4"
                  >
                    {/* Budget */}
                    <div>
                      <p className="text-xs font-semibold text-white/60 mb-1.5">Budget</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "No limit", value: undefined },
                          { label: "$25k", value: 25000 },
                          { label: "$35k", value: 35000 },
                          { label: "$45k", value: 45000 },
                          { label: "$55k", value: 55000 },
                        ].map(({ label, value }) => (
                          <button
                            key={label}
                            onClick={() => setLocalRoutine(r => ({ ...r, budget_max: value }))}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              localRoutine.budget_max === value
                                ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]"
                                : "bg-white/[0.06] text-white/60 border-white/[0.12] hover:border-white/30"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Body style */}
                    <div>
                      <p className="text-xs font-semibold text-white/60 mb-1.5">Body style</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "Any", value: undefined },
                          { label: "Sedan", value: "sedan" },
                          { label: "SUV", value: "suv" },
                          { label: "Truck", value: "truck" },
                          { label: "Hatch", value: "hatchback" },
                        ].map(({ label, value }) => (
                          <button
                            key={label}
                            onClick={() => setLocalRoutine(r => ({ ...r, body_style: value as MinimumViableRoutine["body_style"] }))}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              (localRoutine.body_style ?? undefined) === value
                                ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]"
                                : "bg-white/[0.06] text-white/60 border-white/[0.12] hover:border-white/30"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Weekly miles */}
                    <div>
                      <p className="text-xs font-semibold text-white/60 mb-1.5">Weekly driving</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "< 100 mi", value: 70 },
                          { label: "100–200 mi", value: 150 },
                          { label: "200–300 mi", value: 250 },
                          { label: "300+ mi", value: 350 },
                        ].map(({ label, value }) => {
                          const current = localRoutine.weekly_miles
                            ?? (localRoutine.commute_miles_roundtrip ? localRoutine.commute_miles_roundtrip * 5 : 100);
                          const active =
                            (value === 70  && current < 100) ||
                            (value === 150 && current >= 100 && current < 200) ||
                            (value === 250 && current >= 200 && current < 300) ||
                            (value === 350 && current >= 300);
                          return (
                            <button
                              key={label}
                              onClick={() => setLocalRoutine(r => ({ ...r, weekly_miles: value, commute_miles_roundtrip: undefined }))}
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                active
                                  ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]"
                                  : "bg-white/[0.06] text-white/60 border-white/[0.10] hover:border-[#00d97e]/40"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Charging access */}
                    <div>
                      <p className="text-xs font-semibold text-white/60 mb-1.5">Charging setup</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(["home", "work", "public"] as const).map((val) => (
                          <button
                            key={val}
                            onClick={() => setLocalRoutine(r => ({ ...r, charging_access: val }))}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              localRoutine.charging_access === val
                                ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]"
                                : "bg-white/[0.06] text-white/60 border-white/[0.12] hover:border-white/30"
                            }`}
                          >
                            {chargingLabels[val]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t border-white/[0.08]">
                      <button
                        onClick={() => {
                          recomputeWithRoutine(localRoutine);
                          setAdjustExpanded(false);
                          trackEvent("quick_adjust_update", {
                            budget: localRoutine.budget_max,
                            body_style: localRoutine.body_style,
                            weekly_miles: localRoutine.weekly_miles,
                            charging_access: localRoutine.charging_access,
                          });
                        }}
                        disabled={isRecomputing}
                        className="flex items-center gap-2 px-4 py-2 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold hover:bg-[#00f090] disabled:opacity-60 transition-colors"
                      >
                        {isRecomputing ? (
                          <><span className="w-3 h-3 border-2 border-[#0d1117] border-t-transparent rounded-full animate-spin" />Updating…</>
                        ) : (
                          "Update Results"
                        )}
                      </button>
                      {adjustedLabel && (
                        <button
                          onClick={() => {
                            setLocalRoutine(routine);
                            recomputeWithRoutine(routine);
                            setAdjustedLabel(false);
                            setAdjustExpanded(false);
                          }}
                          className="text-xs text-white/40 hover:text-white/60 transition-colors"
                        >
                          Reset to original
                        </button>
                      )}
                      <button
                        onClick={() => setAdjustExpanded(false)}
                        className="ml-auto text-xs text-white/40 hover:text-white/60 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* "Updated based on your changes" pill */}
              {adjustedLabel && !adjustExpanded && (
                <div className="mt-2 flex items-center gap-2 text-xs text-[#00d97e]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d97e] shrink-0" />
                  Updated based on your changes
                  <button
                    onClick={() => {
                      setLocalRoutine(routine);
                      recomputeWithRoutine(routine);
                      setAdjustedLabel(false);
                    }}
                    className="ml-1 text-white/40 hover:text-white/60 transition-colors underline"
                  >
                    Reset →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Dim overlay on cards during recompute */}
          <div className={isRecomputing ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>

          {/* Save & Compare CTA — above the fold */}
          {recommendations.length >= 2 && refinePhase === "browse" && (
            <div className="flex gap-3 mb-5">
              <Link
                href="/saved"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white/[0.07] border border-white/10 text-white/80 rounded-xl text-sm font-semibold hover:bg-white/[0.10] transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                View Saved Results
              </Link>
              <Link
                href="/compare?from=shortlist"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#00d97e]/30 text-[#00d97e] rounded-xl text-sm font-semibold hover:bg-[#00d97e]/10 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Compare →
              </Link>
            </div>
          )}

          {/* Save routine to Garage prompt */}
          <AnimatePresence>
            {showSavePrompt && !saveConfirmed && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-white/[0.05] border border-white/[0.10] rounded-2xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/80">Save this routine to your Garage</p>
                  <p className="text-xs text-white/50 mt-0.5">Your OFFO extension will use it automatically on CarGurus listings.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      // Push routine to extension (best-effort)
                      try {
                        const extId = process.env.NEXT_PUBLIC_EXTENSION_ID;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const cr = (window as any).chrome;
                        if (extId && cr?.runtime?.sendMessage) {
                          cr.runtime.sendMessage(extId, { type: "save_routine", routine });
                        }
                      } catch { /* ignore */ }
                      try { sessionStorage.setItem("offo_routine_save_prompted", "1"); } catch { /* ignore */ }
                      setSaveConfirmed(true);
                      setTimeout(() => setShowSavePrompt(false), 2500);
                    }}
                    className="px-3 py-1.5 bg-[#00d97e] text-[#0d1117] rounded-xl text-xs font-semibold hover:bg-[#00f090] transition-colors"
                  >
                    {saveConfirmed ? "Saved!" : "Save to Garage"}
                  </button>
                  <button
                    onClick={() => {
                      try { sessionStorage.setItem("offo_routine_save_prompted", "1"); } catch { /* ignore */ }
                      setShowSavePrompt(false);
                    }}
                    className="text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    Not now
                  </button>
                </div>
              </motion.div>
            )}
            {saveConfirmed && showSavePrompt && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-4 flex items-center gap-2 px-4 py-3 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-2xl text-sm text-[#00d97e]"
              >
                <Check className="w-4 h-4 shrink-0" />
                Saved! Opens automatically in extension.
              </motion.div>
            )}
          </AnimatePresence>

          {/* RefineStep panel */}
          {refinePhase === "refine" && (
            <div className="mb-6">
              <RefineStep
                onSubmit={applyRefinePrefs}
                onBack={() => setRefinePhase("browse")}
              />
            </div>
          )}

          {/* Refined Top 3 view */}
          {refinePhase === "refined" && refinedList.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white/80">Your Top 3</h3>
                <button
                  onClick={() => setRefinePhase("browse")}
                  className="text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  ← Show all
                </button>
              </div>
              <div className="space-y-3">
                {refinedList.map((rec, i) => {
                  const key = `${rec.year}-${rec.model}`;
                  const isSaved = savedIds.has(key);
                  return (
                    <div key={rec.model} className="bg-white/[0.05] border border-white/10 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-white/30">#{i + 1}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#00d97e]/10 text-[#00d97e]">{rec.fit_label}</span>
                          </div>
                          <p className="text-sm font-semibold text-white/80 truncate">{rec.year} {rec.make} {rec.model_short}</p>
                          {diffBullets[i] && (
                            <p className="text-xs text-white/40 mt-1 leading-snug"
                              dangerouslySetInnerHTML={{ __html: diffBullets[i] }} />
                          )}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => handleAddToGarage(rec)}
                            disabled={isSaved}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              isSaved
                                ? "bg-[#00d97e]/10 text-[#00d97e] border border-[#00d97e]/20"
                                : "bg-white/[0.07] text-white/60 border border-white/10 hover:bg-white/[0.10]"
                            }`}
                          >
                            {isSaved ? <Check className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                            {isSaved ? "Saved" : "Save"}
                          </button>
                          <button
                            onClick={() => handleSelect(rec, i + 1)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] text-white/80 hover:bg-white/[0.12] transition-colors border border-white/10"
                          >
                            Full report →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category filter pills — only in browse phase */}
          {refinePhase === "browse" && availableCategories.length > 2 && (
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {availableCategories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => {
                    setCategoryFilter(cat.value);
                    trackEvent("recommendation_filtered", { filter: cat.value });
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    categoryFilter === cat.value
                      ? "bg-[#00d97e] text-[#0d1117]"
                      : "bg-white/[0.07] text-white/60 hover:bg-white/[0.10] hover:text-white/80"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setRefinePhase("refine");
                  trackEvent("refine_step_opened");
                  const anonId = getPersistentSessionId();
                  fetch("/api/routine/refine", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      event: "started",
                      anon_id: anonId,
                      tie_cluster_count: tiedCount,
                    }),
                  }).catch(() => {});
                }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap bg-white/[0.07] text-white/60 hover:bg-white/[0.10] transition-colors border border-white/[0.12]"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Narrow to Top 3
              </button>

              {/* View mode toggle */}
              <div className="flex items-center gap-0.5 ml-1 shrink-0">
                {([
                  { mode: "card" as ViewMode, Icon: LayoutList, label: "Card view" },
                  { mode: "grid" as ViewMode, Icon: LayoutGrid, label: "Grid view" },
                  { mode: "list" as ViewMode, Icon: List,       label: "List view" },
                ] as const).map(({ mode, Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    title={label}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === mode
                        ? "bg-[#00d97e]/10 text-[#00d97e]"
                        : "text-white/40 hover:text-white/60 hover:bg-white/[0.07]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Browse-phase content — hidden during refine/refined */}
          {/* Coach guidance — why #1 was chosen */}
          {refinePhase === "browse" && coachGuidance && (
            <div className="mb-4 flex gap-3 px-4 py-3 bg-[#00d97e]/[0.07] border border-[#00d97e]/20 rounded-xl">
              <Lightbulb className="w-4 h-4 text-[#00d97e] shrink-0 mt-0.5" />
              <p className="text-sm text-white/80 leading-snug">{coachGuidance}</p>
            </div>
          )}

          {/* "What sets them apart" diff bullets */}
          {refinePhase === "browse" && top3.length >= 2 && diffBullets.length > 0 && (
            <div className="mb-4 px-4 py-3 bg-white/[0.04] rounded-xl border border-white/[0.08]">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">What sets the top picks apart</p>
              <ul className="space-y-1">
                {diffBullets.map((bullet, i) => (
                  <li key={i} className="text-sm text-white/70 flex gap-1.5">
                    <span className="text-white/30 shrink-0">•</span>
                    <span dangerouslySetInnerHTML={{ __html: bullet }} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended vehicles — Top 3 */}
          {refinePhase === "browse" && top3.length > 0 && (
            <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4" : "space-y-4 mb-4"}>
              {top3.map((rec, i) => viewMode === "grid" ? (
                <RecommendationCardGrid
                  key={rec.model}
                  recommendation={rec}
                  onSelect={() => handleSelect(rec, i + 1)}
                />
              ) : viewMode === "list" ? (
                <RecommendationCardList
                  key={rec.model}
                  recommendation={rec}
                  onSelect={() => handleSelect(rec, i + 1)}
                  rank={i + 1}
                />
              ) : (
                <RecommendationCard
                  key={rec.model}
                  recommendation={rec}
                  onSelect={() => handleSelect(rec, i + 1)}
                  userZipCode={userZipCode}
                  weeklyMiles={weeklyMiles}
                  routine={routine}
                  isSelectedForCompare={compareSelected.has(rec.model)}
                  onToggleCompare={handleToggleCompare}
                />
              ))}
              {/* Extension nudge — shown after list loads (card view only) */}
              {viewMode === "card" && <ExtensionNudge context="fits" />}
            </div>
          )}

          {/* "What sets them apart" diff bullets (second instance) */}
          {refinePhase === "browse" && top3.length >= 2 && diffBullets.length > 0 && (
            <div className="mb-4 px-4 py-3 bg-white/[0.04] rounded-xl border border-white/[0.08]">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">What sets them apart</p>
              <ul className="space-y-1">
                {diffBullets.map((bullet, i) => (
                  <li key={i} className="text-sm text-white/70 flex gap-1.5">
                    <span className="text-white/30 shrink-0">•</span>
                    <span dangerouslySetInnerHTML={{ __html: bullet.replace(/^(\S+ \S+)/, "<strong>$1</strong>") }} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tie-break question — shown when top 1 vs top 2 are very close */}
          {refinePhase === "browse" && showTieBreakQuestion && top3.length >= 2 && (
            <div className="mb-5 bg-white/[0.05] border border-white/[0.10] rounded-2xl p-4">
              <p className="text-sm font-semibold text-white/80 mb-3">
                {top3[0].model_short} and {top3[1].model_short} are nearly identical — what matters most to you?
              </p>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "friction" as const, label: "Lowest charging friction" },
                  { key: "spend"   as const, label: "Lowest spend" },
                  { key: "space"   as const, label: "More space" },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setDecisionPriority(key);
                      trackEvent("tie_break_choice_selected", { priority: key });
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-white/70 bg-white/[0.06] border border-white/[0.12] rounded-full hover:bg-white/[0.10] hover:text-white transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deal Watch CTA — watch the top picks for price drops */}
          {refinePhase === "browse" && sortedRecommended.length >= 1 && (
            <div className="rounded-2xl border border-[#00d97e]/20 bg-[#00d97e]/[0.04] px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white mb-0.5">Watch these picks for price drops</p>
                <p className="text-xs text-white/40 leading-relaxed">
                  OFFO will email you when a {sortedRecommended[0]?.make ?? "matching EV"} listing drops in price or a new GREEN deal appears.
                </p>
              </div>
              <Link
                href={`/workspace/deal-watch?prefill=${encodeURIComponent(
                  JSON.stringify(
                    sortedRecommended.slice(0, 3).map((r) => ({ make: r.make, model: r.model_short }))
                  )
                )}`}
                className="shrink-0 px-4 py-2 bg-[#00d97e] text-[#0d1117] text-xs font-semibold rounded-xl hover:bg-[#00c970] transition-colors whitespace-nowrap"
              >
                Set up deal watch →
              </Link>
            </div>
          )}


          {/* "Also fits" collapsed section */}
          {refinePhase === "browse" && alsoFits.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => {
                  const next = !showAlsoFits;
                  setShowAlsoFits(next);
                  if (next) trackEvent("also_fits_expanded", { count: alsoFits.length });
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.04] rounded-xl text-sm text-white/60 hover:bg-white/[0.07] transition-colors border border-white/[0.08]"
              >
                <span>Show {alsoFits.length} more that also fit</span>
                {showAlsoFits ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showAlsoFits && (
                <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4" : "space-y-4 mt-4"}>
                  {alsoFits.map((rec, i) => viewMode === "grid" ? (
                    <RecommendationCardGrid
                      key={rec.model}
                      recommendation={rec}
                      onSelect={() => handleSelect(rec, top3.length + i + 1)}
                    />
                  ) : viewMode === "list" ? (
                    <RecommendationCardList
                      key={rec.model}
                      recommendation={rec}
                      onSelect={() => handleSelect(rec, top3.length + i + 1)}
                      rank={top3.length + i + 1}
                    />
                  ) : (
                    <RecommendationCard
                      key={rec.model}
                      recommendation={rec}
                      onSelect={() => handleSelect(rec, top3.length + i + 1)}
                      userZipCode={userZipCode}
                      weeklyMiles={weeklyMiles}
                      routine={routine}
                      isSelectedForCompare={compareSelected.has(rec.model)}
                      onToggleCompare={handleToggleCompare}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {refinePhase === "browse" && recommended.length === 0 && lowFit.length > 0 && (
            <p className="text-center text-white/50 text-sm mb-4">
              No vehicles scored Good Fit or above for this routine. Consider adjusting your charging access.
            </p>
          )}

          {/* Low fit vehicles (collapsed by default) */}
          {refinePhase === "browse" && lowFit.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowLowFit(!showLowFit)}
                className="w-full text-left px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/60 hover:bg-white/[0.07] transition-colors"
              >
                {showLowFit ? "Hide" : "Show"} {lowFit.length} vehicle{lowFit.length > 1 ? "s" : ""} with Mixed Fit or lower
              </button>
              {showLowFit && (
                <div className="space-y-4 mt-4">
                  {lowFit.map((rec) => (
                    <RecommendationCard
                      key={rec.model}
                      recommendation={rec}
                      onSelect={() => handleSelect(rec, -1)}
                      muted
                      userZipCode={userZipCode}
                      weeklyMiles={weeklyMiles}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dealer questions section */}
          {dealerQuestions.length > 0 && (
            <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-[#00d97e]" />
                <h3 className="text-sm font-semibold text-white/80">Top Questions to Ask Any Dealer</h3>
              </div>
              <ul className="space-y-2">
                {dealerQuestions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/70">
                    <span className="text-[#00d97e] font-bold shrink-0">{i + 1}.</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Manual entry fallback */}
          <div className="text-center">
            <button
              onClick={() => {
                trackEvent("recommendation_switch_to_manual");
                onSwitchToManual();
              }}
              className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-[#00d97e]/80 transition-colors"
            >
              <Search className="w-4 h-4" />
              Have a specific vehicle in mind? Enter details manually
            </button>
          </div>

          {dataSources && <DataSourcesBadge dataSources={dataSources} chargingAccess={localRoutine.charging_access} />}
          <SourcesFooter />
          </div>{/* end dim overlay wrapper */}
        </>
      )}
    </motion.div>
  );
}
