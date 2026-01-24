"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, HelpCircle, Copy, CheckCircle } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { resolveRegion, type RegionSelection } from "@/lib/resolveRegion";
import { getCopy } from "@/lib/getCopy";
import { compareOptions } from "@/lib/comparison-engine";
import type {
  BaseRoutineInput,
  OptionInput,
  ComparisonResult,
  BodyTypeBucket,
  BatteryBucket,
  EfficiencyBucket,
  ChargingCurveBucket,
} from "@/lib/comparison-types";
import {
  BODY_TYPE_LABELS,
  BATTERY_LABELS,
  EFFICIENCY_LABELS,
  CHARGING_CURVE_LABELS,
  FADE_LABEL_DISPLAY,
  FIT_SIGNAL_LABELS,
} from "@/lib/comparison-types";
import type { Region } from "@/lib/regionCopy";

type Phase = "routine" | "options" | "results";

// Default option input
const defaultOption: OptionInput = {
  label: "",
  body_type_bucket: "UNKNOWN",
  battery_bucket: "UNKNOWN",
  efficiency_bucket: "UNKNOWN",
  charging_curve_bucket: "UNKNOWN",
};

export default function ComparePage() {
  const { trackEvent } = useEventTracking();

  // Phase state
  const [phase, setPhase] = useState<Phase>("routine");

  // Region state
  const [regionSelection, setRegionSelection] = useState<RegionSelection>("AUTO");
  const regionResolved = resolveRegion(regionSelection);
  const copy = getCopy(regionResolved);

  // Routine inputs
  const [hasHomeCharging, setHasHomeCharging] = useState<boolean | null>(null);
  const [homeChargingType, setHomeChargingType] = useState<"L1" | "L2" | "UNKNOWN">("UNKNOWN");
  const [canChargeAtWork, setCanChargeAtWork] = useState<boolean | null>(null);
  const [publicDependency, setPublicDependency] = useState<"RARE" | "SOMETIMES" | "OFTEN" | null>(null);
  const [routinePattern, setRoutinePattern] = useState<"LOCAL" | "MIXED" | "MOTORWAY_HEAVY" | null>(null);
  const [longDayFrequency, setLongDayFrequency] = useState<"RARE" | "MONTHLY" | "WEEKLY" | null>(null);
  const [planningTolerance, setPlanningTolerance] = useState<"LOW" | "MED" | "HIGH" | null>(null);
  const [sharedInfrastructure, setSharedInfrastructure] = useState<"NONE" | "SOME" | "HIGH" | null>(null);

  // Option inputs
  const [optionA, setOptionA] = useState<OptionInput>({ ...defaultOption });
  const [optionB, setOptionB] = useState<OptionInput>({ ...defaultOption });

  // Results
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // Track page view
  useEffect(() => {
    trackEvent("compare_started", { region: regionResolved });
  }, []);

  // Track results viewed when result is set
  useEffect(() => {
    if (result && phase === "results") {
      trackEvent("compare_results_viewed", {
        region: regionResolved,
        fit_signal_a: result.optionA.fit_signal,
        fit_signal_b: result.optionB.fit_signal,
        delta_count: result.routine_delta_bullets.length,
      });
    }
  }, [result, phase]);

  // Check if routine is complete
  const isRoutineComplete =
    hasHomeCharging !== null &&
    canChargeAtWork !== null &&
    publicDependency !== null &&
    routinePattern !== null &&
    longDayFrequency !== null &&
    planningTolerance !== null &&
    sharedInfrastructure !== null;

  // Handle routine submission
  const handleRoutineSubmit = () => {
    if (!isRoutineComplete) return;

    trackEvent("compare_routine_completed", {
      region: regionResolved,
      has_home_charging: hasHomeCharging,
      public_dependency: publicDependency,
      planning_tolerance: planningTolerance,
    });

    setPhase("options");
  };

  // Handle options submission
  const handleOptionsSubmit = () => {
    if (!isRoutineComplete) return;

    const baseRoutine: BaseRoutineInput = {
      region: regionResolved,
      has_home_charging: hasHomeCharging!,
      home_charging_type: hasHomeCharging ? homeChargingType : undefined,
      can_charge_at_work: canChargeAtWork!,
      public_charging_dependency: publicDependency!,
      routine_pattern: routinePattern!,
      long_day_frequency: longDayFrequency!,
      planning_tolerance: planningTolerance!,
      shared_infrastructure: sharedInfrastructure!,
    };

    const comparisonResult = compareOptions({
      ...baseRoutine,
      optionA,
      optionB,
    });

    setResult(comparisonResult);

    // Track submission (sanitize labels for privacy)
    trackEvent("compare_submitted", {
      region: regionResolved,
      public_charging_dependency: publicDependency,
      planning_tolerance: planningTolerance,
      option_a_buckets: {
        body: optionA.body_type_bucket,
        battery: optionA.battery_bucket,
        efficiency: optionA.efficiency_bucket,
        curve: optionA.charging_curve_bucket,
      },
      option_b_buckets: {
        body: optionB.body_type_bucket,
        battery: optionB.battery_bucket,
        efficiency: optionB.efficiency_bucket,
        curve: optionB.charging_curve_bucket,
      },
    });

    setPhase("results");
  };

  // Render routine questions phase
  const renderRoutinePhase = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Your Routine</h2>
        <p className="text-sm text-gray-600">
          Answer these questions once — they apply to both options you're comparing.
        </p>
      </div>

      {/* Region Selection */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Your region</p>
            <p className="text-xs text-gray-600 mt-1">
              {regionResolved === "UK" ? "United Kingdom detected" : "United States detected"}
            </p>
          </div>
          <select
            value={regionSelection}
            onChange={(e) => setRegionSelection(e.target.value as RegionSelection)}
            className="text-sm border border-gray-300 rounded px-3 py-2 bg-white focus:border-blue-600 focus:outline-none"
          >
            <option value="AUTO">Auto-detect</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
          </select>
        </div>
      </div>

      {/* Q1: Home Charging */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900">
          Do you have dedicated home charging?
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: true, label: "Yes" },
            { value: false, label: "No" },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setHasHomeCharging(opt.value)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                hasHomeCharging === opt.value
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {hasHomeCharging && (
          <div className="mt-3 pl-4 border-l-2 border-blue-200">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              What type?
            </label>
            <div className="flex gap-2">
              {(["L1", "L2", "UNKNOWN"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setHomeChargingType(type)}
                  className={`px-3 py-1.5 rounded text-xs ${
                    homeChargingType === type
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {type === "UNKNOWN" ? "Not sure" : type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Q2: Work Charging */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900">
          Can you charge at work?
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: true, label: "Yes" },
            { value: false, label: "No" },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setCanChargeAtWork(opt.value)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                canChargeAtWork === opt.value
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Q3: Public Charging Dependency */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900">
          How often would you rely on public charging?
        </label>
        <div className="space-y-2">
          {(["RARE", "SOMETIMES", "OFTEN"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setPublicDependency(opt)}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                publicDependency === opt
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">
                {opt === "RARE" && "Rarely (road trips only)"}
                {opt === "SOMETIMES" && "Sometimes (weekly)"}
                {opt === "OFTEN" && "Often (multiple times per week)"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Q4: Routine Pattern */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900">
          What's your typical driving pattern?
        </label>
        <div className="space-y-2">
          {(["LOCAL", "MIXED", "MOTORWAY_HEAVY"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setRoutinePattern(opt)}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                routinePattern === opt
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">
                {opt === "LOCAL" && "Mostly local / city driving"}
                {opt === "MIXED" && "Mix of local and highway"}
                {opt === "MOTORWAY_HEAVY" && (regionResolved === "UK" ? "Motorway-heavy" : "Highway-heavy")}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Q5: Long Day Frequency */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900">
          How often do you have long driving days (100+ miles)?
        </label>
        <div className="space-y-2">
          {(["RARE", "MONTHLY", "WEEKLY"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setLongDayFrequency(opt)}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                longDayFrequency === opt
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">
                {opt === "RARE" && "Rarely (a few times a year)"}
                {opt === "MONTHLY" && "Monthly"}
                {opt === "WEEKLY" && "Weekly or more"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Q6: Planning Tolerance */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900">
          How do you feel about planning charging stops?
        </label>
        <div className="space-y-2">
          {(["LOW", "MED", "HIGH"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setPlanningTolerance(opt)}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                planningTolerance === opt
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">
                {opt === "LOW" && "I prefer not to think about it"}
                {opt === "MED" && "I don't mind some planning"}
                {opt === "HIGH" && "I'm comfortable planning ahead"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Q7: Shared Infrastructure */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900">
          Would you share charging access with others?
        </label>
        <div className="space-y-2">
          {(["NONE", "SOME", "HIGH"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSharedInfrastructure(opt)}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                sharedInfrastructure === opt
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">
                {opt === "NONE" && "No — dedicated charger for me"}
                {opt === "SOME" && "Sometimes (shared with household)"}
                {opt === "HIGH" && "Yes (apartment / shared parking)"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={handleRoutineSubmit}
        disabled={!isRoutineComplete}
        className={`w-full py-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
          isRoutineComplete
            ? "bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-lg"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        Continue to Options <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  // Render option input card
  const renderOptionCard = (
    option: OptionInput,
    setOption: (opt: OptionInput) => void,
    title: string
  ) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>

      {/* Label */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Name (optional)
        </label>
        <input
          type="text"
          value={option.label || ""}
          onChange={(e) => setOption({ ...option, label: e.target.value })}
          placeholder="e.g., Polestar 2"
          maxLength={30}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
        />
      </div>

      {/* Body Type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Body type
        </label>
        <select
          value={option.body_type_bucket}
          onChange={(e) => setOption({ ...option, body_type_bucket: e.target.value as BodyTypeBucket })}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
        >
          {(Object.keys(BODY_TYPE_LABELS) as BodyTypeBucket[]).map((key) => (
            <option key={key} value={key}>
              {BODY_TYPE_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {/* Battery Size */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Battery size
        </label>
        <select
          value={option.battery_bucket}
          onChange={(e) => setOption({ ...option, battery_bucket: e.target.value as BatteryBucket })}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
        >
          {(Object.keys(BATTERY_LABELS) as BatteryBucket[]).map((key) => (
            <option key={key} value={key}>
              {BATTERY_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {/* Efficiency */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Efficiency
        </label>
        <select
          value={option.efficiency_bucket}
          onChange={(e) => setOption({ ...option, efficiency_bucket: e.target.value as EfficiencyBucket })}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
        >
          {(Object.keys(EFFICIENCY_LABELS) as EfficiencyBucket[]).map((key) => (
            <option key={key} value={key}>
              {EFFICIENCY_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {/* Charging Curve */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          DC charging speed
        </label>
        <select
          value={option.charging_curve_bucket}
          onChange={(e) => setOption({ ...option, charging_curve_bucket: e.target.value as ChargingCurveBucket })}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
        >
          {(Object.keys(CHARGING_CURVE_LABELS) as ChargingCurveBucket[]).map((key) => (
            <option key={key} value={key}>
              {CHARGING_CURVE_LABELS[key]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // Render options phase
  const renderOptionsPhase = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Your Two Options</h2>
        <p className="text-sm text-gray-600">
          Describe the two EVs you're comparing. Don't know something? Choose "Not sure" — we'll keep the output neutral.
        </p>
      </div>

      {/* Two option cards side by side on larger screens */}
      <div className="grid md:grid-cols-2 gap-4">
        {renderOptionCard(optionA, setOptionA, "Option A")}
        {renderOptionCard(optionB, setOptionB, "Option B")}
      </div>

      {/* Help text */}
      <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Don't worry about exact specs. These categories help us understand how each option might fit your routine differently.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={() => setPhase("routine")}
          className="flex-1 py-3 rounded-lg font-medium border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleOptionsSubmit}
          className="flex-1 py-3 rounded-lg font-semibold bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          Compare <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Render single result card
  const renderResultCard = (
    fitResult: ComparisonResult["optionA"],
    fallbackLabel: string
  ) => {
    const label = fitResult.label || fallbackLabel;
    const signalColor = {
      GOOD: "bg-green-100 text-green-800 border-green-200",
      CONDITIONAL: "bg-yellow-100 text-yellow-800 border-yellow-200",
      HIGH_FRICTION: "bg-red-100 text-red-800 border-red-200",
    }[fitResult.fit_signal];

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        {/* Label */}
        <h3 className="font-semibold text-gray-900">{label}</h3>

        {/* Fit Signal Badge */}
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${signalColor}`}>
          {FIT_SIGNAL_LABELS[fitResult.fit_signal]}
        </div>

        {/* Fade Label */}
        <p className="text-sm text-gray-600 italic">
          {FADE_LABEL_DISPLAY[fitResult.fade_label]}
        </p>

        {/* Friction Bullets */}
        {fitResult.friction_bullets.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Key considerations</p>
            <ul className="space-y-2">
              {fitResult.friction_bullets.map((bullet, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Why Not 100% */}
        {fitResult.why_not_100.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Why not 100%?</p>
            <ul className="space-y-1">
              {fitResult.why_not_100.map((reason, idx) => (
                <li key={idx} className="text-xs text-gray-600">
                  • {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Render results phase
  const renderResultsPhase = () => {
    if (!result) return null;

    return (
      <div className="space-y-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Comparison Results</h2>
          <p className="text-sm text-gray-600">
            How each option fits your routine.
          </p>
        </div>

        {/* Side-by-side cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {renderResultCard(result.optionA, "Option A")}
          {renderResultCard(result.optionB, "Option B")}
        </div>

        {/* Delta Section */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">
            What would change between these two?
          </h3>
          <ul className="space-y-3">
            {result.routine_delta_bullets.map((bullet, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-blue-600 mt-0.5 font-bold">→</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Neutral Closer */}
        <div className="text-center py-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 italic">
            {result.neutral_closer}
          </p>
        </div>

        {/* Copy Key Takeaway */}
        <button
          onClick={async () => {
            const labelA = result.optionA.label || "Option A";
            const labelB = result.optionB.label || "Option B";
            const takeaway = [
              `Comparing ${labelA} vs ${labelB}:`,
              "",
              `${labelA}: ${FIT_SIGNAL_LABELS[result.optionA.fit_signal]} - ${FADE_LABEL_DISPLAY[result.optionA.fade_label]}`,
              `${labelB}: ${FIT_SIGNAL_LABELS[result.optionB.fit_signal]} - ${FADE_LABEL_DISPLAY[result.optionB.fade_label]}`,
              "",
              "Key differences:",
              ...result.routine_delta_bullets.map(b => `• ${b}`),
              "",
              result.neutral_closer,
            ].join("\n");

            try {
              await navigator.clipboard.writeText(takeaway);
              setShowCopySuccess(true);
              setTimeout(() => setShowCopySuccess(false), 2000);
              trackEvent("compare_copy_takeaway_clicked", {
                region: regionResolved,
                fit_signal_a: result.optionA.fit_signal,
                fit_signal_b: result.optionB.fit_signal,
              });
            } catch (err) {
              console.error("Copy failed:", err);
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-blue-500 transition-all"
        >
          {showCopySuccess ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy key takeaway</span>
            </>
          )}
        </button>

        {/* Start Over */}
        <button
          onClick={() => {
            setPhase("routine");
            setResult(null);
            trackEvent("compare_restart_clicked", { region: regionResolved });
          }}
          className="w-full py-3 rounded-lg font-medium border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
        >
          Start New Comparison
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Compare Two Options
          </h1>
          <p className="text-gray-600">
            See how each EV would fit your routine — no specs, no recommendations.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["routine", "options", "results"] as Phase[]).map((p, idx) => (
            <div key={p} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  phase === p
                    ? "bg-blue-600 text-white"
                    : idx < ["routine", "options", "results"].indexOf(phase)
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {idx + 1}
              </div>
              {idx < 2 && (
                <div
                  className={`w-12 h-0.5 ${
                    idx < ["routine", "options", "results"].indexOf(phase)
                      ? "bg-green-500"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Phase content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {phase === "routine" && renderRoutinePhase()}
            {phase === "options" && renderOptionsPhase()}
            {phase === "results" && renderResultsPhase()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
