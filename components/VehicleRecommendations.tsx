"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, AlertCircle, MessageSquare } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import RecommendationCard from "./RecommendationCard";
import type { MinimumViableRoutine } from "@/types/v2";
import type { VehicleRecommendation, RecommendationsResponse } from "@/types/recommendations";

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

function SkeletonCard() {
  return (
    <div className="rounded-2xl border-2 border-gray-100 bg-white p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200" />
        <div className="flex-1">
          <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <div className="h-6 w-20 bg-gray-100 rounded-full" />
        <div className="h-6 w-16 bg-gray-100 rounded-full" />
        <div className="h-6 w-14 bg-gray-100 rounded-full" />
      </div>
      <div className="h-10 w-full bg-gray-100 rounded-xl mt-4" />
    </div>
  );
}

export default function VehicleRecommendations({
  routine,
  onSelectVehicle,
  onSwitchToManual,
  onBack,
}: VehicleRecommendationsProps) {
  const { trackEvent } = useEventTracking();

  const [recommendations, setRecommendations] = useState<VehicleRecommendation[]>([]);
  const [dealerQuestions, setDealerQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showLowFit, setShowLowFit] = useState(false);

  const weeklyMiles = routine.weekly_miles
    ?? (routine.commute_miles_roundtrip ? routine.commute_miles_roundtrip * 5 : 100);

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
          trackEvent("recommendations_viewed", {
            count: data.recommendations.length,
            great_fit_count: data.recommendations.filter(r => r.fit_label === "Great Fit").length,
            good_fit_count: data.recommendations.filter(r => r.fit_label === "Good Fit").length,
          });
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

  // Split into recommended (Good Fit+) and other
  const recommended = filtered.filter(r => r.fit_score >= 65);
  const lowFit = filtered.filter(r => r.fit_score < 65);

  // Available categories (only show filter pills for categories that exist)
  const availableCategories = CATEGORY_FILTERS.filter(
    f => f.value === "all" || recommendations.some(r => r.sub_category === f.value)
  );

  const handleSelect = (rec: VehicleRecommendation) => {
    trackEvent("recommendation_selected", {
      model: rec.model,
      year: rec.year,
      fit_score: rec.fit_score,
      fit_label: rec.fit_label,
    });
    onSelectVehicle({ model: rec.model, year: rec.year });
  };

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
          className="flex items-center text-gray-500 hover:text-gray-700 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to routine
        </button>
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">EVs That Match Your Routine</h2>
        <p className="text-sm text-gray-500 mt-1">
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
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <>
          {/* Category filter pills */}
          {availableCategories.length > 2 && (
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
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Recommended vehicles */}
          {recommended.length > 0 && (
            <div className="space-y-4 mb-6">
              {recommended.map((rec) => (
                <RecommendationCard
                  key={rec.model}
                  recommendation={rec}
                  onSelect={() => handleSelect(rec)}
                />
              ))}
            </div>
          )}

          {recommended.length === 0 && lowFit.length > 0 && (
            <p className="text-center text-gray-500 text-sm mb-4">
              No vehicles scored Good Fit or above for this routine. Consider adjusting your charging access.
            </p>
          )}

          {/* Low fit vehicles (collapsed by default) */}
          {lowFit.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowLowFit(!showLowFit)}
                className="w-full text-left px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {showLowFit ? "Hide" : "Show"} {lowFit.length} vehicle{lowFit.length > 1 ? "s" : ""} with Mixed Fit or lower
              </button>
              {showLowFit && (
                <div className="space-y-4 mt-4">
                  {lowFit.map((rec) => (
                    <RecommendationCard
                      key={rec.model}
                      recommendation={rec}
                      onSelect={() => handleSelect(rec)}
                      muted
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dealer questions section */}
          {dealerQuestions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Top Questions to Ask Any Dealer</h3>
              </div>
              <ul className="space-y-2">
                {dealerQuestions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-blue-600 font-bold shrink-0">{i + 1}.</span>
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
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Search className="w-4 h-4" />
              Have a specific vehicle in mind? Enter details manually
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
