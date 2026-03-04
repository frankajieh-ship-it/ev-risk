"use client";

/**
 * /routine/results — EVRoutine V2 Results Page
 *
 * Reads run_id from URL, loads from localStorage cache.
 * Renders: FitVerdict, WhatBreaksFirst, Plan B card, StressFlags, Weather context.
 */

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Clock, Shield, Thermometer, ArrowLeft, LinkIcon, Loader2, TrendingUp, CheckCircle, AlertCircle, Zap, Radio, Car } from "lucide-react";
import { FitVerdictV2Block } from "@/components/blocks/FitVerdictV2Block";
import { WhatBreaksFirstV2Block } from "@/components/blocks/WhatBreaksFirstV2Block";
import { StressFlagsV2Block } from "@/components/blocks/StressFlagsV2Block";
import { useEventTracking } from "@/hooks/useEventTracking";
import { getOrCreatePersistentSessionId, getOrCreateReceiptToken } from "@/lib/session-utils";
import { generateFitOneLiner } from "@/lib/fit-verdict-liner";
import type { RoutineFitScore } from "@/types/v2";
import type { FitVerdict, StressFlagContract } from "@/types/v2-contract";
import type {
  WeatherData,
  ChargerSearchResult,
  PlanBCard,
} from "@/types/routine-v2";

interface ExtractedVehicle {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
}

interface DataSources {
  weather_live: boolean;
  chargers_live: boolean;
  has_vehicle: boolean;
  has_zip: boolean;
}

interface RunResult {
  run_id: string;
  fit_score: RoutineFitScore;
  plan_b: Omit<PlanBCard, "id" | "run_id" | "created_at">;
  weather_data?: WeatherData;
  nearby_chargers: ChargerSearchResult[];
  data_sources?: DataSources;
}

// Compute a charging quality grade from nearby chargers
function computeChargingGrade(chargers: ChargerSearchResult[]): {
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;
  summary: string;
  color: { bg: string; text: string; border: string };
} {
  if (chargers.length === 0) {
    return { grade: "F", label: "No Data", summary: "No charger data available for your area", color: { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200" } };
  }

  let score = 0;

  // Density (0–30 pts)
  if (chargers.length >= 15) score += 30;
  else if (chargers.length >= 8) score += 22;
  else if (chargers.length >= 4) score += 14;
  else score += 6;

  // DCFC availability (0–25 pts)
  const dcfcCount = chargers.filter((c) => c.level_type === "DCFC").length;
  const dcfcRatio = dcfcCount / chargers.length;
  if (dcfcRatio >= 0.4) score += 25;
  else if (dcfcRatio >= 0.2) score += 18;
  else if (dcfcCount >= 1) score += 10;

  // Network variety (0–15 pts)
  const networks = new Set(chargers.map((c) => c.network).filter(Boolean));
  if (networks.size >= 4) score += 15;
  else if (networks.size >= 2) score += 10;
  else if (networks.size >= 1) score += 5;

  // Proximity (0–15 pts) — closest charger distance
  const withDist = chargers.filter((c) => c.distance_mi !== undefined);
  if (withDist.length > 0) {
    const closest = Math.min(...withDist.map((c) => c.distance_mi!));
    if (closest <= 1) score += 15;
    else if (closest <= 3) score += 10;
    else if (closest <= 5) score += 6;
  }

  // 24h access (0–15 pts)
  const h24Count = chargers.filter((c) => c.hours_24).length;
  const h24Ratio = chargers.length > 0 ? h24Count / chargers.length : 0;
  if (h24Ratio >= 0.5) score += 15;
  else if (h24Ratio >= 0.25) score += 10;
  else if (h24Count >= 1) score += 5;

  const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "F";
  const colors = {
    A: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    B: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    C: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
    D: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    F: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  };
  const labels = { A: "Excellent", B: "Good", C: "Fair", D: "Limited", F: "Poor" };

  const parts: string[] = [];
  parts.push(`${chargers.length} charger${chargers.length !== 1 ? "s" : ""} within range`);
  if (dcfcCount > 0) parts.push(`${dcfcCount} DC fast`);
  if (networks.size > 1) parts.push(`${networks.size} networks`);

  return { grade, label: labels[grade], summary: parts.join(" · "), color: colors[grade] };
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
  const router = useRouter();
  const runId = searchParams.get("run_id");
  const applyVehicle = searchParams.get("apply_vehicle") === "true";
  const { trackEvent } = useEventTracking();
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Inline vehicle extraction state
  const [inputMode, setInputMode] = useState<"url" | "text" | "manual">("url");
  const [listingUrl, setListingUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualMake, setManualMake] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedVehicle, setExtractedVehicle] = useState<ExtractedVehicle | null>(null);

  // Re-run state
  const [rerunning, setRerunning] = useState(false);
  const [previousResult, setPreviousResult] = useState<RunResult | null>(null);

  // Re-run the analysis with vehicle data
  const rerunWithVehicle = useCallback(async (vehicle: ExtractedVehicle, currentResult: RunResult) => {
    setRerunning(true);
    setPreviousResult(currentResult);

    try {
      const anonSessionId = getOrCreatePersistentSessionId();
      const receiptToken = getOrCreateReceiptToken();
      if (!anonSessionId) throw new Error("No session ID");
      let routineInputs: Record<string, unknown> = {};

      // Fetch original run to get inputs_json (routine params)
      const runDetail = await fetch(
        `/api/routine/run/${currentResult.run_id}?anon_session_id=${encodeURIComponent(anonSessionId)}`
      ).then((r) => r.json());

      if (runDetail.success && runDetail.inputs_json?.routine) {
        routineInputs = runDetail.inputs_json.routine;
      } else {
        // Fallback: use reasonable defaults (the run API will validate)
        routineInputs = {
          charging_access: "public",
          climate: "mild",
          longest_day_pattern: "once_a_week",
          weekly_miles: 200,
        };
      }

      const runRes = await fetch("/api/routine/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anon_session_id: anonSessionId,
          receipt_token: receiptToken,
          charging_access: routineInputs.charging_access,
          weekly_miles: routineInputs.weekly_miles,
          commute_miles_roundtrip: routineInputs.commute_miles_roundtrip,
          climate: routineInputs.climate,
          longest_day_pattern: routineInputs.longest_day_pattern,
          home_location_zip: routineInputs.home_location_zip,
          vehicle_year: vehicle.year,
          vehicle_make: vehicle.make,
          vehicle_model: vehicle.model,
          run_type: "vehicle_update",
          scenario_name: `Updated with ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        }),
      });

      const runData = await runRes.json();

      if (!runData.success) {
        throw new Error(runData.error || "Re-run failed");
      }

      const newResult: RunResult = {
        run_id: runData.run_id,
        fit_score: runData.fit_score,
        plan_b: runData.plan_b,
        weather_data: runData.weather_data,
        nearby_chargers: runData.nearby_chargers,
      };

      // Cache the new result
      try {
        localStorage.setItem(`routine_run_${newResult.run_id}`, JSON.stringify(newResult));
      } catch {
        // localStorage full
      }

      // Store vehicle for future use
      try {
        localStorage.setItem("offo_routine_vehicle", JSON.stringify(vehicle));
      } catch {
        // ignore
      }

      setResult(newResult);
      trackEvent("routine_vehicle_rerun", {
        old_run_id: currentResult.run_id,
        new_run_id: newResult.run_id,
        old_score: currentResult.fit_score.score_0_100,
        new_score: newResult.fit_score.score_0_100,
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      });

      // Update URL to new run_id
      router.replace(`/routine/results?run_id=${newResult.run_id}`);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Failed to re-run analysis");
      setPreviousResult(null);
    } finally {
      setRerunning(false);
    }
  }, [router, trackEvent]);

  // Handle inline listing extraction (URL or text mode)
  const handleExtract = useCallback(async () => {
    if (!result) return;

    const body: Record<string, string> = {};
    if (inputMode === "url") {
      if (!listingUrl.trim()) return;
      body.url = listingUrl.trim();
    } else if (inputMode === "text") {
      if (listingText.trim().length < 20) return;
      body.text = listingText.trim();
    } else {
      return;
    }

    setExtracting(true);
    setExtractError(null);

    try {
      const res = await fetch("/api/receipt/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success || !data.fields) {
        throw new Error(data.error || "Could not extract vehicle info from this listing");
      }

      const vehicle: ExtractedVehicle = {
        year: data.fields.year,
        make: data.fields.make,
        model: data.fields.model,
        trim: data.fields.trim,
        mileage: data.fields.mileage,
      };

      if (!vehicle.make && !vehicle.year) {
        throw new Error("Could not identify vehicle from listing. Try a different URL or enter details manually.");
      }

      setExtractedVehicle(vehicle);
      trackEvent("routine_vehicle_extracted", {
        run_id: result.run_id,
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        source: inputMode,
      });

      // Auto-trigger re-run
      await rerunWithVehicle(vehicle, result);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }, [inputMode, listingUrl, listingText, result, trackEvent, rerunWithVehicle]);

  // Handle manual vehicle entry
  const handleManualSubmit = useCallback(async () => {
    if (!result) return;
    if (!manualYear && !manualMake) {
      setExtractError("Enter at least a year or make.");
      return;
    }

    setExtractError(null);
    const vehicle: ExtractedVehicle = {
      year: manualYear ? parseInt(manualYear, 10) : undefined,
      make: manualMake.trim() || undefined,
      model: manualModel.trim() || undefined,
    };

    setExtractedVehicle(vehicle);
    trackEvent("routine_vehicle_manual", {
      run_id: result.run_id,
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    });

    await rerunWithVehicle(vehicle, result);
  }, [manualYear, manualMake, manualModel, result, trackEvent, rerunWithVehicle]);

  // Load result from cache or DB
  useEffect(() => {
    if (!runId) {
      setLoading(false);
      return;
    }

    // 1. Try localStorage cache first
    try {
      const cached = localStorage.getItem(`routine_run_${runId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setResult(parsed);
        setLoading(false);
        trackEvent("routine_result_viewed", {
          run_id: runId,
          fit_label: parsed.fit_score?.label,
          source: "cache",
        });
        return;
      }
    } catch {
      // Cache miss
    }

    // 2. Fallback to DB
    const anonSessionId = getOrCreatePersistentSessionId();
    if (!anonSessionId) {
      setLoading(false);
      return;
    }

    fetch(`/api/routine/run/${runId}?anon_session_id=${encodeURIComponent(anonSessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setResult(data);
          trackEvent("routine_result_viewed", {
            run_id: runId,
            fit_label: data.fit_score?.label,
            source: "db",
          });
          // Cache for future visits
          try {
            localStorage.setItem(`routine_run_${runId}`, JSON.stringify(data));
          } catch {
            // localStorage full
          }
        }
      })
      .catch(() => {
        // DB fetch failed
      })
      .finally(() => setLoading(false));
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle apply_vehicle=true (returning from receipt page)
  useEffect(() => {
    if (!applyVehicle || !result || rerunning) return;

    try {
      const stored = localStorage.getItem("offo_routine_vehicle");
      if (stored) {
        const vehicle: ExtractedVehicle = JSON.parse(stored);
        if (vehicle.make || vehicle.year) {
          setExtractedVehicle(vehicle);
          rerunWithVehicle(vehicle, result);
        }
      }
    } catch {
      // ignore
    }
  }, [applyVehicle, result, rerunning, rerunWithVehicle]);

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

  const hasVehicleData = fit_score.confidence?.has_vehicle_data ?? false;
  const showConfidenceCTA = !hasVehicleData && !extractedVehicle && !rerunning;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Re-running overlay */}
      {rerunning && (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
          <p className="text-sm text-blue-700 font-medium">
            Re-running analysis with {extractedVehicle?.year} {extractedVehicle?.make} {extractedVehicle?.model} data...
          </p>
        </div>
      )}

      {/* "What Changed" comparison banner */}
      {previousResult && !rerunning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-bold text-gray-900">
              Updated with {extractedVehicle?.year} {extractedVehicle?.make} {extractedVehicle?.model}
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 mb-1">Score</p>
              <p className="text-sm font-semibold text-gray-900">
                {previousResult.fit_score.score_0_100}
                <span className="mx-1 text-gray-400">&rarr;</span>
                {fit_score.score_0_100}
                {fit_score.score_0_100 !== previousResult.fit_score.score_0_100 && (
                  <span className={`ml-1 text-xs ${fit_score.score_0_100 > previousResult.fit_score.score_0_100 ? "text-green-600" : "text-red-600"}`}>
                    ({fit_score.score_0_100 > previousResult.fit_score.score_0_100 ? "+" : ""}{fit_score.score_0_100 - previousResult.fit_score.score_0_100})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fit</p>
              <p className="text-sm font-semibold text-gray-900">
                {previousResult.fit_score.label === fit_score.label
                  ? fit_score.label
                  : <>
                      <span className="text-gray-400">{previousResult.fit_score.label}</span>
                      <span className="mx-1 text-gray-400">&rarr;</span>
                      {fit_score.label}
                    </>
                }
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Confidence</p>
              <p className="text-sm font-semibold text-gray-900">
                {previousResult.fit_score.confidence?.level}
                <span className="mx-1 text-gray-400">&rarr;</span>
                {fit_score.confidence?.level}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 1. Fit Verdict */}
      <FitVerdictV2Block fitVerdict={fitVerdict} />

      {/* Confidence CTA — improve with listing data */}
      {showConfidenceCTA && (
        <div className="p-5 bg-gradient-to-br from-indigo-50 via-white to-blue-50 rounded-2xl border border-indigo-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-gray-900">Improve Your Result</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            This analysis used an estimated range (200 mi). Add your vehicle details for a more accurate score.
          </p>

          {/* Mode tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-0.5">
            {([
              { key: "url" as const, label: "Listing URL" },
              { key: "text" as const, label: "Paste Text" },
              { key: "manual" as const, label: "Enter Details" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setInputMode(key); setExtractError(null); }}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
                  inputMode === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* URL mode */}
          {inputMode === "url" && (
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={listingUrl}
                  onChange={(e) => setListingUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleExtract()}
                  placeholder="Paste listing URL (e.g. cars.com, cargurus.com)"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={extracting}
                />
              </div>
              <button
                onClick={handleExtract}
                disabled={extracting || !listingUrl.trim()}
                className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  "Update"
                )}
              </button>
            </div>
          )}

          {/* Text paste mode */}
          {inputMode === "text" && (
            <div className="space-y-2 mb-3">
              <textarea
                value={listingText}
                onChange={(e) => setListingText(e.target.value)}
                placeholder="Paste the listing text here (year, make, model, mileage, etc.)"
                rows={4}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                disabled={extracting}
              />
              <button
                onClick={handleExtract}
                disabled={extracting || listingText.trim().length < 20}
                className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  "Extract & Update"
                )}
              </button>
            </div>
          )}

          {/* Manual entry mode */}
          {inputMode === "manual" && (
            <div className="space-y-3 mb-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Year</label>
                  <input
                    type="number"
                    value={manualYear}
                    onChange={(e) => setManualYear(e.target.value)}
                    placeholder="2023"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Make</label>
                  <input
                    type="text"
                    value={manualMake}
                    onChange={(e) => setManualMake(e.target.value)}
                    placeholder="Tesla"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Model</label>
                  <input
                    type="text"
                    value={manualModel}
                    onChange={(e) => setManualModel(e.target.value)}
                    placeholder="Model 3"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button
                onClick={handleManualSubmit}
                disabled={rerunning || (!manualYear && !manualMake)}
                className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {rerunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update with Vehicle"
                )}
              </button>
            </div>
          )}

          {extractError && (
            <div className="flex items-start gap-2 text-sm text-red-600 mb-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{extractError}</span>
              {inputMode === "url" && (
                <button
                  onClick={() => { setInputMode("text"); setExtractError(null); }}
                  className="text-indigo-600 hover:text-indigo-700 font-medium underline flex-shrink-0"
                >
                  Paste text instead
                </button>
              )}
              {inputMode === "text" && (
                <button
                  onClick={() => { setInputMode("manual"); setExtractError(null); }}
                  className="text-indigo-600 hover:text-indigo-700 font-medium underline flex-shrink-0"
                >
                  Enter manually
                </button>
              )}
            </div>
          )}

          {/* Link to receipt page as alternative */}
          {inputMode !== "manual" && (
            <div className="text-center">
              <span className="text-xs text-gray-400">or</span>
              <Link
                href={`/receipt?return_to=routine&run_id=${result.run_id}`}
                className="block mt-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Go to Full Receipt Analysis &rarr;
              </Link>
              <span className="text-xs text-gray-400">(returns here with vehicle data)</span>
            </div>
          )}
        </div>
      )}

      {/* 2. What Breaks First */}
      {fit_score.breakpoints_ranked.length > 0 && (
        <WhatBreaksFirstV2Block breakpoints={fit_score.breakpoints_ranked} />
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

      {/* 6. Charging Quality Grade */}
      {nearby_chargers.length > 0 && (() => {
        const chargingGrade = computeChargingGrade(nearby_chargers);
        const dcfcCount = nearby_chargers.filter((c) => c.level_type === "DCFC").length;
        const l2Count = nearby_chargers.filter((c) => c.level_type === "L2").length;
        return (
          <div className={`p-4 rounded-xl border ${chargingGrade.color.border} ${chargingGrade.color.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-gray-900">Charging in Your Area</p>
              </div>
              <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full border ${chargingGrade.color.border} ${chargingGrade.color.text} ${chargingGrade.color.bg}`}>
                {chargingGrade.grade} — {chargingGrade.label}
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-3">{chargingGrade.summary}</p>
            {/* Breakdown chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {dcfcCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded-full border border-gray-200 text-gray-700">
                  <Zap className="w-3 h-3 text-amber-500" /> {dcfcCount} DC Fast
                </span>
              )}
              {l2Count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded-full border border-gray-200 text-gray-700">
                  <Zap className="w-3 h-3 text-green-500" /> {l2Count} Level 2
                </span>
              )}
              {new Set(nearby_chargers.map((c) => c.network).filter(Boolean)).size > 0 && (
                <span className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded-full border border-gray-200 text-gray-700">
                  <Radio className="w-3 h-3 text-blue-500" /> {new Set(nearby_chargers.map((c) => c.network).filter(Boolean)).size} networks
                </span>
              )}
            </div>
            {/* Top chargers */}
            <div className="flex flex-wrap gap-2">
              {nearby_chargers.slice(0, 4).map((charger) => (
                <span
                  key={charger.id}
                  className="text-xs bg-white px-2.5 py-1 rounded-full border border-gray-200 text-gray-600"
                >
                  {charger.name}
                  {charger.distance_mi !== undefined && ` (${charger.distance_mi.toFixed(1)} mi)`}
                </span>
              ))}
              {nearby_chargers.length > 4 && (
                <span className="text-xs text-gray-400 px-2.5 py-1">
                  +{nearby_chargers.length - 4} more
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* 7. Data Sources — subtle indicator of what powered this analysis */}
      <div className="pt-2 pb-1">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">This analysis uses</p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Your routine data
          </span>
          {weather_data && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
              <span className={`w-1.5 h-1.5 rounded-full ${weather_data.weather_confidence_band === "low" ? "bg-gray-300" : "bg-green-400"}`} />
              {weather_data.weather_confidence_band === "low" ? "Estimated weather" : `Live weather — ${weather_data.location_used}`}
            </span>
          )}
          {nearby_chargers.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Live charger data
            </span>
          )}
          {fit_score.confidence?.has_vehicle_data ? (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Vehicle specs
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              Estimated range (200 mi)
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <a
          href="/routine"
          className="flex-1 py-3 px-6 border border-gray-300 rounded-xl font-medium text-gray-700 text-center hover:bg-gray-50 transition-all"
        >
          Back to Scenarios
        </a>
        <a
          href="/routine"
          className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-xl font-semibold text-center hover:bg-blue-700 transition-all"
        >
          Run Another
        </a>
      </div>
    </motion.div>
  );
}

export default function RoutineResultsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
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
