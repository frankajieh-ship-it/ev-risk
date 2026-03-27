"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Copy, CheckCircle, GitCompareArrows, History, ChevronDown, ChevronUp, Lock, Loader2, ShieldCheck, BarChart2, MessageSquare } from "lucide-react";
import VehicleImage from "@/components/VehicleImage";
import ListingExtractMini from "@/components/compare/ListingExtractMini";
import ReceiptHistoryDrawer from "@/components/receipt/ReceiptHistoryDrawer";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useReceiptHistory } from "@/hooks/useReceiptHistory";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { getDisplayPriceForRegion } from "@/lib/price-assignment";
import type { ReceiptHistoryEntry } from "@/types/receipt";
import { resolveRegion, type RegionSelection } from "@/lib/resolveRegion";
import { compareOptions } from "@/lib/comparison-engine";
import { getShortlist } from "@/lib/shortlist-store";
import type {
  BaseRoutineInput,
  OptionInput,
  OptionSpec,
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
  deriveBatteryBucket,
  deriveEfficiencyBucket,
  deriveChargingBucket,
  deriveBodyBucket,
} from "@/lib/comparison-types";
import OFfoChat from "@/components/chat/OFfoChat";

// New flow: options → results → (optional) refine by routine
type Phase = "options" | "results" | "routine";

const defaultOption: OptionInput = {
  label: "",
  body_type_bucket: "UNKNOWN",
  battery_bucket: "UNKNOWN",
  efficiency_bucket: "UNKNOWN",
  charging_curve_bucket: "UNKNOWN",
};

const defaultSpec: OptionSpec = {};

// Default routine used for immediate results before user fills in their routine
const DEFAULT_BASE_ROUTINE: Omit<BaseRoutineInput, "region"> = {
  has_home_charging: true,
  home_charging_type: "UNKNOWN",
  can_charge_at_work: false,
  public_charging_dependency: "SOMETIMES",
  routine_pattern: "MIXED",
  long_day_frequency: "MONTHLY",
  planning_tolerance: "MED",
  shared_infrastructure: "NONE",
};

// Helper: highlight the "better" cell (green bold) in spec rows
function SpecRow({
  label,
  valA,
  valB,
  numA,
  numB,
  better,
  rowIndex,
}: {
  label: string;
  valA: string;
  valB: string;
  numA: number | null | undefined;
  numB: number | null | undefined;
  better: "higher" | "lower" | null;
  rowIndex: number;
}) {
  const aWins =
    better === "higher"
      ? numA != null && numB != null && numA > numB
      : better === "lower"
      ? numA != null && numB != null && numA < numB
      : false;
  const bWins =
    better === "higher"
      ? numA != null && numB != null && numB > numA
      : better === "lower"
      ? numA != null && numB != null && numB < numA
      : false;

  return (
    <tr className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}>
      <td className="py-2.5 px-3 text-xs font-medium text-gray-500 w-1/3">{label}</td>
      <td className={`py-2.5 px-3 text-sm text-center ${aWins ? "text-green-700 font-semibold" : "text-gray-700"}`}>
        {valA}
      </td>
      <td className={`py-2.5 px-3 text-sm text-center ${bWins ? "text-green-700 font-semibold" : "text-gray-700"}`}>
        {valB}
      </td>
    </tr>
  );
}

function ComparePageContent() {
  const { trackEvent } = useEventTracking();
  const searchParams = useSearchParams();
  const fromShortlist = searchParams.get("from") === "shortlist";
  const paramA = searchParams.get("a");
  const paramB = searchParams.get("b");

  const [phase, setPhase] = useState<Phase>("options");
  const [regionSelection, setRegionSelection] = useState<RegionSelection>("AUTO");
  const regionResolved = resolveRegion(regionSelection);

  // Routine inputs — filled optionally in "refine" step
  const [hasHomeCharging, setHasHomeCharging] = useState<boolean | null>(null);
  const [homeChargingType, setHomeChargingType] = useState<"L1" | "L2" | "UNKNOWN">("UNKNOWN");
  const [canChargeAtWork, setCanChargeAtWork] = useState<boolean | null>(null);
  const [publicDependency, setPublicDependency] = useState<"RARE" | "SOMETIMES" | "OFTEN" | null>(null);
  const [routinePattern, setRoutinePattern] = useState<"LOCAL" | "MIXED" | "MOTORWAY_HEAVY" | null>(null);
  const [longDayFrequency, setLongDayFrequency] = useState<"RARE" | "MONTHLY" | "WEEKLY" | null>(null);
  const [planningTolerance, setPlanningTolerance] = useState<"LOW" | "MED" | "HIGH" | null>(null);
  const [sharedInfrastructure, setSharedInfrastructure] = useState<"NONE" | "SOME" | "HIGH" | null>(null);
  const [routineRefined, setRoutineRefined] = useState(false);

  // Option inputs
  const [optionA, setOptionA] = useState<OptionInput>({ ...defaultOption });
  const [optionB, setOptionB] = useState<OptionInput>({ ...defaultOption });

  // Vehicle metadata for photo loading (make/model/year separate from label)
  type VehicleMeta = { make?: string; model?: string; year?: number };
  const [metaA, setMetaA] = useState<VehicleMeta>({});
  const [metaB, setMetaB] = useState<VehicleMeta>({});

  // Spec state
  const [specA, setSpecA] = useState<OptionSpec>({ ...defaultSpec });
  const [specB, setSpecB] = useState<OptionSpec>({ ...defaultSpec });
  const [includeSpecs, setIncludeSpecs] = useState(false);

  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // Receipt history + payment token
  const [receiptToken] = useState<string>(() =>
    typeof window !== "undefined" ? getOrCreateReceiptToken() : ""
  );
  const { history, isLoading: historyLoading } = useReceiptHistory(receiptToken);
  const [historyOpenA, setHistoryOpenA] = useState(false);
  const [historyOpenB, setHistoryOpenB] = useState(false);

  // Compare session — created when user submits options; used for Stripe checkout
  const [compareSessionId, setCompareSessionId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Payment status — polls once compareSessionId is set
  const { isUnlocked, paymentsEnabled, freeMode, refetch: refetchPayment } = usePaymentStatus(
    "compare",
    compareSessionId,
    receiptToken
  );

  // Handle ?checkout=success return from Stripe
  const checkoutParam = searchParams.get("checkout");
  const checkoutScenarioId = searchParams.get("scenario_id");
  useEffect(() => {
    if (checkoutParam !== "success" || !checkoutScenarioId) return;
    setCompareSessionId(checkoutScenarioId);
    setPhase("results");
    // Strip params from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("scenario_id");
    url.searchParams.delete("scenario_type");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.toString());
    // Poll until paid status confirmed
    const poll = setInterval(async () => {
      await refetchPayment();
    }, 2000);
    setTimeout(() => clearInterval(poll), 20000);
    return () => clearInterval(poll);
  }, [checkoutParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-derive buckets from specs
  useEffect(() => {
    if (!includeSpecs) return;
    setOptionA(prev => ({
      ...prev,
      battery_bucket: deriveBatteryBucket(specA.range_mi, specA.battery_kwh),
      efficiency_bucket: deriveEfficiencyBucket(specA.efficiency_mi_per_kwh),
      charging_curve_bucket: deriveChargingBucket(specA.dc_fast_kw),
    }));
  }, [specA, includeSpecs]);

  useEffect(() => {
    if (!includeSpecs) return;
    setOptionB(prev => ({
      ...prev,
      battery_bucket: deriveBatteryBucket(specB.range_mi, specB.battery_kwh),
      efficiency_bucket: deriveEfficiencyBucket(specB.efficiency_mi_per_kwh),
      charging_curve_bucket: deriveChargingBucket(specB.dc_fast_kw),
    }));
  }, [specB, includeSpecs]);

  // Track page view
  useEffect(() => {
    trackEvent("compare_started", { region: regionResolved, from_shortlist: fromShortlist });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Shortlist pre-fill — jump straight to results
  useEffect(() => {
    if (!fromShortlist) return;
    const candidates = getShortlist();
    if (candidates.length < 2) return;
    const [a, b] = candidates;
    const toOption = (label: string): OptionInput => ({
      label, body_type_bucket: "UNKNOWN", battery_bucket: "UNKNOWN",
      efficiency_bucket: "UNKNOWN", charging_curve_bucket: "UNKNOWN",
    });
    setOptionA(toOption(a.vehicle_label));
    setOptionB(toOption(b.vehicle_label));
    const compResult = compareOptions({
      region: regionResolved,
      ...DEFAULT_BASE_ROUTINE,
      optionA: toOption(a.vehicle_label),
      optionB: toOption(b.vehicle_label),
    });
    setResult(compResult);
    setPhase("results");
    trackEvent("compare_from_shortlist", { candidates: [a.vehicle_label, b.vehicle_label] });
  }, [fromShortlist]); // eslint-disable-line react-hooks/exhaustive-deps

  // Garage pre-fill — start at options with labels pre-filled
  useEffect(() => {
    if (!paramA || !paramB || fromShortlist) return;
    const toOption = (label: string): OptionInput => ({
      label, body_type_bucket: "UNKNOWN", battery_bucket: "UNKNOWN",
      efficiency_bucket: "UNKNOWN", charging_curve_bucket: "UNKNOWN",
    });
    setOptionA(toOption(paramA));
    setOptionB(toOption(paramB));
    setPhase("options");
    trackEvent("compare_from_garage", { a: paramA, b: paramB });
  }, [paramA, paramB]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track results viewed
  useEffect(() => {
    if (result && phase === "results") {
      trackEvent("compare_completed", { region: regionResolved, routine_refined: routineRefined });
      trackEvent("compare_results_viewed", {
        region: regionResolved,
        fit_signal_a: result.optionA.fit_signal,
        fit_signal_b: result.optionB.fit_signal,
        delta_count: result.routine_delta_bullets.length,
      });
    }
  }, [result, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRoutineComplete =
    hasHomeCharging !== null && canChargeAtWork !== null &&
    publicDependency !== null && routinePattern !== null &&
    longDayFrequency !== null && planningTolerance !== null &&
    sharedInfrastructure !== null;

  // Run comparison with default routine immediately from options step
  const handleOptionsSubmit = async () => {
    const baseRoutine: BaseRoutineInput = {
      region: regionResolved,
      ...DEFAULT_BASE_ROUTINE,
    };
    const comparisonResult = compareOptions({ ...baseRoutine, optionA, optionB });
    setResult(comparisonResult);
    trackEvent("compare_submitted", {
      region: regionResolved,
      include_specs: includeSpecs,
      routine_refined: false,
      option_a_buckets: { body: optionA.body_type_bucket, battery: optionA.battery_bucket, efficiency: optionA.efficiency_bucket, curve: optionA.charging_curve_bucket },
      option_b_buckets: { body: optionB.body_type_bucket, battery: optionB.battery_bucket, efficiency: optionB.efficiency_bucket, curve: optionB.charging_curve_bucket },
    });
    setPhase("results");

    // Create a compare session in DB (needed for Stripe checkout)
    if (!compareSessionId) {
      try {
        const res = await fetch("/api/compare/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anon_id: receiptToken,
            label_a: optionA.label || "Option A",
            label_b: optionB.label || "Option B",
          }),
        });
        const data = await res.json();
        if (data.session_id) setCompareSessionId(data.session_id);
      } catch { /* non-critical — paywall just won't have a session_id */ }
    }
  };

  // Re-run comparison with the user's actual routine
  const handleRoutineRefine = () => {
    if (!isRoutineComplete) return;
    const baseRoutine: BaseRoutineInput = {
      region: regionResolved,
      has_home_charging: hasHomeCharging ?? false,
      home_charging_type: hasHomeCharging ? homeChargingType : undefined,
      can_charge_at_work: canChargeAtWork ?? false,
      public_charging_dependency: publicDependency ?? "SOMETIMES",
      routine_pattern: routinePattern ?? "MIXED",
      long_day_frequency: longDayFrequency ?? "RARE",
      planning_tolerance: planningTolerance ?? "MED",
      shared_infrastructure: sharedInfrastructure ?? "NONE",
    };
    const refined = compareOptions({ ...baseRoutine, optionA, optionB });
    setResult(refined);
    setRoutineRefined(true);
    trackEvent("compare_routine_refined", {
      region: regionResolved,
      has_home_charging: hasHomeCharging,
      public_dependency: publicDependency,
      planning_tolerance: planningTolerance,
    });
    setPhase("results");
  };

  // Stripe checkout for compare unlock
  const handleCompareCheckout = async () => {
    if (!compareSessionId) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    trackEvent("compare_checkout_started", { compare_session_id: compareSessionId });
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_type: "compare",
          scenario_id: compareSessionId,
          anon_id: receiptToken,
          page_source: "compare_page",
        }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      if (data.status === "paid") { await refetchPayment(); return; }
      setCheckoutError(data.error || "Checkout failed. Please try again.");
    } catch {
      setCheckoutError("Connection error. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ─── History selection ────────────────────────────────────────────────────
  const handleHistorySelect = (entry: ReceiptHistoryEntry, isA: boolean) => {
    const make = entry.make ?? "";
    const model = entry.model ?? "";
    const year = entry.year ?? undefined;
    const label = [year, make, model].filter(Boolean).join(" ");
    const bodyType = deriveBodyBucket(make, model);

    if (isA) {
      setOptionA(prev => ({ ...prev, label, body_type_bucket: bodyType }));
      if (entry.price) setSpecA(prev => ({ ...prev, price: entry.price! }));
      setHistoryOpenA(false);
    } else {
      setOptionB(prev => ({ ...prev, label, body_type_bucket: bodyType }));
      if (entry.price) setSpecB(prev => ({ ...prev, price: entry.price! }));
      setHistoryOpenB(false);
    }
  };

  // ─── Option card ─────────────────────────────────────────────────────────
  const renderOptionCard = (
    option: OptionInput,
    setOption: (opt: OptionInput) => void,
    spec: OptionSpec,
    setSpec: (s: OptionSpec) => void,
    title: string,
    isA: boolean
  ) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h3 className="font-bold text-gray-900 text-base">{title}</h3>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Paste a listing URL or description to auto-fill</p>
        <ListingExtractMini
          onExtracted={(extracted) => {
            const newSpec: typeof spec = { ...spec };
            if (extracted.price) newSpec.price = extracted.price;
            if (extracted.range_mi) newSpec.range_mi = extracted.range_mi;
            if (extracted.battery_kwh) newSpec.battery_kwh = extracted.battery_kwh;
            if (extracted.dc_fast_kw) newSpec.dc_fast_kw = extracted.dc_fast_kw;
            if (extracted.efficiency_mi_per_kwh) newSpec.efficiency_mi_per_kwh = extracted.efficiency_mi_per_kwh;
            setSpec(newSpec);

            const batteryBucket = deriveBatteryBucket(extracted.range_mi, extracted.battery_kwh);
            const efficiencyBucket = deriveEfficiencyBucket(extracted.efficiency_mi_per_kwh);
            const chargingBucket = extracted.dc_fast_kw ? deriveChargingBucket(extracted.dc_fast_kw) : option.charging_curve_bucket;
            setOption({
              ...option,
              label: extracted.label,
              body_type_bucket: extracted.bodyType,
              ...(batteryBucket !== "UNKNOWN" && { battery_bucket: batteryBucket }),
              ...(efficiencyBucket !== "UNKNOWN" && { efficiency_bucket: efficiencyBucket }),
              ...(chargingBucket !== "UNKNOWN" && { charging_curve_bucket: chargingBucket }),
            });

            const metaSetter = isA ? setMetaA : setMetaB;
            metaSetter({ make: extracted.make, model: extracted.model, year: extracted.year });
          }}
          placeholder="e.g. cargurus.com/… or paste listing text"
        />
        {history.length > 0 && (
          <button
            onClick={() => isA ? setHistoryOpenA(true) : setHistoryOpenB(true)}
            className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <History className="w-3.5 h-3.5" />
            Or pick from history ({history.length})
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Name (optional)</label>
        <input
          type="text"
          value={option.label || ""}
          onChange={(e) => setOption({ ...option, label: e.target.value })}
          placeholder="e.g., Polestar 2"
          maxLength={30}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Body type</label>
        <select value={option.body_type_bucket} onChange={(e) => setOption({ ...option, body_type_bucket: e.target.value as BodyTypeBucket })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none">
          {(Object.keys(BODY_TYPE_LABELS) as BodyTypeBucket[]).map((key) => (
            <option key={key} value={key}>{BODY_TYPE_LABELS[key]}</option>
          ))}
        </select>
      </div>

      {includeSpecs && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Specs</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Est. range (mi)</label>
              <input type="number" min={0} max={600} placeholder="e.g. 280"
                value={spec.range_mi ?? ""}
                onChange={(e) => setSpec({ ...spec, range_mi: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Battery (kWh)</label>
              <input type="number" min={0} max={200} placeholder="e.g. 82"
                value={spec.battery_kwh ?? ""}
                onChange={(e) => setSpec({ ...spec, battery_kwh: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">DC fast peak (kW)</label>
              <input type="number" min={0} max={400} placeholder="e.g. 150"
                value={spec.dc_fast_kw ?? ""}
                onChange={(e) => setSpec({ ...spec, dc_fast_kw: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Efficiency (mi/kWh)</label>
              <input type="number" min={0} max={10} step={0.1} placeholder="e.g. 3.9"
                value={spec.efficiency_mi_per_kwh ?? ""}
                onChange={(e) => setSpec({ ...spec, efficiency_mi_per_kwh: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Drivetrain</label>
            <div className="flex gap-2">
              {(["FWD", "RWD", "AWD", "UNKNOWN"] as const).map((dt) => (
                <button key={dt} onClick={() => setSpec({ ...spec, drivetrain: dt })}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${spec.drivetrain === dt ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {dt === "UNKNOWN" ? "Not sure" : dt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Listing price ($)</label>
            <input type="number" min={0} placeholder="e.g. 38500"
              value={spec.price ?? ""}
              onChange={(e) => setSpec({ ...spec, price: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-0.5">
            <p className="font-medium mb-1">Auto-derived for engine:</p>
            <p>Battery: <span className="font-semibold">{option.battery_bucket}</span></p>
            <p>Efficiency: <span className="font-semibold">{option.efficiency_bucket}</span></p>
            <p>DC charging: <span className="font-semibold">{option.charging_curve_bucket}</span></p>
          </div>
        </div>
      )}

      {!includeSpecs && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Battery size</label>
            <select value={option.battery_bucket} onChange={(e) => setOption({ ...option, battery_bucket: e.target.value as BatteryBucket })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none">
              {(Object.keys(BATTERY_LABELS) as BatteryBucket[]).map((key) => (
                <option key={key} value={key}>{BATTERY_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Efficiency</label>
            <select value={option.efficiency_bucket} onChange={(e) => setOption({ ...option, efficiency_bucket: e.target.value as EfficiencyBucket })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none">
              {(Object.keys(EFFICIENCY_LABELS) as EfficiencyBucket[]).map((key) => (
                <option key={key} value={key}>{EFFICIENCY_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">DC charging speed</label>
            <select value={option.charging_curve_bucket} onChange={(e) => setOption({ ...option, charging_curve_bucket: e.target.value as ChargingCurveBucket })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none">
              {(Object.keys(CHARGING_CURVE_LABELS) as ChargingCurveBucket[]).map((key) => (
                <option key={key} value={key}>{CHARGING_CURVE_LABELS[key]}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Options phase (STEP 1) ───────────────────────────────────────────────
  const renderOptionsPhase = () => (
    <div className="space-y-5">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Your Two Options</h2>
        <p className="text-gray-500">Paste a listing or enter each EV. Specs are optional but sharpen the results.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {renderOptionCard(optionA, setOptionA, specA, setSpecA, "Option A", true)}
        {renderOptionCard(optionB, setOptionB, specB, setSpecB, "Option B", false)}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeSpecs}
            onChange={(e) => setIncludeSpecs(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">Include spec comparison</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Add range, battery, DC charging speed, and efficiency. Specs auto-set engine buckets and appear as a side-by-side table in results.
            </p>
          </div>
        </label>
      </div>

      {(!optionA.label?.trim() || !optionB.label?.trim()) && (
        <p className="text-sm text-amber-600 text-center">
          Enter a name for both vehicles to compare.
        </p>
      )}

      <button
        onClick={handleOptionsSubmit}
        disabled={!optionA.label?.trim() || !optionB.label?.trim()}
        className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
      >
        Compare <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  // ─── Result card ─────────────────────────────────────────────────────────
  const parseLabelForImage = (label: string) => {
    const yearMatch = label.match(/^(\d{4})\s+(.+)$/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      const rest = yearMatch[2].trim();
      const spaceIdx = rest.indexOf(" ");
      if (spaceIdx > 0) {
        return { year, make: rest.slice(0, spaceIdx), model: rest.slice(spaceIdx + 1) };
      }
      return { year, make: rest, model: undefined };
    }
    const spaceIdx = label.indexOf(" ");
    if (spaceIdx > 0) {
      return { year: undefined, make: label.slice(0, spaceIdx), model: label.slice(spaceIdx + 1) };
    }
    return { year: undefined, make: label, model: undefined };
  };

  const renderResultCard = (fitResult: ComparisonResult["optionA"], fallbackLabel: string) => {
    const label = fitResult.label || fallbackLabel;
    const { year, make, model } = parseLabelForImage(label);
    const signalStyles = {
      GOOD: { badge: "bg-green-100 text-green-800 border-green-200", border: "border-green-200", top: "bg-green-50" },
      CONDITIONAL: { badge: "bg-yellow-100 text-yellow-800 border-yellow-200", border: "border-yellow-200", top: "bg-yellow-50" },
      HIGH_FRICTION: { badge: "bg-red-100 text-red-800 border-red-200", border: "border-red-200", top: "bg-red-50" },
    }[fitResult.fit_signal];

    return (
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${signalStyles.border}`}>
        <div className="relative h-32 bg-gray-100">
          <VehicleImage make={make} model={model} year={year} className="w-full h-full" imgClassName="w-full h-full object-cover" />
          <div className="absolute bottom-2 right-2">
            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${signalStyles.badge}`}>
              {FIT_SIGNAL_LABELS[fitResult.fit_signal]}
            </div>
          </div>
        </div>
        <div className={`px-5 py-3 ${signalStyles.top}`}>
          <h3 className="font-bold text-gray-900 text-base">{label}</h3>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-500 italic">{FADE_LABEL_DISPLAY[fitResult.fade_label]}</p>

          {fitResult.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-700 uppercase mb-2">Works well for your routine</p>
              <ul className="space-y-2">
                {fitResult.strengths.map((s, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 font-bold">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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

          {fitResult.why_not_100.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Why not 100%?</p>
              <ul className="space-y-1">
                {fitResult.why_not_100.map((reason, idx) => (
                  <li key={idx} className="text-xs text-gray-500">• {reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Results phase (STEP 2) ───────────────────────────────────────────────
  const renderResultsPhase = () => {
    if (!result) return null;

    const hasAnySpec = Object.values(specA).some(v => v != null) || Object.values(specB).some(v => v != null);
    const labelA = result.optionA.label || "Option A";
    const labelB = result.optionB.label || "Option B";
    const unlocked = isUnlocked || freeMode || !paymentsEnabled;
    const displayPrice = getDisplayPriceForRegion("999", regionResolved === "UK" ? "UK" : "US");

    const signalBadge = (signal: string) => {
      if (signal === "GOOD") return "bg-green-100 text-green-800 border-green-200";
      if (signal === "CONDITIONAL") return "bg-yellow-100 text-yellow-800 border-yellow-200";
      return "bg-red-100 text-red-800 border-red-200";
    };

    return (
      <div className="space-y-5">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Comparison Results</h2>
          <p className="text-gray-500">
            {routineRefined
              ? "Personalised to your driving routine."
              : "Based on typical usage."}
          </p>
        </div>

        {/* Side-by-side comparison panel — photos + labels + detail columns */}
        {(() => {
          const parsedA = parseLabelForImage(labelA);
          const parsedB = parseLabelForImage(labelB);
          const imgA = { make: metaA.make ?? parsedA.make, model: metaA.model ?? parsedA.model, year: metaA.year ?? parsedA.year };
          const imgB = { make: metaB.make ?? parsedB.make, model: metaB.model ?? parsedB.model, year: metaB.year ?? parsedB.year };

          const renderDetails = (fitResult: ComparisonResult["optionA"]) => (
            <div className="px-4 py-4 space-y-4">
              {fitResult.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-green-700 uppercase mb-2">Works well</p>
                  <ul className="space-y-2">
                    {fitResult.strengths.map((s, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-500 mt-0.5 font-bold flex-shrink-0">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {fitResult.friction_bullets.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Considerations</p>
                  <ul className="space-y-2">
                    {fitResult.friction_bullets.map((b, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {fitResult.why_not_100.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-400 uppercase mb-2">Why not perfect?</p>
                  <ul className="space-y-1">
                    {fitResult.why_not_100.map((r, idx) => (
                      <li key={idx} className="text-xs text-gray-500">• {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );

          return (
            <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-white">
              {/* Photos row */}
              <div className="grid sm:grid-cols-2 grid-cols-1">
                <div className="relative h-48 bg-gray-100 sm:border-r border-b sm:border-b-0 border-gray-200">
                  <VehicleImage {...imgA} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm ${signalBadge(result.optionA.fit_signal)}`}>
                      {FIT_SIGNAL_LABELS[result.optionA.fit_signal]}
                    </span>
                  </div>
                </div>
                <div className="relative h-48 bg-gray-100">
                  <VehicleImage {...imgB} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm ${signalBadge(result.optionB.fit_signal)}`}>
                      {FIT_SIGNAL_LABELS[result.optionB.fit_signal]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Labels row */}
              <div className="grid sm:grid-cols-2 grid-cols-1 border-t border-gray-200">
                <div className="px-4 py-3 sm:border-r border-b sm:border-b-0 border-gray-200">
                  <p className="font-bold text-gray-900 text-sm">{labelA}</p>
                  {unlocked && <p className="text-xs text-gray-500 mt-0.5 italic">{FADE_LABEL_DISPLAY[result.optionA.fade_label]}</p>}
                </div>
                <div className="px-4 py-3">
                  <p className="font-bold text-gray-900 text-sm">{labelB}</p>
                  {unlocked && <p className="text-xs text-gray-500 mt-0.5 italic">{FADE_LABEL_DISPLAY[result.optionB.fade_label]}</p>}
                </div>
              </div>

              {/* Detail columns — unlocked only */}
              {unlocked && (
                <div className="grid sm:grid-cols-2 grid-cols-1 border-t border-gray-200 sm:divide-x divide-gray-200">
                  {renderDetails(result.optionA)}
                  <div className="sm:hidden border-t border-gray-200" />
                  {renderDetails(result.optionB)}
                </div>
              )}
            </div>
          );
        })()}

        {/* Spec table — always visible if user added specs */}
        {includeSpecs && hasAnySpec && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 mb-4">Spec Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 w-1/3">Spec</th>
                    <th className="py-2.5 px-3 text-center text-sm font-semibold text-gray-900">{labelA}</th>
                    <th className="py-2.5 px-3 text-center text-sm font-semibold text-gray-900">{labelB}</th>
                  </tr>
                </thead>
                <tbody>
                  <SpecRow rowIndex={0} label="Est. Range" valA={specA.range_mi ? `~${specA.range_mi} mi` : "—"} valB={specB.range_mi ? `~${specB.range_mi} mi` : "—"} numA={specA.range_mi} numB={specB.range_mi} better="higher" />
                  <SpecRow rowIndex={1} label="Battery" valA={specA.battery_kwh ? `${specA.battery_kwh} kWh` : "—"} valB={specB.battery_kwh ? `${specB.battery_kwh} kWh` : "—"} numA={specA.battery_kwh} numB={specB.battery_kwh} better="higher" />
                  <SpecRow rowIndex={2} label="DC Fast (peak)" valA={specA.dc_fast_kw ? `${specA.dc_fast_kw} kW` : "—"} valB={specB.dc_fast_kw ? `${specB.dc_fast_kw} kW` : "—"} numA={specA.dc_fast_kw} numB={specB.dc_fast_kw} better="higher" />
                  <SpecRow rowIndex={3} label="Efficiency" valA={specA.efficiency_mi_per_kwh ? `${specA.efficiency_mi_per_kwh} mi/kWh` : "—"} valB={specB.efficiency_mi_per_kwh ? `${specB.efficiency_mi_per_kwh} mi/kWh` : "—"} numA={specA.efficiency_mi_per_kwh} numB={specB.efficiency_mi_per_kwh} better="higher" />
                  {(specA.drivetrain || specB.drivetrain) && (
                    <SpecRow rowIndex={4} label="Drivetrain" valA={specA.drivetrain && specA.drivetrain !== "UNKNOWN" ? specA.drivetrain : "—"} valB={specB.drivetrain && specB.drivetrain !== "UNKNOWN" ? specB.drivetrain : "—"} numA={null} numB={null} better={null} />
                  )}
                  {(specA.price || specB.price) && (
                    <SpecRow rowIndex={5} label="Price" valA={specA.price ? `$${specA.price.toLocaleString()}` : "—"} valB={specB.price ? `$${specB.price.toLocaleString()}` : "—"} numA={specA.price} numB={specB.price} better="lower" />
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3">Specs are estimated. Verify before purchasing.</p>
          </div>
        )}

        {/* ── PAYWALL GATE ─────────────────────────────────────── */}
        {!unlocked && (
          <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50 rounded-2xl border-2 border-indigo-200 shadow-sm overflow-hidden">
            {/* Blurred preview of deep analysis */}
            <div className="relative">
              <div className="pointer-events-none select-none blur-sm opacity-60 px-5 pt-5 space-y-3">
                <div className="bg-white rounded-xl border border-blue-100 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Deep Analysis — {labelA}</p>
                  <p className="text-sm text-gray-700">✓ Efficient for city driving — lower battery drain in stop-start</p>
                  <p className="text-sm text-gray-700 mt-1">✓ DC fast charging adequate for occasional road trips</p>
                  <p className="text-sm text-gray-500 mt-1">• Consider range anxiety on 150+ mile days without planning</p>
                </div>
                <div className="bg-white rounded-xl border border-blue-100 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Deep Analysis — {labelB}</p>
                  <p className="text-sm text-gray-700">✓ Higher peak DC charging — faster top-ups on longer trips</p>
                  <p className="text-sm text-gray-700 mt-1">• Larger battery means more to charge overnight with L1</p>
                </div>
                <div className="bg-white rounded-xl border border-blue-100 p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Verdict: What would actually change?</p>
                  <p className="text-sm text-gray-700">→ Daily charging time increases by ~2 hours with L1</p>
                  <p className="text-sm text-gray-700 mt-1">→ Road trip planning effort differs significantly</p>
                </div>
              </div>
              {/* Lock overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
                <Lock className="w-8 h-8 text-indigo-400 opacity-80" />
              </div>
            </div>

            {/* Unlock CTA */}
            <div className="px-5 pb-5 pt-4 border-t border-indigo-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full">OFFO Buyer Pass</span>
                <span className="text-base font-bold text-gray-900">{displayPrice}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Unlock the full comparison</p>
              <ul className="space-y-1.5 mb-4">
                {[
                  { icon: BarChart2, text: "Deep-dive analysis for both vehicles" },
                  { icon: MessageSquare, text: "Verdict: what actually changes for your routine" },
                  { icon: ShieldCheck, text: "Personalise to your driving habits" },
                  { icon: Copy, text: "Copy & share full takeaway" },
                ].map(({ icon: Icon, text }, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleCompareCheckout}
                disabled={checkoutLoading || !compareSessionId}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-60 shadow-sm"
              >
                {checkoutLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Redirecting...</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" />Unlock Full Analysis — {displayPrice}</>
                )}
              </button>
              {checkoutError && <p className="text-xs text-red-600 mt-2">{checkoutError}</p>}
              {!compareSessionId && <p className="text-xs text-gray-400 mt-2 text-center">Preparing checkout…</p>}
            </div>
          </div>
        )}

        {/* ── UNLOCKED CONTENT ─────────────────────────────────── */}
        {unlocked && (
          <>
            {/* Delta */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-4">What would actually change?</h3>
              <ul className="space-y-3">
                {result.routine_delta_bullets.map((bullet, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start gap-2.5">
                    <span className="text-blue-500 mt-0.5 font-bold flex-shrink-0">→</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Neutral Closer */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl border border-blue-100 p-5 text-center">
              <p className="text-sm text-gray-600 italic">{result.neutral_closer}</p>
            </div>

            {/* Personalise by routine */}
            {!routineRefined && (
              <button
                onClick={() => setPhase("routine")}
                className="w-full flex items-center justify-between px-5 py-4 bg-white rounded-2xl border-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all"
              >
                <div className="text-left">
                  <p className="font-semibold text-sm">Personalise to your routine</p>
                  <p className="text-xs text-blue-500 mt-0.5">Tell us how you drive — we&apos;ll re-score both options for your actual situation</p>
                </div>
                <ChevronDown className="w-5 h-5 shrink-0" />
              </button>
            )}

            {/* Copy takeaway */}
            <button
              onClick={async () => {
                const specLines: string[] = [];
                if (includeSpecs && hasAnySpec) {
                  specLines.push("", "Specs:");
                  if (specA.range_mi || specB.range_mi) specLines.push(`  Range: ${specA.range_mi ? `~${specA.range_mi} mi` : "—"} vs ${specB.range_mi ? `~${specB.range_mi} mi` : "—"}`);
                  if (specA.battery_kwh || specB.battery_kwh) specLines.push(`  Battery: ${specA.battery_kwh ?? "—"} kWh vs ${specB.battery_kwh ?? "—"} kWh`);
                  if (specA.dc_fast_kw || specB.dc_fast_kw) specLines.push(`  DC Fast: ${specA.dc_fast_kw ?? "—"} kW vs ${specB.dc_fast_kw ?? "—"} kW`);
                }
                const takeaway = [
                  `Comparing ${labelA} vs ${labelB}:`,
                  ...specLines,
                  "",
                  `${labelA}: ${FIT_SIGNAL_LABELS[result.optionA.fit_signal]} — ${FADE_LABEL_DISPLAY[result.optionA.fade_label]}`,
                  `${labelB}: ${FIT_SIGNAL_LABELS[result.optionB.fit_signal]} — ${FADE_LABEL_DISPLAY[result.optionB.fade_label]}`,
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
                  trackEvent("compare_copy_takeaway_clicked", { region: regionResolved, fit_signal_a: result.optionA.fit_signal, fit_signal_b: result.optionB.fit_signal });
                } catch (err) {
                  console.error("Copy failed:", err);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-blue-400 transition-all"
            >
              {showCopySuccess ? (
                <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-600">Copied!</span></>
              ) : (
                <><Copy className="w-4 h-4" /><span>Copy key takeaway</span></>
              )}
            </button>
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setPhase("options")}
            className="flex-1 py-3.5 rounded-xl font-medium border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Edit options
          </button>
          <button
            onClick={() => { setPhase("options"); setResult(null); setRoutineRefined(false); setCompareSessionId(null); trackEvent("compare_restart_clicked", { region: regionResolved }); }}
            className="flex-1 py-3.5 rounded-xl font-medium border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
          >
            New comparison
          </button>
        </div>
      </div>
    );
  };

  // ─── Routine phase (STEP 3 — optional) ───────────────────────────────────
  const renderRoutinePhase = () => (
    <div className="space-y-5">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Your Driving Routine</h2>
        <p className="text-gray-500">Answer these to personalise the comparison to your actual situation.</p>
      </div>

      {/* Region */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Your region</p>
            <p className="text-xs text-gray-500 mt-0.5">{regionResolved === "UK" ? "United Kingdom" : "United States"}</p>
          </div>
          <select value={regionSelection} onChange={(e) => setRegionSelection(e.target.value as RegionSelection)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:border-blue-600 focus:outline-none">
            <option value="AUTO">Auto-detect</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
          </select>
        </div>
      </div>

      {/* Q1: Home Charging */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-900">Do you have dedicated home charging?</label>
        <div className="grid grid-cols-2 gap-3">
          {[{ value: true, label: "Yes" }, { value: false, label: "No" }].map((opt) => (
            <button key={String(opt.value)} onClick={() => setHasHomeCharging(opt.value)} className={`p-3 rounded-xl border-2 text-left font-medium text-sm transition-all ${hasHomeCharging === opt.value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:border-blue-300"}`}>{opt.label}</button>
          ))}
        </div>
        {hasHomeCharging && (
          <div className="pt-2 pl-4 border-l-2 border-blue-200">
            <label className="block text-xs font-medium text-gray-600 mb-2">What type?</label>
            <div className="flex gap-2">
              {(["L1", "L2", "UNKNOWN"] as const).map((type) => (
                <button key={type} onClick={() => setHomeChargingType(type)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${homeChargingType === type ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {type === "UNKNOWN" ? "Not sure" : type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Q2: Work Charging */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-900">Can you charge at work?</label>
        <div className="grid grid-cols-2 gap-3">
          {[{ value: true, label: "Yes" }, { value: false, label: "No" }].map((opt) => (
            <button key={String(opt.value)} onClick={() => setCanChargeAtWork(opt.value)} className={`p-3 rounded-xl border-2 text-left font-medium text-sm transition-all ${canChargeAtWork === opt.value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:border-blue-300"}`}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Q3: Public Dependency */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-900">How often would you rely on public charging?</label>
        <div className="space-y-2">
          {(["RARE", "SOMETIMES", "OFTEN"] as const).map((opt) => (
            <button key={opt} onClick={() => setPublicDependency(opt)} className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${publicDependency === opt ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:border-blue-300"}`}>
              {opt === "RARE" && "Rarely — road trips only"}{opt === "SOMETIMES" && "Sometimes — roughly weekly"}{opt === "OFTEN" && "Often — multiple times per week"}
            </button>
          ))}
        </div>
      </div>

      {/* Q4: Routine Pattern */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-900">What&apos;s your typical driving pattern?</label>
        <div className="space-y-2">
          {(["LOCAL", "MIXED", "MOTORWAY_HEAVY"] as const).map((opt) => (
            <button key={opt} onClick={() => setRoutinePattern(opt)} className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${routinePattern === opt ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:border-blue-300"}`}>
              {opt === "LOCAL" && "Mostly local / city driving"}{opt === "MIXED" && "Mix of local and highway"}{opt === "MOTORWAY_HEAVY" && (regionResolved === "UK" ? "Mostly motorway" : "Mostly highway")}
            </button>
          ))}
        </div>
      </div>

      {/* Q5: Long Day Frequency */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-900">How often do you have long driving days (100+ miles)?</label>
        <div className="space-y-2">
          {(["RARE", "MONTHLY", "WEEKLY"] as const).map((opt) => (
            <button key={opt} onClick={() => setLongDayFrequency(opt)} className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${longDayFrequency === opt ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:border-blue-300"}`}>
              {opt === "RARE" && "Rarely — a few times a year"}{opt === "MONTHLY" && "Monthly"}{opt === "WEEKLY" && "Weekly or more"}
            </button>
          ))}
        </div>
      </div>

      {/* Q6: Planning Tolerance */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-900">How do you feel about planning charging stops?</label>
        <div className="space-y-2">
          {(["LOW", "MED", "HIGH"] as const).map((opt) => (
            <button key={opt} onClick={() => setPlanningTolerance(opt)} className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${planningTolerance === opt ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:border-blue-300"}`}>
              {opt === "LOW" && "I prefer not to think about it"}{opt === "MED" && "I don't mind some planning"}{opt === "HIGH" && "I'm comfortable planning ahead"}
            </button>
          ))}
        </div>
      </div>

      {/* Q7: Shared Infrastructure */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-900">Would you share charging access with others?</label>
        <div className="space-y-2">
          {(["NONE", "SOME", "HIGH"] as const).map((opt) => (
            <button key={opt} onClick={() => setSharedInfrastructure(opt)} className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${sharedInfrastructure === opt ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:border-blue-300"}`}>
              {opt === "NONE" && "No — dedicated charger for me"}{opt === "SOME" && "Sometimes — shared with household"}{opt === "HIGH" && "Yes — apartment or shared parking"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={() => setPhase("results")} className="flex-1 py-3.5 rounded-xl font-medium border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
          <ChevronUp className="w-4 h-4" /> Back to results
        </button>
        <button
          onClick={handleRoutineRefine}
          disabled={!isRoutineComplete}
          className={`flex-1 py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${isRoutineComplete ? "bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-md" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
        >
          Re-score for my routine <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Step indicator: options=1, results=2, routine=3 (optional)
  const stepLabels = ["Two Options", "Results", "Refine Routine"];
  const stepPhases: Phase[] = ["options", "results", "routine"];
  const currentStepIdx = stepPhases.indexOf(phase);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      {/* Hero banner */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-10 md:py-14 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <GitCompareArrows className="w-4 h-4" />
            Side-by-side EV comparison
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Compare Two EVs</h1>
          <p className="text-blue-100 text-base md:text-lg max-w-xl mx-auto">
            Enter two options, get an instant comparison. Optionally personalise it to your driving routine.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="border-b border-gray-100 bg-white sticky top-16 z-30">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex">
            {stepPhases.map((p, idx) => (
              <div key={p} className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors border-b-2 ${
                phase === p
                  ? "border-blue-600 text-blue-600"
                  : idx < currentStepIdx
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-400"
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 text-xs font-bold ${
                  phase === p ? "bg-blue-600 text-white" : idx < currentStepIdx ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
                }`}>
                  {idx < currentStepIdx ? "✓" : idx + 1}
                </div>
                <span className="hidden sm:block">{stepLabels[idx]}</span>
                {idx === 2 && <span className="hidden sm:block text-[10px] text-gray-400 -mt-0.5">optional</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            <motion.div key={phase} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              {phase === "options" && renderOptionsPhase()}
              {phase === "results" && renderResultsPhase()}
              {phase === "routine" && renderRoutinePhase()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <Footer />

      {/* OFFO Chat — collapsible AI assistant, appears 8s after results load */}
      {result && compareSessionId && receiptToken && (
        <OFfoChat
          scenarioType="compare"
          scenarioId={compareSessionId}
          sessionId={receiptToken}
          context={{
            comparison_label_a: optionA.label || "Option A",
            comparison_label_b: optionB.label || "Option B",
            winner_signal: result.optionA.fit_signal && result.optionB.fit_signal
              ? `${optionA.label || "A"}: ${result.optionA.fit_signal} | ${optionB.label || "B"}: ${result.optionB.fit_signal}`
              : undefined,
          }}
          paymentsEnabled={paymentsEnabled}
          freeMode={freeMode}
          trackEvent={trackEvent}
        />
      )}

      <ReceiptHistoryDrawer
        isOpen={historyOpenA}
        onClose={() => setHistoryOpenA(false)}
        history={history}
        onSelect={(entry) => handleHistorySelect(entry, true)}
        onClear={() => {}}
        isLoading={historyLoading}
      />
      <ReceiptHistoryDrawer
        isOpen={historyOpenB}
        onClose={() => setHistoryOpenB(false)}
        history={history}
        onSelect={(entry) => handleHistorySelect(entry, false)}
        onClear={() => {}}
        isLoading={historyLoading}
      />
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <ComparePageContent />
    </Suspense>
  );
}
