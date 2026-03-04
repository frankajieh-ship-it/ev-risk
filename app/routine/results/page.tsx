"use client";

/**
 * /routine/results — EVRoutine V2 Results Page
 *
 * Reads run_id from URL, loads from localStorage cache.
 * Renders: FitVerdict, WhatBreaksFirst, Plan B card, StressFlags, Weather context.
 */

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin, Clock, Shield, Thermometer } from "lucide-react";
import { FitVerdictV2Block } from "@/components/blocks/FitVerdictV2Block";
import { WhatBreaksFirstV2Block } from "@/components/blocks/WhatBreaksFirstV2Block";
import { StressFlagsV2Block } from "@/components/blocks/StressFlagsV2Block";
import { useEventTracking } from "@/hooks/useEventTracking";
import { generateFitOneLiner } from "@/lib/fit-verdict-liner";
import type { RoutineFitScore } from "@/types/v2";
import type { FitVerdict, StressFlagContract } from "@/types/v2-contract";
import type {
  WeatherData,
  ChargerSearchResult,
  PlanBCard,
} from "@/types/routine-v2";

interface RunResult {
  run_id: string;
  fit_score: RoutineFitScore;
  plan_b: Omit<PlanBCard, "id" | "run_id" | "created_at">;
  weather_data?: WeatherData;
  nearby_chargers: ChargerSearchResult[];
}

// Transform RoutineFitScore → FitVerdict for the existing block
function toFitVerdict(fitScore: RoutineFitScore): FitVerdict {
  const label =
    fitScore.label === "Great Fit" ? "Good Fit" : fitScore.label;
  return {
    label: label as FitVerdict["label"],
    one_liner: generateFitOneLiner(fitScore, {
      charging_access: "public",
      climate: "mild",
      longest_day_pattern: "once_a_week",
    }),
  };
}

// Transform stress flags for the existing block
function toStressFlags(fitScore: RoutineFitScore): StressFlagContract[] {
  return fitScore.stress_flags.slice(0, 3).map((flag) => {
    const matchingBp = fitScore.breakpoints_ranked.find(
      (bp) => bp.id === flag.id
    );
    return {
      title: flag.label,
      because: `because ${flag.routine_citation}`,
      impact: matchingBp?.break_point || flag.label,
    };
  });
}

// Stress label color mapping
const STRESS_COLORS = {
  minimal: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  moderate: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  high: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
} as const;

function RoutineResultsContent() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("run_id");
  const { trackEvent } = useEventTracking();
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) {
      setLoading(false);
      return;
    }

    // Load from localStorage cache
    try {
      const cached = localStorage.getItem(`routine_run_${runId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setResult(parsed);
        trackEvent("routine_result_viewed", {
          run_id: runId,
          fit_label: parsed.fit_score?.label,
        });
      }
    } catch {
      // Cache miss — result not available
    }
    setLoading(false);
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          No results found
        </h2>
        <p className="text-gray-500 mb-6">
          Run an analysis first to see your routine results.
        </p>
        <a
          href="/routine"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
        >
          Start Analysis
        </a>
      </div>
    );
  }

  const { fit_score, plan_b, weather_data, nearby_chargers } = result;
  const fitVerdict = toFitVerdict(fit_score);
  const stressFlags = toStressFlags(fit_score);
  const stressColor = STRESS_COLORS[plan_b.stress_label as keyof typeof STRESS_COLORS] || STRESS_COLORS.moderate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* 1. Fit Verdict */}
      <FitVerdictV2Block fitVerdict={fitVerdict} />

      {/* 2. What Breaks First */}
      {fit_score.breakpoints_ranked.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">What Breaks First</h2>
          <WhatBreaksFirstV2Block breakpoints={fit_score.breakpoints_ranked} />
        </div>
      )}

      {/* 3. Plan B Card */}
      <div className={`p-6 rounded-2xl border-2 ${stressColor.border} ${stressColor.bg}`}>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Your Plan B</h2>
          <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${stressColor.bg} ${stressColor.text} border ${stressColor.border}`}>
            {plan_b.stress_label} stress
          </span>
        </div>

        <p className="text-sm text-gray-700 mb-4">
          {plan_b.plan_summary}
        </p>

        {/* Charger info */}
        <div className="flex flex-wrap gap-3 mb-4">
          {plan_b.anchor_charger_name && (
            <div className="flex items-center gap-1.5 text-xs bg-white px-3 py-1.5 rounded-full border border-gray-200">
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-medium">{plan_b.anchor_charger_name}</span>
            </div>
          )}
          {plan_b.backup_charger_name && (
            <div className="flex items-center gap-1.5 text-xs bg-white px-3 py-1.5 rounded-full border border-gray-200">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span>Backup: {plan_b.backup_charger_name}</span>
            </div>
          )}
        </div>

        {/* Time penalty */}
        {plan_b.time_penalty_minutes > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-600 mb-4">
            <Clock className="w-3.5 h-3.5" />
            <span>~{plan_b.time_penalty_minutes} min/week for backup charging</span>
          </div>
        )}

        {/* Mitigation steps */}
        {plan_b.mitigation_steps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-2">
              Action Steps
            </p>
            <ol className="space-y-2">
              {plan_b.mitigation_steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Buffer rule */}
        {plan_b.buffer_rule && (
          <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Buffer Rule</p>
            <p className="text-sm text-gray-700">{plan_b.buffer_rule}</p>
          </div>
        )}
      </div>

      {/* 4. Stress Flags */}
      {stressFlags.length > 0 && (
        <StressFlagsV2Block flags={stressFlags} />
      )}

      {/* 5. Weather Context */}
      {weather_data && (
        <div className="p-4 bg-white rounded-xl border border-gray-100 flex items-center gap-3">
          <Thermometer className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {Math.round(weather_data.current_temp_f)}&deg;F &mdash; {weather_data.current_conditions}
            </p>
            <p className="text-xs text-gray-500">
              {weather_data.location_used}
              {weather_data.source === "manual_override" && " (estimated)"}
            </p>
          </div>
          <span className={`ml-auto text-xs font-medium px-2 py-1 rounded-full ${
            weather_data.weather_confidence_band === "high"
              ? "bg-green-100 text-green-700"
              : weather_data.weather_confidence_band === "medium"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-100 text-gray-500"
          }`}>
            {weather_data.weather_confidence_band === "low" ? "Estimated" : "Live"}
          </span>
        </div>
      )}

      {/* 6. Nearby Chargers Summary */}
      {nearby_chargers.length > 0 && (
        <div className="p-4 bg-white rounded-xl border border-gray-100">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {nearby_chargers.length} chargers found nearby
          </p>
          <div className="flex flex-wrap gap-2">
            {nearby_chargers.slice(0, 5).map((charger) => (
              <span
                key={charger.id}
                className="text-xs bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200 text-gray-600"
              >
                {charger.name}
                {charger.distance_mi !== undefined && ` (${charger.distance_mi.toFixed(1)} mi)`}
              </span>
            ))}
            {nearby_chargers.length > 5 && (
              <span className="text-xs text-gray-400 px-2.5 py-1">
                +{nearby_chargers.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <a
          href="/routine"
          className="flex-1 py-3 px-6 border border-gray-300 rounded-xl font-medium text-gray-700 text-center hover:bg-gray-50 transition-all"
        >
          Run Again
        </a>
      </div>
    </motion.div>
  );
}

export default function RoutineResultsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <RoutineResultsContent />
        </Suspense>
      </div>
    </div>
  );
}
