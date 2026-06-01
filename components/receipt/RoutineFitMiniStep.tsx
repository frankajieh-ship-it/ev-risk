"use client";

/**
 * RoutineFitMiniStep — Post-receipt routine awareness
 *
 * 4-question inline card that scores how well the listed EV
 * fits the buyer's daily routine. Deterministic scoring, no API calls.
 */

import { useState, useRef } from "react";
import Link from "next/link";
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
  trackEvent?: (eventName: string, eventData?: { [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | unknown[] }) => void | Promise<void>;
}

type ChargingAccess = "home" | "work" | "public";
type Climate = "winter" | "mild" | "hot";
type LongestTrip = "weekly" | "monthly" | "rarely";

const ROUTINE_FIT_STORAGE_KEY = "offo_routine_fit";

interface RoutineFitSavedData {
  charging: ChargingAccess;
  weeklyMiles: string;
  climate: Climate;
  longestTrip: LongestTrip;
}

function getSavedRoutineFit(): RoutineFitSavedData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ROUTINE_FIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.charging === "string" &&
      typeof parsed.weeklyMiles === "string" &&
      typeof parsed.climate === "string" &&
      typeof parsed.longestTrip === "string"
    ) {
      return parsed as RoutineFitSavedData;
    }
    return null;
  } catch {
    return null;
  }
}

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
          ? "border-[#00d97e] bg-[#00d97e]/10 text-[#00d97e]"
          : "border-white/[0.10] hover:border-white/[0.20] bg-white/[0.04] text-white/70 hover:text-white"
      }`}
    >
      {selected && (
        <span className="absolute top-1 right-1">
          <Check className="w-3.5 h-3.5 text-[#00d97e]" />
        </span>
      )}
      {label}
    </button>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30";
  if (score >= 60) return "text-blue-400 bg-blue-400/10 border-blue-400/30";
  if (score >= 40) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
  return "text-red-400 bg-red-400/10 border-red-400/30";
}

function getMentalLoadPill(load: string): { text: string; cls: string } {
  switch (load) {
    case "low":
      return { text: "Low mental load", cls: "bg-[#00d97e]/10 text-[#00d97e]" };
    case "medium":
      return { text: "Medium mental load", cls: "bg-yellow-400/10 text-yellow-400" };
    default:
      return { text: "High mental load", cls: "bg-red-400/10 text-red-400" };
  }
}

export default function RoutineFitMiniStep({
  receiptMileage,
  trackEvent,
}: RoutineFitMiniStepProps) {
  const saved = getSavedRoutineFit();
  const [charging, setCharging] = useState<ChargingAccess | null>(saved?.charging ?? null);
  const [weeklyMiles, setWeeklyMiles] = useState<string>(saved?.weeklyMiles ?? "");
  const [climate, setClimate] = useState<Climate | null>(saved?.climate ?? null);
  const [longestTrip, setLongestTrip] = useState<LongestTrip | null>(saved?.longestTrip ?? null);
  const [result, setResult] = useState<RoutineFitReceiptResult | null>(() => {
    if (!saved) return null;
    const miles = Number(saved.weeklyMiles);
    if (!saved.charging || miles <= 0 || !saved.climate || !saved.longestTrip) return null;
    return computeRoutineFitReceipt({
      charging_access: saved.charging,
      weekly_miles: miles,
      climate: saved.climate,
      longest_trip: saved.longestTrip,
      mileage: receiptMileage,
    });
  });
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

    // Persist inputs to localStorage
    try {
      localStorage.setItem(
        ROUTINE_FIT_STORAGE_KEY,
        JSON.stringify({ charging, weeklyMiles, climate, longestTrip })
      );
    } catch {
      // localStorage might be full or unavailable
    }

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
    try {
      localStorage.removeItem(ROUTINE_FIT_STORAGE_KEY);
    } catch {
      // localStorage might be unavailable
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <Activity className="w-5 h-5 text-[#00d97e]" />
        <h3 className="text-sm font-semibold text-white">
          Make this routine-aware
        </h3>
      </div>

      <div className="p-5 space-y-5">
        {!result ? (
          <>
            {/* Q1: Charging */}
            <div>
              <p className="text-sm font-medium text-white/70 mb-2">
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
              <p className="text-sm font-medium text-white/70 mb-2">
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
                className="w-full px-3 py-2.5 rounded-lg border border-white/[0.10] bg-white/[0.04] text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-1 focus:border-[#00d97e] focus:ring-[#00d97e]"
              />
            </div>

            {/* Q3: Climate */}
            <div>
              <p className="text-sm font-medium text-white/70 mb-2">
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
              <p className="text-sm font-medium text-white/70 mb-2">
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
                  ? "bg-[#00d97e] text-[#0d1117] hover:bg-[#00f090]"
                  : "bg-white/[0.06] text-white/30 cursor-not-allowed"
              }`}
            >
              Check Routine Fit
            </button>
            {showMilesHint && (
              <p className="text-xs text-yellow-400/80 text-center mt-1">
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
                    className="flex items-start gap-2 text-sm text-white/70"
                  >
                    <span className="text-yellow-400 mt-0.5">&#9679;</span>
                    {flag}
                  </li>
                ))}
              </ul>
            )}

            {/* Recalculate */}
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recalculate
            </button>

            <Link
              href="/routine"
              onClick={() => trackEvent?.("routine_mini_cta_clicked", { source: "receipt" })}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#00d97e] hover:text-[#00f090] transition-colors"
            >
              Get your full EV Fit analysis →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
