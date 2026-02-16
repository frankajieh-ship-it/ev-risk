"use client";

/**
 * RoutineFitMiniStep — Post-receipt routine awareness
 *
 * 4-question inline card that scores how well the listed EV
 * fits the buyer's daily routine. Deterministic scoring, no API calls.
 */

import { useState, useRef } from "react";
import { Activity, Check, RotateCcw } from "lucide-react";
import {
  computeRoutineFitReceipt,
  type RoutineFitReceiptInput,
  type RoutineFitReceiptResult,
} from "@/lib/routine-fit-receipt";

interface RoutineFitMiniStepProps {
  receiptMileage?: number;
  receiptPrice?: number;
  receiptSellerType?: string;
  trackEvent?: (eventName: string, eventData?: Record<string, any>) => void;
}

type ChargingAccess = "home" | "work" | "public";
type Climate = "winter" | "mild" | "hot";
type LongestTrip = "weekly" | "monthly" | "rarely";

function SelectionCard({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`relative px-3 py-2.5 rounded-xl border-2 text-center transition-all text-sm font-medium ${
        selected
          ? "border-blue-600 bg-blue-100 text-blue-900 shadow-sm"
          : "border-gray-200 hover:border-gray-300 bg-white text-gray-700"
      }`}
    >
      {selected && (
        <span className="absolute top-1 right-1">
          <Check className="w-3.5 h-3.5 text-blue-600" />
        </span>
      )}
      {label}
    </button>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-700 bg-green-50 border-green-200";
  if (score >= 60) return "text-blue-700 bg-blue-50 border-blue-200";
  if (score >= 40) return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-red-700 bg-red-50 border-red-200";
}

function getMentalLoadPill(load: string): { text: string; cls: string } {
  switch (load) {
    case "low":
      return { text: "Low mental load", cls: "bg-green-100 text-green-700" };
    case "medium":
      return { text: "Medium mental load", cls: "bg-yellow-100 text-yellow-700" };
    default:
      return { text: "High mental load", cls: "bg-red-100 text-red-700" };
  }
}

export default function RoutineFitMiniStep({
  receiptMileage,
  trackEvent,
}: RoutineFitMiniStepProps) {
  const [charging, setCharging] = useState<ChargingAccess | null>(null);
  const [weeklyMiles, setWeeklyMiles] = useState<string>("");
  const [climate, setClimate] = useState<Climate | null>(null);
  const [longestTrip, setLongestTrip] = useState<LongestTrip | null>(null);
  const [result, setResult] = useState<RoutineFitReceiptResult | null>(null);
  const hasTrackedStart = useRef(false);

  const trackInteraction = () => {
    if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackEvent?.("routine_check_started", {});
    }
  };

  const trackFieldCompleted = (fieldId: string) => {
    trackEvent?.("routine_field_completed", {
      field_id: fieldId,
      step_id: "routine_fit_mini",
    });
  };

  const milesEmpty = weeklyMiles.trim() === "" || Number(weeklyMiles) <= 0;
  const canCompute =
    charging !== null &&
    !milesEmpty &&
    climate !== null &&
    longestTrip !== null;
  const showMilesHint =
    !canCompute && charging !== null && climate !== null && longestTrip !== null && milesEmpty;

  const handleCompute = () => {
    if (!canCompute) return;

    const input: RoutineFitReceiptInput = {
      charging_access: charging!,
      weekly_miles: Number(weeklyMiles),
      climate: climate!,
      longest_trip: longestTrip!,
      mileage: receiptMileage,
    };

    const res = computeRoutineFitReceipt(input);
    setResult(res);

    trackEvent?.("routine_check_completed", {
      score: res.score,
      label: res.label,
      mental_load: res.mental_load,
      stress_flags_count: res.stress_flags.length,
    });
    trackEvent?.("routine_score_viewed", {
      score: res.score,
      label: res.label,
    });
  };

  const handleReset = () => {
    setCharging(null);
    setWeeklyMiles("");
    setClimate(null);
    setLongestTrip(null);
    setResult(null);
    hasTrackedStart.current = false;
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
        <Activity className="w-5 h-5 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900">
          Make this routine-aware
        </h3>
      </div>

      <div className="p-5 space-y-5">
        {!result ? (
          <>
            {/* Q1: Charging */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Where will you charge most often?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["home", "work", "public"] as const).map((opt) => (
                  <SelectionCard
                    key={opt}
                    selected={charging === opt}
                    onClick={() => {
                      if (charging !== opt) trackFieldCompleted("charging_access");
                      setCharging(opt);
                      trackInteraction();
                    }}
                    label={opt === "home" ? "Home" : opt === "work" ? "Work" : "Public"}
                  />
                ))}
              </div>
            </div>

            {/* Q2: Weekly miles */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                How many miles do you drive per week?
              </p>
              <input
                type="number"
                value={weeklyMiles}
                onChange={(e) => {
                  if (weeklyMiles.trim() === "" && e.target.value.trim() !== "") {
                    trackFieldCompleted("weekly_miles");
                  }
                  setWeeklyMiles(e.target.value);
                  trackInteraction();
                }}
                placeholder="e.g. 150"
                min={1}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:border-blue-600 focus:ring-blue-600"
              />
            </div>

            {/* Q3: Climate */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                What&apos;s your climate like?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["winter", "mild", "hot"] as const).map((opt) => (
                  <SelectionCard
                    key={opt}
                    selected={climate === opt}
                    onClick={() => {
                      if (climate !== opt) trackFieldCompleted("climate");
                      setClimate(opt);
                      trackInteraction();
                    }}
                    label={opt === "winter" ? "Cold winters" : opt === "mild" ? "Mild" : "Hot"}
                  />
                ))}
              </div>
            </div>

            {/* Q4: Longest trip frequency */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                How often do you have long driving days?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["weekly", "monthly", "rarely"] as const).map((opt) => (
                  <SelectionCard
                    key={opt}
                    selected={longestTrip === opt}
                    onClick={() => {
                      if (longestTrip !== opt) trackFieldCompleted("longest_day_pattern");
                      setLongestTrip(opt);
                      trackInteraction();
                    }}
                    label={opt === "weekly" ? "Weekly" : opt === "monthly" ? "Monthly" : "Rarely"}
                  />
                ))}
              </div>
            </div>

            {/* Compute button */}
            <button
              onClick={handleCompute}
              disabled={!canCompute}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                canCompute
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Check Routine Fit
            </button>
            {showMilesHint && (
              <p className="text-xs text-amber-600 text-center mt-1">
                Enter your weekly miles above to continue
              </p>
            )}
          </>
        ) : (
          /* Result display */
          <div className="space-y-4">
            {/* Score */}
            <div
              className={`flex items-center justify-between px-4 py-3 rounded-xl border ${getScoreColor(result.score)}`}
            >
              <div>
                <p className="text-lg font-bold">{result.label}</p>
                <p className="text-xs opacity-75">
                  Based on your routine + this listing
                </p>
              </div>
              <div className="text-3xl font-bold">{result.score}</div>
            </div>

            {/* Mental load pill */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getMentalLoadPill(result.mental_load).cls}`}
              >
                {getMentalLoadPill(result.mental_load).text}
              </span>
            </div>

            {/* Stress flags */}
            {result.stress_flags.length > 0 && (
              <ul className="space-y-1.5">
                {result.stress_flags.map((flag, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="text-yellow-500 mt-0.5">&#9679;</span>
                    {flag}
                  </li>
                ))}
              </ul>
            )}

            {/* Recalculate */}
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recalculate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
