"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Copy, CheckCircle, GitCompareArrows, History, ChevronDown, ChevronUp, Lock, Loader2, ShieldCheck, BarChart2, MessageSquare } from "lucide-react";
import VehicleImage from "@/components/VehicleImage";
import ListingExtractMini from "@/components/compare/ListingExtractMini";
import ReceiptHistoryDrawer from "@/components/receipt/ReceiptHistoryDrawer";
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
import { getCarGurusUrl } from "@/lib/cargurus-links";

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
    <tr className={rowIndex % 2 === 0 ? "bg-[#161b22]" : "bg-[#0d1117]"}>
      <td className="py-2.5 px-3 text-xs font-medium text-white/50 w-1/3">{label}</td>
      <td className={`py-2.5 px-3 text-sm text-center ${aWins ? "text-[#00d97e] font-semibold" : "text-white/70"}`}>
        {valA}
      </td>
      <td className={`py-2.5 px-3 text-sm text-center ${bWins ? "text-[#00d97e] font-semibold" : "text-white/70"}`}>
        {valB}
      </td>
    </tr>
  );
}

// ── TCO + DEPRECIATION HELPERS ──────────────────────────────────────────────

function formatCurrency(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function calcAnnualChargingCost(
  efficiency_mi_per_kwh: number | null | undefined,
  annualMiles = 12_000,
  centsPerKwh = 16
): number {
  const eff = efficiency_mi_per_kwh ?? 3.5;
  return (annualMiles / eff) * (centsPerKwh / 100);
}

function calcAnnualMaintenance(): number {
  return 900;
}

function calcAnnualInsuranceRange(): [number, number] {
  return [1_800, 2_400];
}

const TAX_CREDIT_TABLE: Record<string, number> = {
  "chevrolet equinox ev": 7_500,
  "chevrolet blazer ev": 7_500,
  "chevrolet silverado ev": 7_500,
  "ford f-150 lightning": 7_500,
  "ford escape plug-in hybrid": 3_750,
  "jeep wrangler 4xe": 3_750,
  "jeep grand cherokee 4xe": 3_750,
  "volkswagen id.4": 7_500,
  "rivian r1t": 3_750,
  "rivian r1s": 3_750,
};
const TESLA_CREDIT_TABLE: Record<string, number> = {
  "model 3": 7_500,
  "model y": 7_500,
};

function lookupTaxCredit(label: string): number {
  const lower = label.toLowerCase();
  if (lower.includes("tesla")) {
    for (const [model, credit] of Object.entries(TESLA_CREDIT_TABLE)) {
      if (lower.includes(model)) return credit;
    }
    return 0;
  }
  for (const [key, credit] of Object.entries(TAX_CREDIT_TABLE)) {
    if (lower.includes(key)) return credit;
  }
  return 0;
}

const DEPRECIATION_TABLE: Record<string, { yr3: number; yr5: number }> = {
  tesla:      { yr3: 0.55, yr5: 0.42 },
  rivian:     { yr3: 0.52, yr5: 0.40 },
  ford:       { yr3: 0.48, yr5: 0.37 },
  chevrolet:  { yr3: 0.45, yr5: 0.35 },
  gmc:        { yr3: 0.45, yr5: 0.35 },
  volkswagen: { yr3: 0.43, yr5: 0.33 },
  hyundai:    { yr3: 0.43, yr5: 0.33 },
  kia:        { yr3: 0.43, yr5: 0.33 },
  nissan:     { yr3: 0.38, yr5: 0.28 },
  default:    { yr3: 0.44, yr5: 0.34 },
};

function getDepreciationRate(label: string): { yr3: number; yr5: number } {
  const lower = label.toLowerCase();
  for (const [make, rate] of Object.entries(DEPRECIATION_TABLE)) {
    if (make !== "default" && lower.includes(make)) return rate;
  }
  return DEPRECIATION_TABLE.default;
}

// ── ACTIONABLE VERDICT BUILDER ───────────────────────────────────────────────

interface VerdictResult {
  title: string;
  body: string;
  winner: "A" | "B" | null;
}

function buildVerdict(
  result: import("@/lib/comparison-types").ComparisonResult,
  labelA: string,
  labelB: string,
  specA: import("@/lib/comparison-types").OptionSpec,
  specB: import("@/lib/comparison-types").OptionSpec,
  priceA: number | null,
  priceB: null | number,
  total5A: number | null,
  total5B: number | null,
  tcoWinner: string | null,
  routineRefined: boolean,
  routinePattern: string | null,
  longDayFrequency: string | null
): VerdictResult {
  const rangeA = specA.range_mi ? Math.round(specA.range_mi * 0.87) : null;
  const rangeB = specB.range_mi ? Math.round(specB.range_mi * 0.87) : null;
  const ctA = (specA.battery_kwh && specA.dc_fast_kw)
    ? Math.round(0.7 * specA.battery_kwh / specA.dc_fast_kw * 60) : null;
  const ctB = (specB.battery_kwh && specB.dc_fast_kw)
    ? Math.round(0.7 * specB.battery_kwh / specB.dc_fast_kw * 60) : null;

  // Rule 1: Value for money — both GOOD, prices differ >10% and TCO winner exists
  if (
    result.optionA.fit_signal === "GOOD" &&
    result.optionB.fit_signal === "GOOD" &&
    priceA != null && priceB != null &&
    tcoWinner && tcoWinner !== "TIE" &&
    total5A != null && total5B != null
  ) {
    const priceDiff = Math.abs(priceA - priceB);
    const cheaperPrice = Math.min(priceA, priceB);
    if (priceDiff / cheaperPrice > 0.10) {
      const cheaper = tcoWinner === "A" ? labelA : labelB;
      const saving = Math.abs(total5A - total5B);
      const rangeDiff = rangeA != null && rangeB != null ? Math.abs(rangeA - rangeB) : null;
      const rangeLine = rangeDiff != null && rangeDiff < 40 ? ", similar real-world range" : "";
      return {
        title: `Best value: ${cheaper} saves ${formatCurrency(saving)} over 5 years${rangeLine}`,
        body: "Based on purchase price, charging costs, maintenance, and insurance estimates.",
        winner: tcoWinner as "A" | "B",
      };
    }
  }

  // Rule 2: Long-trip advantage — range differs ≥50 mi and user does long days
  if (
    rangeA != null && rangeB != null &&
    Math.abs(rangeA - rangeB) >= 50 &&
    (longDayFrequency === "WEEKLY" || longDayFrequency === "MONTHLY" || routinePattern === "MOTORWAY_HEAVY")
  ) {
    const biggerIsA = rangeA > rangeB;
    const bigger = biggerIsA ? labelA : labelB;
    const diff = Math.abs(rangeA - rangeB);
    const ctDiff = ctA != null && ctB != null ? Math.abs(ctA - ctB) : null;
    const chargeLine = ctDiff ? ` and charges ~${ctDiff} min faster 10→80%` : "";
    return {
      title: `Best for long trips: ${bigger} adds ~${diff} mi real-world range${chargeLine}`,
      body: "Extra range matters most given your long-day driving pattern.",
      winner: biggerIsA ? "A" : "B",
    };
  }

  // Rule 3: Charging speed advantage — DC fast differs ≥50 kW, motorway-heavy
  if (
    specA.dc_fast_kw != null && specB.dc_fast_kw != null &&
    Math.abs(specA.dc_fast_kw - specB.dc_fast_kw) >= 50 &&
    routinePattern === "MOTORWAY_HEAVY"
  ) {
    const fasterIsA = specA.dc_fast_kw > specB.dc_fast_kw;
    const faster = fasterIsA ? labelA : labelB;
    const ctDiff = ctA != null && ctB != null ? Math.abs(ctA - ctB) : null;
    const timeStr = ctDiff ? `~${ctDiff} min` : "significantly";
    return {
      title: `Best for road trips: ${faster} charges 10→80% ${timeStr} faster`,
      body: "Faster DC charging reduces stop time on longer motorway journeys.",
      winner: fasterIsA ? "A" : "B",
    };
  }

  // Rule 4: Clear fit mismatch
  const sigA = result.optionA.fit_signal;
  const sigB = result.optionB.fit_signal;
  if (sigA !== sigB) {
    const aIsBetter = sigA === "GOOD" || (sigA === "CONDITIONAL" && sigB === "HIGH_FRICTION");
    const better = aIsBetter ? labelA : labelB;
    const worse = aIsBetter ? labelB : labelA;
    return {
      title: `Clear choice: ${better} fits your routine`,
      body: `${worse} has friction points worth reviewing before committing.`,
      winner: aIsBetter ? "A" : "B",
    };
  }

  // Rule 5: City efficiency advantage
  if (
    specA.efficiency_mi_per_kwh != null && specB.efficiency_mi_per_kwh != null &&
    Math.abs(specA.efficiency_mi_per_kwh - specB.efficiency_mi_per_kwh) >= 0.4 &&
    routinePattern === "LOCAL"
  ) {
    const effA = specA.efficiency_mi_per_kwh;
    const effB = specB.efficiency_mi_per_kwh;
    const moreEfficientIsA = effA > effB;
    const better = moreEfficientIsA ? labelA : labelB;
    // kWh per 100 mi difference
    const kwh100A = 100 / effA;
    const kwh100B = 100 / effB;
    const kwh100Diff = Math.round(Math.abs(kwh100A - kwh100B) * 10) / 10;
    return {
      title: `Most efficient for your commute: ${better}`,
      body: `Uses ~${kwh100Diff} kWh less per 100 mi — meaningful savings for mostly local driving.`,
      winner: moreEfficientIsA ? "A" : "B",
    };
  }

  // Fallback: use engine's neutral closer
  return {
    title: result.neutral_closer,
    body: "",
    winner: null,
  };
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

    // Build partial spec from history entry
    const specUpdate: Partial<OptionSpec> = {};
    if (entry.price) specUpdate.price = entry.price;

    // Derive buckets from available spec data
    const batteryBucket = deriveBatteryBucket(specUpdate.range_mi, specUpdate.battery_kwh);
    const efficiencyBucket = deriveEfficiencyBucket(specUpdate.efficiency_mi_per_kwh);
    const chargingBucket = specUpdate.dc_fast_kw ? deriveChargingBucket(specUpdate.dc_fast_kw) : "UNKNOWN" as const;

    if (isA) {
      setOptionA(prev => ({
        ...prev,
        label,
        body_type_bucket: bodyType,
        ...(batteryBucket !== "UNKNOWN" && { battery_bucket: batteryBucket }),
        ...(efficiencyBucket !== "UNKNOWN" && { efficiency_bucket: efficiencyBucket }),
        ...(chargingBucket !== "UNKNOWN" && { charging_curve_bucket: chargingBucket }),
      }));
      setSpecA(prev => ({ ...prev, ...specUpdate }));
      setMetaA({ make: make || undefined, model: model || undefined, year });
      setHistoryOpenA(false);
    } else {
      setOptionB(prev => ({
        ...prev,
        label,
        body_type_bucket: bodyType,
        ...(batteryBucket !== "UNKNOWN" && { battery_bucket: batteryBucket }),
        ...(efficiencyBucket !== "UNKNOWN" && { efficiency_bucket: efficiencyBucket }),
        ...(chargingBucket !== "UNKNOWN" && { charging_curve_bucket: chargingBucket }),
      }));
      setSpecB(prev => ({ ...prev, ...specUpdate }));
      setMetaB({ make: make || undefined, model: model || undefined, year });
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
    <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-5 space-y-4">
      <h3 className="font-bold text-white text-base">{title}</h3>

      <div>
        <p className="text-xs font-medium text-white/40 mb-1.5">Paste a listing URL or description to auto-fill</p>
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
          <div className="mt-3">
            <p className="text-xs font-medium text-white/40 uppercase mb-1.5">Your saved listings</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {history.slice(0, 5).map((entry) => {
                const entryLabel = [entry.year, entry.make, entry.model].filter(Boolean).join(" ");
                const verdictColor = entry.verdict === "GREEN"
                  ? "border-[#00d97e]/30 bg-[#00d97e]/[0.06] hover:bg-[#00d97e]/[0.10]"
                  : entry.verdict === "YELLOW"
                  ? "border-yellow-500/30 bg-yellow-500/[0.06] hover:bg-yellow-500/10"
                  : "border-red-500/30 bg-red-500/[0.06]0/[0.06] hover:bg-red-500/[0.06]0/10";
                return (
                  <button
                    key={entry.receipt_id}
                    onClick={() => handleHistorySelect(entry, isA)}
                    className={`shrink-0 border rounded-xl px-3 py-2 text-left min-w-[130px] max-w-[160px] transition-shadow hover:shadow-md ${verdictColor}`}
                  >
                    <p className="text-xs font-semibold text-white/80 truncate">{entryLabel || "Unknown"}</p>
                    {entry.price && <p className="text-xs text-white/50">${entry.price.toLocaleString()}</p>}
                    {(entry.receipt as { mileage?: number })?.mileage != null && (
                      <p className="text-xs text-white/40">{(entry.receipt as { mileage?: number }).mileage!.toLocaleString()} mi</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-white/70 mb-1">Name (optional)</label>
        <input
          type="text"
          value={option.label || ""}
          onChange={(e) => setOption({ ...option, label: e.target.value })}
          placeholder="e.g., Polestar 2"
          maxLength={30}
          className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:border-[#00d97e]/50 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-white/70 mb-1">Body type</label>
        <select value={option.body_type_bucket} onChange={(e) => setOption({ ...option, body_type_bucket: e.target.value as BodyTypeBucket })} className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:border-[#00d97e]/50 focus:outline-none">
          {(Object.keys(BODY_TYPE_LABELS) as BodyTypeBucket[]).map((key) => (
            <option key={key} value={key}>{BODY_TYPE_LABELS[key]}</option>
          ))}
        </select>
      </div>

      {includeSpecs && (
        <div className="space-y-3 pt-2 border-t border-white/[0.06]">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">Specs</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Est. range (mi)</label>
              <input type="number" min={0} max={600} placeholder="e.g. 280"
                value={spec.range_mi ?? ""}
                onChange={(e) => setSpec({ ...spec, range_mi: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:border-[#00d97e]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Battery (kWh)</label>
              <input type="number" min={0} max={200} placeholder="e.g. 82"
                value={spec.battery_kwh ?? ""}
                onChange={(e) => setSpec({ ...spec, battery_kwh: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:border-[#00d97e]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">DC fast peak (kW)</label>
              <input type="number" min={0} max={400} placeholder="e.g. 150"
                value={spec.dc_fast_kw ?? ""}
                onChange={(e) => setSpec({ ...spec, dc_fast_kw: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:border-[#00d97e]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Efficiency (mi/kWh)</label>
              <input type="number" min={0} max={10} step={0.1} placeholder="e.g. 3.9"
                value={spec.efficiency_mi_per_kwh ?? ""}
                onChange={(e) => setSpec({ ...spec, efficiency_mi_per_kwh: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:border-[#00d97e]/50 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">Drivetrain</label>
            <div className="flex gap-2">
              {(["FWD", "RWD", "AWD", "UNKNOWN"] as const).map((dt) => (
                <button key={dt} onClick={() => setSpec({ ...spec, drivetrain: dt })}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${spec.drivetrain === dt ? "bg-[#00d97e] text-[#0d1117]" : "bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"}`}>
                  {dt === "UNKNOWN" ? "Not sure" : dt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Listing price ($)</label>
            <input type="number" min={0} placeholder="e.g. 38500"
              value={spec.price ?? ""}
              onChange={(e) => setSpec({ ...spec, price: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:border-[#00d97e]/50 focus:outline-none"
            />
          </div>
          <div className="bg-[#00d97e]/[0.06] rounded-xl p-3 text-xs text-[#00d97e]/80 space-y-0.5">
            <p className="font-medium mb-1">Auto-derived for engine:</p>
            <p>Battery: <span className="font-semibold">{option.battery_bucket}</span></p>
            <p>Efficiency: <span className="font-semibold">{option.efficiency_bucket}</span></p>
            <p>DC charging: <span className="font-semibold">{option.charging_curve_bucket}</span></p>
          </div>
        </div>
      )}

      {!includeSpecs && (
        <div className="space-y-3 pt-2 border-t border-white/[0.06]">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Battery size</label>
            <select value={option.battery_bucket} onChange={(e) => setOption({ ...option, battery_bucket: e.target.value as BatteryBucket })} className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:border-[#00d97e]/50 focus:outline-none">
              {(Object.keys(BATTERY_LABELS) as BatteryBucket[]).map((key) => (
                <option key={key} value={key}>{BATTERY_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Efficiency</label>
            <select value={option.efficiency_bucket} onChange={(e) => setOption({ ...option, efficiency_bucket: e.target.value as EfficiencyBucket })} className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:border-[#00d97e]/50 focus:outline-none">
              {(Object.keys(EFFICIENCY_LABELS) as EfficiencyBucket[]).map((key) => (
                <option key={key} value={key}>{EFFICIENCY_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">DC charging speed</label>
            <select value={option.charging_curve_bucket} onChange={(e) => setOption({ ...option, charging_curve_bucket: e.target.value as ChargingCurveBucket })} className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:border-[#00d97e]/50 focus:outline-none">
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
        <h2 className="text-2xl font-bold text-white mb-1">Your Two Options</h2>
        <p className="text-white/50">Paste a listing or enter each EV. Specs are optional but sharpen the results.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {renderOptionCard(optionA, setOptionA, specA, setSpecA, "Option A", true)}
        {renderOptionCard(optionB, setOptionB, specB, setSpecB, "Option B", false)}
      </div>

      <div className="bg-[#161b22] rounded-2xl border border-white/[0.06] p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeSpecs}
            onChange={(e) => setIncludeSpecs(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0"
          />
          <div>
            <p className="text-sm font-semibold text-white">Include spec comparison</p>
            <p className="text-sm text-white/50 mt-0.5">
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
        className="w-full py-4 rounded-xl font-semibold bg-[#00d97e] text-[#0d1117] hover:bg-[#00c970] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
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
      GOOD: { badge: "bg-[#00d97e]/10 text-[#00d97e] border-[#00d97e]/20", border: "border-[#00d97e]/20", top: "bg-[#00d97e]/[0.06]" },
      CONDITIONAL: { badge: "bg-yellow-500/[0.06]0/10 text-yellow-400 border-yellow-500/20", border: "border-yellow-500/20", top: "bg-yellow-500/[0.06]" },
      HIGH_FRICTION: { badge: "bg-red-500/[0.06]0/10 text-red-400 border-red-500/20", border: "border-red-500/20", top: "bg-red-500/[0.06]" },
    }[fitResult.fit_signal];

    return (
      <div className={`bg-[#161b22] rounded-2xl border overflow-hidden ${signalStyles.border}`}>
        <div className="relative h-32 bg-white/[0.04]">
          <VehicleImage make={make} model={model} year={year} className="w-full h-full" imgClassName="w-full h-full object-cover" />
          <div className="absolute bottom-2 right-2">
            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${signalStyles.badge}`}>
              {FIT_SIGNAL_LABELS[fitResult.fit_signal]}
            </div>
          </div>
        </div>
        <div className={`px-5 py-3 ${signalStyles.top}`}>
          <h3 className="font-bold text-white text-base">{label}</h3>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-white/50 italic">{FADE_LABEL_DISPLAY[fitResult.fade_label]}</p>

          {fitResult.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#00d97e] uppercase mb-2">Works well for your routine</p>
              <ul className="space-y-2">
                {fitResult.strengths.map((s, idx) => (
                  <li key={idx} className="text-sm text-white/70 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 font-bold">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fitResult.friction_bullets.length > 0 && (
            <div>
              <p className="text-xs font-medium text-white/50 uppercase mb-2">Key considerations</p>
              <ul className="space-y-2">
                {fitResult.friction_bullets.map((bullet, idx) => (
                  <li key={idx} className="text-sm text-white/70 flex items-start gap-2">
                    <span className="text-[#00d97e] mt-0.5">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fitResult.why_not_100.length > 0 && (
            <div className="pt-3 border-t border-white/[0.06]">
              <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">Why not 100%?</p>
              <ul className="space-y-1">
                {fitResult.why_not_100.map((reason, idx) => (
                  <li key={idx} className="text-xs text-white/50">• {reason}</li>
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
    const displayPrice = getDisplayPriceForRegion("499", regionResolved === "UK" ? "UK" : "US");

    // Real-world context (client-side formulas, no API)
    const isColdClimate = regionResolved === "UK";
    const chargeTimeA = (specA.battery_kwh && specA.dc_fast_kw)
      ? Math.round(0.7 * specA.battery_kwh / specA.dc_fast_kw * 60) : null;
    const chargeTimeB = (specB.battery_kwh && specB.dc_fast_kw)
      ? Math.round(0.7 * specB.battery_kwh / specB.dc_fast_kw * 60) : null;
    const realWorldRangeA = specA.range_mi ? Math.round(specA.range_mi * 0.87) : null;
    const realWorldRangeB = specB.range_mi ? Math.round(specB.range_mi * 0.87) : null;
    const coldRangeA = (isColdClimate && realWorldRangeA) ? Math.round(realWorldRangeA * 0.70) : null;
    const coldRangeB = (isColdClimate && realWorldRangeB) ? Math.round(realWorldRangeB * 0.70) : null;

    // 5-Year TCO computations
    const priceA = specA.price ?? null;
    const priceB = specB.price ?? null;
    const taxCreditA = lookupTaxCredit(labelA);
    const taxCreditB = lookupTaxCredit(labelB);
    const annualChargeA = calcAnnualChargingCost(specA.efficiency_mi_per_kwh);
    const annualChargeB = calcAnnualChargingCost(specB.efficiency_mi_per_kwh);
    const annualMaint = calcAnnualMaintenance();
    const [insLow, insHigh] = calcAnnualInsuranceRange();
    const depRateA = getDepreciationRate(labelA);
    const depRateB = getDepreciationRate(labelB);
    const yr3ValueA = priceA ? Math.round(priceA * depRateA.yr3) : null;
    const yr5ValueA = priceA ? Math.round(priceA * depRateA.yr5) : null;
    const yr3ValueB = priceB ? Math.round(priceB * depRateB.yr3) : null;
    const yr5ValueB = priceB ? Math.round(priceB * depRateB.yr5) : null;
    const midIns = (insLow + insHigh) / 2;
    const total5A = priceA != null
      ? priceA - taxCreditA + annualChargeA * 5 + annualMaint * 5 + midIns * 5
      : null;
    const total5B = priceB != null
      ? priceB - taxCreditB + annualChargeB * 5 + annualMaint * 5 + midIns * 5
      : null;
    const showTco = priceA != null || priceB != null;
    const tcoWinner = total5A != null && total5B != null
      ? total5A < total5B ? "A" : total5B < total5A ? "B" : "TIE"
      : null;

    const signalBadge = (signal: string) => {
      if (signal === "GOOD") return "bg-[#00d97e]/10 text-[#00d97e] border-[#00d97e]/20";
      if (signal === "CONDITIONAL") return "bg-yellow-500/[0.06]0/10 text-yellow-400 border-yellow-500/20";
      return "bg-red-500/[0.06]0/10 text-red-400 border-red-500/20";
    };

    return (
      <div className="space-y-5">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white mb-1">Comparison Results</h2>
          <p className="text-white/50">
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
                  <p className="text-xs font-medium text-[#00d97e] uppercase mb-2">Works well</p>
                  <ul className="space-y-2">
                    {fitResult.strengths.map((s, idx) => (
                      <li key={idx} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-green-500 mt-0.5 font-bold flex-shrink-0">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {fitResult.friction_bullets.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-white/50 uppercase mb-2">Considerations</p>
                  <ul className="space-y-2">
                    {fitResult.friction_bullets.map((b, idx) => (
                      <li key={idx} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-[#00d97e]/70 mt-0.5 flex-shrink-0">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {fitResult.why_not_100.length > 0 && (
                <div className="pt-3 border-t border-white/[0.06]">
                  <p className="text-xs font-medium text-white/40 uppercase mb-2">Why not perfect?</p>
                  <ul className="space-y-1">
                    {fitResult.why_not_100.map((r, idx) => (
                      <li key={idx} className="text-xs text-white/50">• {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );

          return (
            <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-[#161b22]">
              {/* Photos row */}
              <div className="grid sm:grid-cols-2 grid-cols-1">
                <div className="relative h-48 bg-white/[0.04] sm:border-r border-b sm:border-b-0 border-white/[0.08]">
                  <VehicleImage {...imgA} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${signalBadge(result.optionA.fit_signal)}`}>
                      {FIT_SIGNAL_LABELS[result.optionA.fit_signal]}
                    </span>
                  </div>
                </div>
                <div className="relative h-48 bg-white/[0.04]">
                  <VehicleImage {...imgB} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${signalBadge(result.optionB.fit_signal)}`}>
                      {FIT_SIGNAL_LABELS[result.optionB.fit_signal]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Labels row */}
              <div className="grid sm:grid-cols-2 grid-cols-1 border-t border-white/[0.08]">
                <div className="px-4 py-3 sm:border-r border-b sm:border-b-0 border-white/[0.08]">
                  <p className="font-bold text-white text-sm">{labelA}</p>
                  {unlocked && <p className="text-xs text-white/50 mt-0.5 italic">{FADE_LABEL_DISPLAY[result.optionA.fade_label]}</p>}
                </div>
                <div className="px-4 py-3">
                  <p className="font-bold text-white text-sm">{labelB}</p>
                  {unlocked && <p className="text-xs text-white/50 mt-0.5 italic">{FADE_LABEL_DISPLAY[result.optionB.fade_label]}</p>}
                </div>
              </div>

              {/* Detail columns — unlocked only */}
              {unlocked && (
                <div className="grid sm:grid-cols-2 grid-cols-1 border-t border-white/[0.08] sm:divide-x divide-white/[0.08]">
                  {renderDetails(result.optionA)}
                  <div className="sm:hidden border-t border-white/[0.08]" />
                  {renderDetails(result.optionB)}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── OFFO VERDICT ──────────────────────────────────────── */}
        {(() => {
          const v = buildVerdict(
            result, labelA, labelB, specA, specB,
            priceA, priceB, total5A, total5B, tcoWinner,
            routineRefined, routinePattern, longDayFrequency
          );
          return (
            <div className={`rounded-2xl border-2 p-5 ${v.winner ? "border-[#00d97e]/30 bg-gradient-to-r bg-[#00d97e]/[0.06]" : "border-white/[0.08] bg-[#0d1117]"}`}>
              <p className="text-xs font-semibold text-[#00d97e]/60 uppercase tracking-widest mb-1">OFFO Verdict</p>
              <p className="font-bold text-white text-sm leading-snug">{v.title}</p>
              {v.body && <p className="text-xs text-white/60 mt-1.5">{v.body}</p>}
              {!routineRefined && (
                <p className="text-xs text-white/40 mt-2">Personalise to your routine above for a more accurate verdict.</p>
              )}
            </div>
          );
        })()}

        {/* Spec table — always visible if user added specs */}
        {includeSpecs && hasAnySpec && (
          <div className="bg-[#161b22] rounded-2xl border border-white/[0.06] p-5">
            <h3 className="font-bold text-white mb-4">Spec Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-white/50 w-1/3">Spec</th>
                    <th className="py-2.5 px-3 text-center text-sm font-semibold text-white">{labelA}</th>
                    <th className="py-2.5 px-3 text-center text-sm font-semibold text-white">{labelB}</th>
                  </tr>
                </thead>
                <tbody>
                  <SpecRow rowIndex={0} label="Est. Range (EPA)" valA={specA.range_mi ? `~${specA.range_mi} mi` : "—"} valB={specB.range_mi ? `~${specB.range_mi} mi` : "—"} numA={specA.range_mi} numB={specB.range_mi} better="higher" />
                  {(realWorldRangeA || realWorldRangeB) && (
                    <tr className="bg-[#00d97e]/[0.06]">
                      <td className="py-2 px-3 text-xs text-[#00d97e] italic pl-5 w-1/3">Real-world est.</td>
                      <td className="py-2 px-3 text-xs text-center text-[#00d97e]">
                        {realWorldRangeA ? `~${realWorldRangeA} mi` : "—"}
                        {coldRangeA && <span className="block text-xs text-[#00d97e]">~{coldRangeA} mi in cold</span>}
                      </td>
                      <td className="py-2 px-3 text-xs text-center text-[#00d97e]">
                        {realWorldRangeB ? `~${realWorldRangeB} mi` : "—"}
                        {coldRangeB && <span className="block text-xs text-[#00d97e]">~{coldRangeB} mi in cold</span>}
                      </td>
                    </tr>
                  )}
                  <SpecRow rowIndex={1} label="Battery" valA={specA.battery_kwh ? `${specA.battery_kwh} kWh` : "—"} valB={specB.battery_kwh ? `${specB.battery_kwh} kWh` : "—"} numA={specA.battery_kwh} numB={specB.battery_kwh} better="higher" />
                  <SpecRow rowIndex={2} label="DC Fast (peak)" valA={specA.dc_fast_kw ? `${specA.dc_fast_kw} kW` : "—"} valB={specB.dc_fast_kw ? `${specB.dc_fast_kw} kW` : "—"} numA={specA.dc_fast_kw} numB={specB.dc_fast_kw} better="higher" />
                  {(chargeTimeA || chargeTimeB) && (
                    <tr className="bg-orange-50">
                      <td className="py-2 px-3 text-xs text-orange-700 italic pl-5 w-1/3">10→80% est.</td>
                      <td className="py-2 px-3 text-xs text-center text-orange-700">
                        {chargeTimeA ? `~${chargeTimeA} min` : "—"}
                      </td>
                      <td className="py-2 px-3 text-xs text-center text-orange-700">
                        {chargeTimeB ? `~${chargeTimeB} min` : "—"}
                      </td>
                    </tr>
                  )}
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
            <p className="text-xs text-white/40 mt-3">Real-world range est. applies ~13% reduction from EPA. Cold weather est. assumes ~30% additional reduction. Charge time is a peak-rate ceiling; actual varies. Verify before purchasing.</p>
          </div>
        )}

        {/* ── 5-YEAR COST OF OWNERSHIP ─────────────────────────── */}
        {showTco && (
          <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-sm">5-Year Cost of Ownership</h3>
              <p className="text-xs text-white/50 mt-0.5">Estimates based on US averages. Verify before purchasing.</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0d1117]">
                  <th className="py-2 px-3 text-left text-white/50 font-medium w-2/5"></th>
                  <th className="py-2 px-3 text-center text-white/70 font-semibold">{labelA}</th>
                  <th className="py-2 px-3 text-center text-white/70 font-semibold">{labelB}</th>
                </tr>
              </thead>
              <tbody>
                {(priceA != null || priceB != null) && (
                  <tr className="bg-[#161b22]">
                    <td className="py-2 px-3 text-white/50">Purchase price</td>
                    <td className="py-2 px-3 text-center text-white/80">{priceA != null ? formatCurrency(priceA) : "—"}</td>
                    <td className="py-2 px-3 text-center text-white/80">{priceB != null ? formatCurrency(priceB) : "—"}</td>
                  </tr>
                )}
                {(taxCreditA > 0 || taxCreditB > 0) && (
                  <tr className="bg-[#00d97e]/[0.06]">
                    <td className="py-2 px-3 text-[#00d97e]">Fed. tax credit</td>
                    <td className="py-2 px-3 text-center text-[#00d97e]">{taxCreditA > 0 ? `−${formatCurrency(taxCreditA)}` : "—"}</td>
                    <td className="py-2 px-3 text-center text-[#00d97e]">{taxCreditB > 0 ? `−${formatCurrency(taxCreditB)}` : "—"}</td>
                  </tr>
                )}
                <tr className="bg-[#0d1117]">
                  <td className="py-2 px-3 text-white/50">Charging (5 yr)</td>
                  <td className="py-2 px-3 text-center text-white/80">{formatCurrency(annualChargeA * 5)}</td>
                  <td className="py-2 px-3 text-center text-white/80">{formatCurrency(annualChargeB * 5)}</td>
                </tr>
                <tr className="bg-[#161b22]">
                  <td className="py-2 px-3 text-white/50">Maintenance (5 yr)</td>
                  <td className="py-2 px-3 text-center text-white/80">{formatCurrency(annualMaint * 5)}</td>
                  <td className="py-2 px-3 text-center text-white/80">{formatCurrency(annualMaint * 5)}</td>
                </tr>
                <tr className="bg-[#0d1117]">
                  <td className="py-2 px-3 text-white/50">Insurance (5 yr)</td>
                  <td className="py-2 px-3 text-center text-white/80">{formatCurrency(insLow * 5)}–{formatCurrency(insHigh * 5)}</td>
                  <td className="py-2 px-3 text-center text-white/80">{formatCurrency(insLow * 5)}–{formatCurrency(insHigh * 5)}</td>
                </tr>
                {(total5A != null || total5B != null) && (
                  <tr className="bg-[#00d97e]/[0.06] font-semibold">
                    <td className="py-2.5 px-3 text-white/60">5-yr total est.</td>
                    <td className={`py-2.5 px-3 text-center ${tcoWinner === "A" ? "text-[#00d97e]" : "text-white/60"}`}>
                      {total5A != null ? formatCurrency(total5A) : "—"}
                      {tcoWinner === "A" && <span className="ml-1 text-xs bg-green-100 text-[#00d97e] px-1.5 py-0.5 rounded-full">lower</span>}
                    </td>
                    <td className={`py-2.5 px-3 text-center ${tcoWinner === "B" ? "text-[#00d97e]" : "text-white/60"}`}>
                      {total5B != null ? formatCurrency(total5B) : "—"}
                      {tcoWinner === "B" && <span className="ml-1 text-xs bg-green-100 text-[#00d97e] px-1.5 py-0.5 rounded-full">lower</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {tcoWinner && tcoWinner !== "TIE" && total5A != null && total5B != null && (
              <div className="px-5 py-3 bg-[#00d97e]/[0.06] border-t border-[#00d97e]/15">
                <p className="text-xs text-green-800">
                  <span className="font-semibold">{tcoWinner === "A" ? labelA : labelB}</span> costs{" "}
                  <span className="font-semibold">{formatCurrency(Math.abs(total5A - total5B))} less</span> over 5 years.
                </p>
              </div>
            )}
            <p className="text-xs text-white/40 px-5 py-2">12,000 mi/yr · $0.16/kWh · AAA maintenance avg · mid-range insurance est.</p>
          </div>
        )}

        {/* ── DEPRECIATION & RESALE VALUE ───────────────────────── */}
        {(yr3ValueA != null || yr3ValueB != null || yr5ValueA != null || yr5ValueB != null) && (
          <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-sm">Depreciation &amp; Resale Value</h3>
              <p className="text-xs text-white/50 mt-0.5">Projected value based on per-make iSeeCars / CarEdge benchmarks.</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              {[
                { label: labelA, yr3: yr3ValueA, yr5: yr5ValueA, price: priceA, rate: depRateA, meta: metaA },
                { label: labelB, yr3: yr3ValueB, yr5: yr5ValueB, price: priceB, rate: depRateB, meta: metaB },
              ].map(({ label, yr3, yr5, price, rate, meta }, i) => {
                const otherYr5 = i === 0 ? yr5ValueB : yr5ValueA;
                const isBetterResale = yr5 != null && otherYr5 != null && yr5 > otherYr5;
                const searchUrl = meta.make && meta.model
                  ? getCarGurusUrl(meta.make, meta.model, { year: meta.year })
                  : null;
                return (
                  <div key={i} className="px-4 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-white/70 truncate">{label}</p>
                      {isBetterResale && (
                        <span className="text-xs bg-green-100 text-[#00d97e] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ml-1">Better resale</span>
                      )}
                    </div>
                    {price != null && (
                      <p className="text-xs text-white/40">Purchase: {formatCurrency(price)}</p>
                    )}
                    <div className="space-y-1.5">
                      {yr3 != null && (
                        <div className="flex justify-between text-xs">
                          <span className="text-white/50">After 3 yrs</span>
                          <span className="font-semibold text-white/80">~{formatCurrency(yr3)}</span>
                        </div>
                      )}
                      {yr5 != null && (
                        <div className="flex justify-between text-xs">
                          <span className="text-white/50">After 5 yrs</span>
                          <span className="font-semibold text-white/80">~{formatCurrency(yr5)}</span>
                        </div>
                      )}
                      {price != null && yr5 != null && (
                        <div className="flex justify-between text-xs text-red-600">
                          <span>5-yr loss</span>
                          <span className="font-semibold">~{formatCurrency(price - yr5)} ({Math.round((1 - rate.yr5) * 100)}%)</span>
                        </div>
                      )}
                    </div>
                    {searchUrl && (
                      <a
                        href={searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-xs text-[#00d97e]/70 hover:underline mt-1"
                      >
                        Search used listings →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-white/40 px-5 py-2 border-t border-white/[0.06]">Depreciation rates are estimates. Actual resale value varies by trim, condition, and market.</p>
          </div>
        )}

        {/* ── FREE PERSONALIZATION CTA ─────────────────────────── */}
        {!routineRefined && (
          <div className="bg-[#00d97e]/[0.06] border-2 border-blue-200 rounded-2xl p-5">
            <p className="font-semibold text-white text-sm mb-1">
              Personalise to your routine — free
            </p>
            <p className="text-xs text-[#00d97e]/80 mb-4">
              Tell us how you drive and we&apos;ll re-score both fit signals for your actual situation. No payment needed.
            </p>
            <button
              onClick={() => {
                setPhase("routine");
                trackEvent("compare_routine_free_entry", { region: regionResolved, was_unlocked: unlocked });
              }}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-[#00d97e] text-[#0d1117] hover:bg-[#00c970] transition-all flex items-center justify-center gap-2"
            >
              Personalise for my routine <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── PAYWALL GATE ─────────────────────────────────────── */}
        {!unlocked && (
          <div className="bg-[#00d97e]/[0.04] rounded-2xl border-2 border-[#00d97e]/30 overflow-hidden">
            {/* Blurred preview of deep analysis */}
            <div className="relative">
              <div className="pointer-events-none select-none blur-sm opacity-60 px-5 pt-5 space-y-3">
                <div className="bg-[#161b22] rounded-xl border border-[#00d97e]/20 p-4">
                  <p className="text-xs font-semibold text-white/50 uppercase mb-2">Deep Analysis — {labelA}</p>
                  <p className="text-sm text-white/70">✓ Efficient for city driving — lower battery drain in stop-start</p>
                  <p className="text-sm text-white/70 mt-1">✓ DC fast charging adequate for occasional road trips</p>
                  <p className="text-sm text-white/50 mt-1">• Consider range anxiety on 150+ mile days without planning</p>
                </div>
                <div className="bg-[#161b22] rounded-xl border border-[#00d97e]/20 p-4">
                  <p className="text-xs font-semibold text-white/50 uppercase mb-2">Deep Analysis — {labelB}</p>
                  <p className="text-sm text-white/70">✓ Higher peak DC charging — faster top-ups on longer trips</p>
                  <p className="text-sm text-white/70 mt-1">• Larger battery means more to charge overnight with L1</p>
                </div>
                <div className="bg-[#161b22] rounded-xl border border-[#00d97e]/20 p-4">
                  <p className="text-xs font-semibold text-white/70 mb-2">Verdict: What would actually change?</p>
                  <p className="text-sm text-white/70">→ Daily charging time increases by ~2 hours with L1</p>
                  <p className="text-sm text-white/70 mt-1">→ Road trip planning effort differs significantly</p>
                </div>
              </div>
              {/* Lock overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-[#161b22]/40 backdrop-blur-[1px]">
                <Lock className="w-8 h-8 text-[#00d97e]/50 opacity-80" />
              </div>
            </div>

            {/* Unlock CTA */}
            <div className="px-5 pb-5 pt-4 border-t border-indigo-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#00d97e] bg-[#00d97e]/10 px-2.5 py-1 rounded-full">OFFO Compare Pass</span>
                <span className="text-base font-bold text-white">{displayPrice}</span>
              </div>
              <p className="text-sm font-semibold text-white mb-1">Unlock the full comparison</p>
              <ul className="space-y-1.5 mb-3">
                {[
                  { icon: BarChart2, text: "Deep-dive analysis for both vehicles" },
                  { icon: MessageSquare, text: "Verdict: what actually changes for your routine" },
                ].map(({ icon: Icon, text }, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-white/60">
                    <Icon className="w-3.5 h-3.5 text-[#00d97e]/50 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[#00d97e]/70 font-medium mb-3">See how these cars match your routine — one-time, no subscription.</p>
              <button
                onClick={handleCompareCheckout}
                disabled={checkoutLoading || !compareSessionId}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r bg-[#00d97e] hover:bg-[#00c970] transition-all disabled:opacity-60 shadow-sm"
              >
                {checkoutLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Redirecting...</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" />See full analysis &amp; what changes — {displayPrice}</>
                )}
              </button>
              {checkoutError && <p className="text-xs text-red-600 mt-2">{checkoutError}</p>}
              {!compareSessionId && <p className="text-xs text-white/40 mt-2 text-center">Preparing checkout…</p>}
            </div>
          </div>
        )}

        {/* ── UNLOCKED CONTENT ─────────────────────────────────── */}
        {unlocked && (
          <>
            {/* Delta */}
            <div className="bg-[#161b22] rounded-2xl border border-[#00d97e]/20 p-5">
              <h3 className="font-bold text-white mb-4">What would actually change?</h3>
              <ul className="space-y-3">
                {result.routine_delta_bullets.map((bullet, idx) => (
                  <li key={idx} className="text-sm text-white/70 flex items-start gap-2.5">
                    <span className="text-[#00d97e]/70 mt-0.5 font-bold flex-shrink-0">→</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Neutral Closer */}
            <div className="bg-[#00d97e]/[0.06] rounded-2xl border border-[#00d97e]/20 p-5 text-center">
              <p className="text-sm text-white/60 italic">{result.neutral_closer}</p>
            </div>
          </>
        )}

        {/* ── COPY & SHARE — always free ────────────────────────── */}
        {(() => {
          const verdictForShare = buildVerdict(
            result, labelA, labelB, specA, specB,
            priceA, priceB, total5A, total5B, tcoWinner,
            routineRefined, routinePattern, longDayFrequency
          );
          const handleCopy = async () => {
            const specLines: string[] = [];
            if (includeSpecs && hasAnySpec) {
              specLines.push("", "Specs:");
              if (specA.range_mi || specB.range_mi) specLines.push(`  Range: ${specA.range_mi ? `~${Math.round(specA.range_mi * 0.87)} mi real-world` : "—"} vs ${specB.range_mi ? `~${Math.round(specB.range_mi * 0.87)} mi real-world` : "—"}`);
              if (specA.battery_kwh || specB.battery_kwh) specLines.push(`  Battery: ${specA.battery_kwh ?? "—"} kWh vs ${specB.battery_kwh ?? "—"} kWh`);
              if (specA.dc_fast_kw || specB.dc_fast_kw) specLines.push(`  DC Fast: ${specA.dc_fast_kw ?? "—"} kW vs ${specB.dc_fast_kw ?? "—"} kW`);
              if (specA.price || specB.price) specLines.push(`  Price: ${specA.price ? `$${specA.price.toLocaleString()}` : "—"} vs ${specB.price ? `$${specB.price.toLocaleString()}` : "—"}`);
            }
            const tcoLine = tcoWinner && tcoWinner !== "TIE" && total5A != null && total5B != null
              ? [`5-yr cost est.: ${tcoWinner === "A" ? labelA : labelB} saves ~${formatCurrency(Math.abs(total5A - total5B))} over 5 years`]
              : [];
            const deltaLines = unlocked && result.routine_delta_bullets.length > 0
              ? ["", "For your routine:", ...result.routine_delta_bullets.map(b => `• ${b}`)]
              : [];
            const takeaway = [
              `OFFO Comparison: ${labelA} vs ${labelB}`,
              "",
              `Verdict: ${verdictForShare.title}`,
              "",
              `${labelA}: ${FIT_SIGNAL_LABELS[result.optionA.fit_signal]}`,
              `${labelB}: ${FIT_SIGNAL_LABELS[result.optionB.fit_signal]}`,
              ...specLines,
              ...(tcoLine.length ? ["", ...tcoLine] : []),
              ...deltaLines,
              "",
              result.neutral_closer,
              "",
              "Analysed with OFFO — offo.co",
            ].join("\n");
            try {
              await navigator.clipboard.writeText(takeaway);
              setShowCopySuccess(true);
              setTimeout(() => setShowCopySuccess(false), 2000);
              trackEvent("compare_copy_takeaway_clicked", { region: regionResolved, fit_signal_a: result.optionA.fit_signal, fit_signal_b: result.optionB.fit_signal });
            } catch (err) {
              console.error("Copy failed:", err);
            }
          };
          return (
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium border-2 border-white/[0.08] text-white/70 hover:bg-[#0d1117] hover:border-blue-400 transition-all"
            >
              {showCopySuccess ? (
                <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-600">Copied!</span></>
              ) : (
                <><Copy className="w-4 h-4" /><span>Copy &amp; share summary</span></>
              )}
            </button>
          );
        })()}

        <div className="flex gap-3">
          <button
            onClick={() => setPhase("options")}
            className="flex-1 py-3.5 rounded-xl font-medium border-2 border-white/[0.08] text-white/70 hover:bg-[#0d1117] transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Edit options
          </button>
          <button
            onClick={() => { setPhase("options"); setResult(null); setRoutineRefined(false); setCompareSessionId(null); trackEvent("compare_restart_clicked", { region: regionResolved }); }}
            className="flex-1 py-3.5 rounded-xl font-medium border-2 border-white/[0.08] text-white/70 hover:bg-[#0d1117] transition-all"
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
        <h2 className="text-2xl font-bold text-white mb-1">Your Driving Routine</h2>
        <p className="text-white/50">Answer these to personalise the comparison to your actual situation.</p>
      </div>

      {/* Region */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.06] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Your region</p>
            <p className="text-xs text-white/50 mt-0.5">{regionResolved === "UK" ? "United Kingdom" : "United States"}</p>
          </div>
          <select value={regionSelection} onChange={(e) => setRegionSelection(e.target.value as RegionSelection)} className="text-sm border border-white/[0.08] rounded-lg px-3 py-2 bg-[#161b22] focus:border-[#00d97e]/50 focus:outline-none">
            <option value="AUTO">Auto-detect</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
          </select>
        </div>
      </div>

      {/* Q1: Home Charging */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.06] p-5 space-y-3">
        <label className="block text-sm font-semibold text-white">Do you have dedicated home charging?</label>
        <div className="grid grid-cols-2 gap-3">
          {[{ value: true, label: "Yes" }, { value: false, label: "No" }].map((opt) => (
            <button key={String(opt.value)} onClick={() => setHasHomeCharging(opt.value)} className={`p-3 rounded-xl border-2 text-left font-medium text-sm transition-all ${hasHomeCharging === opt.value ? "border-blue-600 bg-[#00d97e]/[0.06] text-[#00d97e]/80" : "border-white/[0.08] text-white/70 hover:border-blue-300"}`}>{opt.label}</button>
          ))}
        </div>
        {hasHomeCharging && (
          <div className="pt-2 pl-4 border-l-2 border-blue-200">
            <label className="block text-xs font-medium text-white/60 mb-2">What type?</label>
            <div className="flex gap-2">
              {(["L1", "L2", "UNKNOWN"] as const).map((type) => (
                <button key={type} onClick={() => setHomeChargingType(type)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${homeChargingType === type ? "bg-[#00d97e] text-[#0d1117]" : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"}`}>
                  {type === "UNKNOWN" ? "Not sure" : type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Q2: Work Charging */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.06] p-5 space-y-3">
        <label className="block text-sm font-semibold text-white">Can you charge at work?</label>
        <div className="grid grid-cols-2 gap-3">
          {[{ value: true, label: "Yes" }, { value: false, label: "No" }].map((opt) => (
            <button key={String(opt.value)} onClick={() => setCanChargeAtWork(opt.value)} className={`p-3 rounded-xl border-2 text-left font-medium text-sm transition-all ${canChargeAtWork === opt.value ? "border-blue-600 bg-[#00d97e]/[0.06] text-[#00d97e]/80" : "border-white/[0.08] text-white/70 hover:border-blue-300"}`}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Q3: Public Dependency */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.06] p-5 space-y-3">
        <label className="block text-sm font-semibold text-white">How often would you rely on public charging?</label>
        <div className="space-y-2">
          {(["RARE", "SOMETIMES", "OFTEN"] as const).map((opt) => (
            <button key={opt} onClick={() => setPublicDependency(opt)} className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${publicDependency === opt ? "border-blue-600 bg-[#00d97e]/[0.06] text-[#00d97e]/80" : "border-white/[0.08] text-white/70 hover:border-blue-300"}`}>
              {opt === "RARE" && "Rarely — road trips only"}{opt === "SOMETIMES" && "Sometimes — roughly weekly"}{opt === "OFTEN" && "Often — multiple times per week"}
            </button>
          ))}
        </div>
      </div>

      {/* Q4: Routine Pattern */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.06] p-5 space-y-3">
        <label className="block text-sm font-semibold text-white">What&apos;s your typical driving pattern?</label>
        <div className="space-y-2">
          {(["LOCAL", "MIXED", "MOTORWAY_HEAVY"] as const).map((opt) => (
            <button key={opt} onClick={() => setRoutinePattern(opt)} className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${routinePattern === opt ? "border-blue-600 bg-[#00d97e]/[0.06] text-[#00d97e]/80" : "border-white/[0.08] text-white/70 hover:border-blue-300"}`}>
              {opt === "LOCAL" && "Mostly local / city driving"}{opt === "MIXED" && "Mix of local and highway"}{opt === "MOTORWAY_HEAVY" && (regionResolved === "UK" ? "Mostly motorway" : "Mostly highway")}
            </button>
          ))}
        </div>
      </div>

      {/* Q5: Long Day Frequency */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.06] p-5 space-y-3">
        <label className="block text-sm font-semibold text-white">How often do you have long driving days (100+ miles)?</label>
        <div className="space-y-2">
          {(["RARE", "MONTHLY", "WEEKLY"] as const).map((opt) => (
            <button key={opt} onClick={() => setLongDayFrequency(opt)} className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${longDayFrequency === opt ? "border-blue-600 bg-[#00d97e]/[0.06] text-[#00d97e]/80" : "border-white/[0.08] text-white/70 hover:border-blue-300"}`}>
              {opt === "RARE" && "Rarely — a few times a year"}{opt === "MONTHLY" && "Monthly"}{opt === "WEEKLY" && "Weekly or more"}
            </button>
          ))}
        </div>
      </div>

      {/* Q6: Planning Tolerance */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.06] p-5 space-y-3">
        <label className="block text-sm font-semibold text-white">How do you feel about planning charging stops?</label>
        <div className="space-y-2">
          {(["LOW", "MED", "HIGH"] as const).map((opt) => (
            <button key={opt} onClick={() => setPlanningTolerance(opt)} className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${planningTolerance === opt ? "border-blue-600 bg-[#00d97e]/[0.06] text-[#00d97e]/80" : "border-white/[0.08] text-white/70 hover:border-blue-300"}`}>
              {opt === "LOW" && "I prefer not to think about it"}{opt === "MED" && "I don't mind some planning"}{opt === "HIGH" && "I'm comfortable planning ahead"}
            </button>
          ))}
        </div>
      </div>

      {/* Q7: Shared Infrastructure */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.06] p-5 space-y-3">
        <label className="block text-sm font-semibold text-white">Would you share charging access with others?</label>
        <div className="space-y-2">
          {(["NONE", "SOME", "HIGH"] as const).map((opt) => (
            <button key={opt} onClick={() => setSharedInfrastructure(opt)} className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${sharedInfrastructure === opt ? "border-blue-600 bg-[#00d97e]/[0.06] text-[#00d97e]/80" : "border-white/[0.08] text-white/70 hover:border-blue-300"}`}>
              {opt === "NONE" && "No — dedicated charger for me"}{opt === "SOME" && "Sometimes — shared with household"}{opt === "HIGH" && "Yes — apartment or shared parking"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={() => setPhase("results")} className="flex-1 py-3.5 rounded-xl font-medium border-2 border-white/[0.08] text-white/70 hover:bg-[#0d1117] transition-all flex items-center justify-center gap-2">
          <ChevronUp className="w-4 h-4" /> Back to results
        </button>
        <button
          onClick={handleRoutineRefine}
          disabled={!isRoutineComplete}
          className={`flex-1 py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${isRoutineComplete ? "bg-[#00d97e] text-[#0d1117] hover:bg-[#00c970]" : "bg-white/[0.08] text-white/40 cursor-not-allowed"}`}
        >
          Re-score for my routine <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Step indicator: options=1, results=2, routine=3 (optional)
  const stepLabels = ["Two Options", "Results", "Your Routine"];
  const stepPhases: Phase[] = ["options", "results", "routine"];
  const currentStepIdx = stepPhases.indexOf(phase);

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <GitCompareArrows className="w-4 h-4 text-[#00d97e]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#00d97e]">Compare</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Compare Two EVs</h1>
        <p className="text-sm text-white/40 mt-1">Side-by-side analysis — enter two options for an instant verdict.</p>
      </div>

      {/* Step indicator */}
      <div className="border-b border-white/[0.08] mb-6">
        <div className="flex">
          {stepPhases.map((p, idx) => (
            <div key={p} className={`flex-1 flex flex-col items-center pb-3 text-xs font-medium transition-colors border-b-2 ${
              phase === p
                ? "border-[#00d97e] text-[#00d97e]"
                : idx < currentStepIdx
                ? "border-[#00d97e]/40 text-[#00d97e]/60"
                : "border-transparent text-white/30"
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 text-xs font-bold ${
                phase === p ? "bg-[#00d97e] text-[#0d1117]" : idx < currentStepIdx ? "bg-[#00d97e]/20 text-[#00d97e]" : "bg-[#161b22]/[0.06] text-white/30"
              }`}>
                {idx < currentStepIdx ? "✓" : idx + 1}
              </div>
              <span className="hidden sm:block">{stepLabels[idx]}</span>
              {idx === 2 && <span className="hidden sm:block text-[10px] text-[#00d97e]/60 -mt-0.5">free</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1">
        <div className="w-full px-0">
          <AnimatePresence mode="wait">
            <motion.div key={phase} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              {phase === "options" && renderOptionsPhase()}
              {phase === "results" && renderResultsPhase()}
              {phase === "routine" && renderRoutinePhase()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

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
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#00d97e] rounded-full animate-spin" /></div>}>
      <ComparePageContent />
    </Suspense>
  );
}
