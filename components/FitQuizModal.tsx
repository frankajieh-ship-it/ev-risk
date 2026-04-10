"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import {
  selectFrictionSentences,
  calculateFitContext,
  mapToScoringInput
} from "@/lib/sanity-check-logic";
import { type SanityCheckAnswers } from "@/lib/sanity-check-sentences";
import { inferClimateFromZip } from "@/lib/zip-climate-mapping";
import type {
  ClimateSeasonality,
  WinterLongDays,
  ChargingAnchorType,
  BackupOption,
} from "@/types";
import { resolveRegion, type RegionSelection } from "@/lib/resolveRegion";
import { getCopy } from "@/lib/getCopy";

interface FitQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    model?: string;
    year?: number;
    currentMileage?: number;
    batteryInfoAvailable?: boolean;
    dataSource?: 'url-extraction' | 'manual-entry';
    missingFields?: string[];
  };
}

type Phase = "questions" | "why" | "output";

// WHY choices with framing text
const WHY_CHOICES = [
  { value: "comparing", label: "Comparing options", framing: "Because you're comparing similar options" },
  { value: "routine_change", label: "Routine is changing", framing: "Because something in your routine is changing" },
  { value: "buying_soon", label: "Buying soon", framing: "Since you're close to a decision" },
  { value: "curious", label: "Just curious", framing: "For context" },
] as const;

type WhyChoice = typeof WHY_CHOICES[number]["value"] | null;

export default function FitQuizModal({ isOpen, onClose, initialData }: FitQuizModalProps) {
  const router = useRouter();
  const { trackEvent, trackFormSubmit } = useEventTracking();
  const { sessionId, startSession, completeSession } = useSessionTracking();

  const [phase, setPhase] = useState<Phase>("questions");
  const [sanityAnswers, setSanityAnswers] = useState<Partial<SanityCheckAnswers>>({});
  const [zipCode, setZipCode] = useState("");
  const [skipLocation, setSkipLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [regionSelection, setRegionSelection] = useState<RegionSelection>("AUTO");
  const [whyChoice, setWhyChoice] = useState<WhyChoice>(null);
  const [showMicroFeedback, setShowMicroFeedback] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);

  // P0/P1: New seasonal and predictability inputs
  const [climateSeasonality, setClimateSeasonality] = useState<ClimateSeasonality>("UNKNOWN");
  const [climateAutoInferred, setClimateAutoInferred] = useState(false);
  const [winterLongDays, setWinterLongDays] = useState<WinterLongDays>("UNKNOWN");
  const [chargingAnchorType, setChargingAnchorType] = useState<ChargingAnchorType | null>(null);
  const [backupOption, setBackupOption] = useState<BackupOption | null>(null);

  // Resolve region and get copy
  const regionResolved = resolveRegion(regionSelection);
  const copy = getCopy(regionResolved);

  // ZIP/Postcode validation pattern
  const zipPattern = regionResolved === "UK"
    ? /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i  // UK postcode
    : /^\d{5}$/;  // US ZIP

  // Reset state when modal opens and start session tracking
  useEffect(() => {
    if (isOpen) {
      setPhase("questions"); // eslint-disable-line react-hooks/set-state-in-effect
      setSanityAnswers({
        executionUncertaintyTolerance: "medium",
        downtimeRecoveryTolerance: "medium"
      });
      setZipCode("");
      setSkipLocation(false);
      setSubmitting(false);
      setShowCopySuccess(false);
      setWhyChoice(null);
      setShowMicroFeedback(false);
      setFeedbackGiven(null);

      // P0/P1: Reset new inputs
      setClimateSeasonality("UNKNOWN");
      setClimateAutoInferred(false);
      setWinterLongDays("UNKNOWN");
      setChargingAnchorType(null);
      setBackupOption(null);

      // Start session tracking (fire-and-forget)
      startSession().catch(() => {
        // Silent fail - don't block user flow
      });
    }
  }, [isOpen, startSession]);

  // P0/P1: Auto-infer climate when ZIP changes
  useEffect(() => {
    if (zipCode && zipCode.length >= 3 && !skipLocation) {
      const inferred = inferClimateFromZip(zipCode, regionResolved);
      if (inferred !== "UNKNOWN" && !climateAutoInferred) {
        setClimateSeasonality(inferred); // eslint-disable-line react-hooks/set-state-in-effect
        setClimateAutoInferred(true);
      }
    }
  }, [zipCode, regionResolved, skipLocation, climateAutoInferred]);

  const handleAnswerChange = (field: keyof SanityCheckAnswers, value: SanityCheckAnswers[keyof SanityCheckAnswers]) => {
    setSanityAnswers(prev => ({ ...prev, [field]: value }));
  };

  const handleContinueToWhy = () => {
    // Validate all 4 core answers present
    if (!sanityAnswers.chargingAccess || !sanityAnswers.schedule ||
        !sanityAnswers.backup || !sanityAnswers.dependency) {
      alert("Please answer all questions");
      return;
    }

    // Validate ZIP/Postcode unless skipped
    if (!skipLocation) {
      if (!zipCode.trim()) {
        alert(`Please enter your ${copy.labels.zip} or check 'Skip location'`);
        return;
      }
      if (!zipPattern.test(zipCode)) {
        const errorMsg = regionResolved === "UK"
          ? "Please enter a valid UK postcode (e.g., SW1A 1AA)"
          : "Please enter a valid 5-digit ZIP code";
        alert(errorMsg);
        return;
      }
    }

    // Track sanity check completion
    trackEvent("sanity_check_completed", {
      chargingAccess: sanityAnswers.chargingAccess,
      schedule: sanityAnswers.schedule,
      backup: sanityAnswers.backup,
      dependency: sanityAnswers.dependency,
      executionUncertaintyTolerance: sanityAnswers.executionUncertaintyTolerance,
      downtimeRecoveryTolerance: sanityAnswers.downtimeRecoveryTolerance,
      risk_execution_uncertainty: sanityAnswers.executionUncertaintyTolerance === "low",
      risk_recovery_downtime: sanityAnswers.downtimeRecoveryTolerance === "low",
      region: regionResolved,
      skipLocation,
    });

    // Track why checkpoint shown
    trackEvent("why_checkpoint_shown", {
      region: regionResolved,
      placement: "quiz_flow",
    });

    setPhase("why");
  };

  const handleWhySubmit = (choice: WhyChoice) => {
    setWhyChoice(choice);
    trackEvent("why_checkpoint_submitted", {
      why_choice: choice,
      region: regionResolved,
    });
    setPhase("output");
    // Show micro-feedback after a short delay
    setTimeout(() => setShowMicroFeedback(true), 2000);
  };

  const handleWhySkip = () => {
    trackEvent("why_checkpoint_skipped", { region: regionResolved });
    setPhase("output");
    setTimeout(() => setShowMicroFeedback(true), 2000);
  };

  const handleMicroFeedback = (feedback: "up" | "down") => {
    setFeedbackGiven(feedback);
    trackEvent("micro_feedback_given", {
      feedback,
      why_choice: whyChoice,
      region: regionResolved,
    });
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);

      const sentences = selectFrictionSentences(sanityAnswers as SanityCheckAnswers);
      trackEvent("friction_sentences_copied", {
        sentenceCount: sentences.length
      });
    } catch (err) {
      console.error("Copy failed:", err);
      alert("Could not copy to clipboard. Please copy manually.");
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);

    // Use default ZIP if skipped (region-based default)
    const effectiveZipCode = skipLocation
      ? (regionResolved === "UK" ? "SW1A 1AA" : "00000")
      : zipCode;

    // Compute fit track early so it can be used in session + report
    const fitResult = calculateFitContext(sanityAnswers as SanityCheckAnswers);

    // Map sanity-check answers to ScoringInput
    const mappedInputs = mapToScoringInput(sanityAnswers as SanityCheckAnswers, effectiveZipCode);

    const reportData = {
      // Vehicle data (pre-filled from URL/manual)
      model: initialData?.model || "Unknown EV",
      year: initialData?.year || new Date().getFullYear() - 2,
      currentMileage: initialData?.currentMileage || 45000,

      // Mapped from sanity-check
      homeCharging: mappedInputs.homeCharging,
      dailyMiles: mappedInputs.dailyMiles,
      zipCode: mappedInputs.zipCode,
      riskTolerance: mappedInputs.riskTolerance,

      // Region (for regional copy on report page)
      region: regionResolved,

      // Metadata preservation
      source: "sanity-check",
      ...(initialData?.batteryInfoAvailable !== undefined && {
        batteryInfoAvailable: initialData.batteryInfoAvailable
      }),
      ...(initialData?.dataSource && { dataSource: initialData.dataSource }),
      ...(initialData?.missingFields && {
        missingFields: initialData.missingFields
      }),
    };

    // Track form submission
    trackFormSubmit(true, {
      source: "sanity-check",
      model: reportData.model,
      year: reportData.year,
      region: regionResolved,
    });

    // Track report generation
    trackEvent("report_generated", {
      source: "sanity-check",
      has_battery_info: initialData?.batteryInfoAvailable !== undefined ? initialData.batteryInfoAvailable : true,
      missing_fields_count: initialData?.missingFields?.length || 0,
    });

    // Complete session tracking with inputs (fire-and-forget)
    // Note: fit_signal and risk_tags will be computed on the report page
    completeSession(
      {
        // Normalized routine inputs (no PII)
        chargingAccess: sanityAnswers.chargingAccess,
        schedule: sanityAnswers.schedule,
        backup: sanityAnswers.backup,
        dependency: sanityAnswers.dependency,
        executionUncertaintyTolerance: sanityAnswers.executionUncertaintyTolerance,
        downtimeRecoveryTolerance: sanityAnswers.downtimeRecoveryTolerance,
        region: regionResolved,
        vehicleModel: initialData?.model,
        vehicleYear: initialData?.year,
        whyChoice: whyChoice,
        // P0/P1: New seasonal and predictability inputs
        climateSeasonality,
        winterLongDays: climateSeasonality === "COLD_WINTER" ? winterLongDays : undefined,
        chargingAnchorType,
        backupOption,
        // PHEV integration
        drivetrainOpenness: sanityAnswers.drivetrainOpenness,
        housingType: sanityAnswers.housingType,
        towingNeeds: sanityAnswers.towingNeeds,
        pluginFrequency: sanityAnswers.pluginFrequency,
        fitTrack: fitResult.track,
      },
      {
        // Engine outputs will be populated on report page load
        // For now, just mark as completed
      }
    ).catch(() => {
      // Silent fail
    });

    console.log('[Sanity Check] Submitting data:', reportData);

    // Navigate to report with session_id
    const queryParams = new URLSearchParams({
      data: JSON.stringify({ ...reportData, fitTrack: fitResult.track, fitLabel: fitResult.label }),
      ...(sessionId && { session_id: sessionId }),
    });

    router.push(`/report?${queryParams.toString()}`);
  };

  // Calculate current question number based on answered questions
  const getProgressInfo = () => {
    let answered = 0;
    const isPhevOpen = sanityAnswers.drivetrainOpenness && sanityAnswers.drivetrainOpenness !== "BEV_ONLY";

    // Group 0: Drivetrain (1 question)
    if (sanityAnswers.drivetrainOpenness) answered++;

    // Group 1: Charging setup (chargingAccess, housingType, chargingAnchorType, backupOption)
    if (sanityAnswers.chargingAccess) answered++;
    if (sanityAnswers.housingType) answered++;
    if (chargingAnchorType !== null) answered++;
    if (backupOption !== null) answered++;

    // Group 2: Routine stability (schedule, towingNeeds, executionUncertaintyTolerance, downtimeRecoveryTolerance)
    if (sanityAnswers.schedule) answered++;
    if (sanityAnswers.towingNeeds) answered++;
    if (sanityAnswers.executionUncertaintyTolerance) answered++;
    if (sanityAnswers.downtimeRecoveryTolerance) answered++;

    // Group 3: Disruption tolerance (backup, chargingPlanB, dependency)
    if (sanityAnswers.backup) answered++;
    if (sanityAnswers.chargingPlanB) answered++;
    if (sanityAnswers.dependency) answered++;

    // Group 4: Location & Climate (zip, climate, winter)
    if (skipLocation || zipCode.trim()) answered++;
    if (climateSeasonality !== "UNKNOWN") answered++;
    if (climateSeasonality !== "COLD_WINTER" || winterLongDays !== "UNKNOWN") answered++;

    // PHEV payoff (conditional)
    if (isPhevOpen && sanityAnswers.pluginFrequency) answered++;

    const total = isPhevOpen ? 16 : 15;

    return { answered, total, currentGroup: "Routine check", currentOfGroup: answered, groupTotal: total };
  };

  const renderQuestions = () => {
    const coreAnswered =
      sanityAnswers.drivetrainOpenness &&
      sanityAnswers.chargingAccess &&
      sanityAnswers.housingType &&
      sanityAnswers.towingNeeds &&
      sanityAnswers.schedule &&
      sanityAnswers.backup &&
      sanityAnswers.chargingPlanB &&
      sanityAnswers.dependency &&
      sanityAnswers.executionUncertaintyTolerance &&
      sanityAnswers.downtimeRecoveryTolerance &&
      (skipLocation || zipCode.trim());

    // P0/P1: New required inputs
    const newInputsAnswered =
      chargingAnchorType !== null &&
      backupOption !== null;

    // Winter long days only required if COLD_WINTER selected
    const winterAnswered =
      climateSeasonality !== "COLD_WINTER" || winterLongDays !== "UNKNOWN";

    // Plug-in frequency required only when open to PHEV
    const pluginAnswered =
      sanityAnswers.drivetrainOpenness === "BEV_ONLY" ||
      sanityAnswers.pluginFrequency != null;

    const allAnswered = coreAnswered && newInputsAnswered && winterAnswered && pluginAnswered;

    const progress = getProgressInfo();

    return (
      <div className="p-6 space-y-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Quick routine check</h3>
          <p className="text-sm text-gray-600">
            ~16 questions to understand how a BEV or PHEV fits your situation
          </p>
          {/* P1: Progress indicator with group label */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.answered / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {progress.answered} of {progress.total}
            </span>
          </div>
        </div>

        {/* Region Selection - Prominent at top */}
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

        {/* GROUP 0: Drivetrain Preference */}
        <div className="border-l-4 border-indigo-500 pl-4 -ml-4">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-3">
            Drivetrain Preference
          </p>
        </div>

        {/* Question 0: Drivetrain Openness */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            Do you want a gas backup for long trips and unexpected days?
          </label>
          <div className="space-y-2">
            {[
              { value: "BEV_ONLY", label: "No — I want zero tailpipe emissions", sub: "Full battery electric only" },
              { value: "PHEV_OK", label: "Maybe — open to it if it fits better", sub: "Battery electric, but PHEV works too" },
              { value: "PHEV_PREFERRED", label: "Yes — gas safety net is important to me", sub: "I want range security on long trips" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswerChange("drivetrainOpenness", option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  sanityAnswers.drivetrainOpenness === option.value
                    ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* GROUP 1: Charging Setup */}
        <div className="border-l-4 border-blue-500 pl-4 -ml-4 mt-6">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">
            Charging Setup
          </p>
        </div>

        {/* Question 1: Primary Charging Access */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            What&apos;s your primary charging access?
          </label>
          <div className="space-y-2">
            {[
              { value: "home", label: "Dedicated home charging (L1/L2)" },
              { value: "apartment_shared", label: "Apartment/shared parking" },
              { value: "work_shared", label: "Workplace/shared" },
              { value: "public_mixed", label: "Public-only / mixed unreliable" }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswerChange("chargingAccess", option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  sanityAnswers.chargingAccess === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question: Housing / Parking Type */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            Where do you reliably park most nights?
          </label>
          <div className="space-y-2">
            {[
              { value: "house_garage", label: "House with garage", sub: "Easiest home charging setup" },
              { value: "house_driveway", label: "House with driveway", sub: "Level 1/2 outlet accessible" },
              { value: "apartment_assigned", label: "Apartment — assigned spot", sub: "May have charging options" },
              { value: "apartment_street", label: "Apartment / street parking", sub: "No dedicated overnight spot" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswerChange("housingType", option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  sanityAnswers.housingType === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* GROUP 2: Routine Stability */}
        <div className="border-l-4 border-green-500 pl-4 -ml-4 mt-6">
          <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-3">
            Routine Stability
          </p>
        </div>

        {/* Question 2: Schedule Predictability */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            How predictable is your schedule?
          </label>
          <div className="space-y-2">
            {[
              { value: "predictable", label: "Predictable" },
              { value: "variable", label: "Some variability" },
              { value: "unpredictable", label: "Often changes / unpredictable" }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswerChange("schedule", option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  sanityAnswers.schedule === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question: Towing Needs */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            Do you plan to tow a trailer or camper?
          </label>
          <div className="space-y-2">
            {[
              { value: "yes", label: "Yes, regularly", sub: "Frequent towing — significant range impact for BEV" },
              { value: "occasionally", label: "Occasionally", sub: "A few times a year" },
              { value: "no", label: "No", sub: "No towing needs" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswerChange("towingNeeds", option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  sanityAnswers.towingNeeds === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* GROUP 3: Disruption Tolerance */}
        <div className="border-l-4 border-amber-500 pl-4 -ml-4 mt-6">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-3">
            Disruption Tolerance
          </p>
        </div>

        {/* Question 3: Backup Tolerance */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            What&apos;s your backup tolerance?
          </label>
          <div className="space-y-2">
            {[
              { value: "easy", label: "Easy fallback (second vehicle / rentals)" },
              { value: "occasional", label: "Occasional fallback" },
              { value: "none", label: "No fallback (single vehicle)" }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswerChange("backup", option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  sanityAnswers.backup === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question: Charging Plan B */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            If your primary charger is busy or down, what&apos;s your plan?
          </label>
          <div className="space-y-2">
            {[
              { value: "another_home_charger", label: "Another outlet at home", sub: "Second charger or different outlet" },
              { value: "nearby_public", label: "Nearby public station", sub: "One I know and have used" },
              { value: "work_charger", label: "Charge at work", sub: "Reliable workplace access" },
              { value: "no_plan", label: "No backup plan", sub: "Haven't figured that out yet" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswerChange("chargingPlanB", option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  sanityAnswers.chargingPlanB === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Question 4: Infrastructure Dependency */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            What&apos;s your infrastructure dependency?
          </label>
          <div className="space-y-2">
            {[
              { value: "full_control", label: "Full control (private access)" },
              { value: "shared", label: "Shared chargers (apartment/work)" },
              { value: "public", label: "Public network reliance" }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswerChange("dependency", option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  sanityAnswers.dependency === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question 5: Execution-time uncertainty tolerance */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            When something doesn&apos;t start immediately (charging/app/session), how disruptive is that for you?
          </label>
          <div className="space-y-2">
            {[
              { value: "low", label: "Low tolerance", sub: "I need it to work reliably / delays stress me" },
              { value: "medium", label: "Medium", sub: "I can handle occasional hiccups" },
              { value: "high", label: "High tolerance", sub: "I'm fine troubleshooting or waiting sometimes" }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswerChange("executionUncertaintyTolerance", option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  sanityAnswers.executionUncertaintyTolerance === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Question 6: Downtime / recovery tolerance */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            If unexpected service downtime happens, how disruptive would that be to your routine?
          </label>
          <div className="space-y-2">
            {[
              { value: "low", label: "Low tolerance", sub: "Very disruptive / I rely on this vehicle daily" },
              { value: "medium", label: "Medium", sub: "Manageable with planning" },
              { value: "high", label: "High tolerance", sub: "I have flexibility or alternatives" }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswerChange("downtimeRecoveryTolerance", option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  sanityAnswers.downtimeRecoveryTolerance === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* GROUP 4: Location & Climate */}
        <div className="border-l-4 border-purple-500 pl-4 -ml-4 mt-6">
          <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-3">
            Location & Climate
          </p>
        </div>

        {/* Question 7: ZIP/Postcode */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            What&apos;s your {copy.labels.zip}?
          </label>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder={copy.helper.zipPlaceholder}
            maxLength={regionResolved === "UK" ? 8 : 5}
            disabled={skipLocation}
            className={`w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-600 focus:outline-none ${
              skipLocation ? "bg-gray-100 text-gray-400" : ""
            }`}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="skipLocation"
              checked={skipLocation}
              onChange={(e) => setSkipLocation(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="skipLocation" className="text-xs text-gray-500">
              Skip location (use region-based defaults)
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Used for climate and charging infrastructure context
          </p>
        </div>

        {/* P0/P1: Question 8 - Climate Seasonality */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            What&apos;s your area&apos;s climate like?
            {climateAutoInferred && (
              <span className="ml-2 text-xs font-normal text-blue-600">
                (auto-detected from {copy.labels.zip})
              </span>
            )}
          </label>
          <div className="space-y-2">
            {([
              { value: "MILD", label: "Mild year-round", sub: "Rarely below freezing" },
              { value: "COLD_WINTER", label: "Cold winters", sub: "Regular snow/ice or extended freezing periods" },
              { value: "HOT_SUMMER", label: "Hot summers", sub: "Extended periods above 95°F (35°C)" },
              { value: "MIXED", label: "Mixed seasons", sub: "Both cold winters and warm summers" },
              { value: "UNKNOWN", label: "Not sure", sub: "We'll use conservative assumptions" }
            ] as const).map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setClimateSeasonality(option.value);
                  setClimateAutoInferred(false); // User overrode
                }}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  climateSeasonality === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* P0/P1: Question 9 - Winter Long Days (conditional on COLD_WINTER) */}
        {climateSeasonality === "COLD_WINTER" && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              How often do you have long driving days in winter?
            </label>
            <div className="space-y-2">
              {([
                { value: "RARE", label: "Rarely", sub: "Occasional longer trips" },
                { value: "MONTHLY", label: "Monthly", sub: "A few long days each winter month" },
                { value: "WEEKLY", label: "Weekly", sub: "Regular long drives even in cold weather" },
                { value: "UNKNOWN", label: "Not sure", sub: "Hard to predict" }
              ] as const).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setWinterLongDays(option.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    winterLongDays === option.value
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* P0/P1: Question 10 - Charging Anchor */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            What&apos;s your primary charging anchor?
          </label>
          <div className="space-y-2">
            {([
              { value: "HOME", label: "Home charger", sub: "Your own dedicated charging spot" },
              { value: "WORK", label: "Work charger", sub: "Workplace charging you use regularly" },
              { value: "DESTINATION", label: "Regular destination", sub: "Gym, shopping center, etc. where you reliably charge" },
              { value: "PUBLIC_ANCHOR", label: "Public station I use regularly", sub: "A specific public charger you depend on" },
              { value: "NONE", label: "None - I find chargers as needed", sub: "No single anchor, opportunistic charging" }
            ] as const).map((option) => (
              <button
                key={option.value}
                onClick={() => setChargingAnchorType(option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  chargingAnchorType === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* P0/P1: Question 11 - Backup Option */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            Do you have a reliable backup charging option?
          </label>
          <div className="space-y-2">
            {([
              { value: "YES_RELIABLE", label: "Yes, reliable backup", sub: "Another charger I can always use" },
              { value: "MAYBE", label: "Maybe", sub: "There are options but I haven't tested them" },
              { value: "NONE", label: "No backup", sub: "If my primary fails, I'd need to find something" },
              { value: "UNKNOWN", label: "Not sure", sub: "Haven't thought about it" }
            ] as const).map((option) => (
              <button
                key={option.value}
                onClick={() => setBackupOption(option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  backupOption === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Question: Plug-in Frequency (PHEV payoff — shown when open to PHEV) */}
        {sanityAnswers.drivetrainOpenness && sanityAnswers.drivetrainOpenness !== "BEV_ONLY" && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              How often will you realistically plug in?
            </label>
            <p className="text-xs text-gray-500 -mt-1">
              PHEV value depends heavily on this — affects fuel savings estimate.
            </p>
            <div className="space-y-2">
              {[
                { value: "every_night", label: "Every night", sub: "Full benefit of electric miles" },
                { value: "few_times_week", label: "A few times a week", sub: "Good but partial benefit" },
                { value: "once_week", label: "Once a week or less", sub: "Mostly runs on gas" },
                { value: "rarely", label: "Honestly, rarely", sub: "Would pay premium without savings" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAnswerChange("pluginFrequency", option.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    sanityAnswers.pluginFrequency === option.value
                      ? "border-green-600 bg-green-50 text-green-900"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{option.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={handleContinueToWhy}
          disabled={!allAnswered}
          className={`w-full py-4 rounded-lg font-semibold transition-all ${
            allAnswered
              ? "bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-lg"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Continue
        </button>
      </div>
    );
  };

  const renderWhy = () => {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Quick question</h3>
          <p className="text-sm text-gray-600">
            What brought you here today?
          </p>
        </div>

        {/* WHY Choice Chips */}
        <div className="flex flex-wrap gap-3 justify-center">
          {WHY_CHOICES.map((choice) => (
            <button
              key={choice.value}
              onClick={() => handleWhySubmit(choice.value)}
              className="px-5 py-3 rounded-full text-sm font-medium bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              {choice.label}
            </button>
          ))}
        </div>

        {/* Skip option */}
        <div className="text-center pt-4">
          <button
            onClick={handleWhySkip}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Skip this
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Helps us tailor the results — no data stored
        </p>
      </div>
    );
  };

  const renderOutput = () => {
    const sentences = selectFrictionSentences(sanityAnswers as SanityCheckAnswers, regionResolved);
    const fitContext = calculateFitContext(sanityAnswers as SanityCheckAnswers);
    const copyText = sentences.join("\n");

    const isPhev = fitContext.track === "PHEV";
    const label = fitContext.label;

    // Verdict config
    const verdict = {
      "Good Fit": {
        bg: "bg-green-50 border-green-200",
        badge: "bg-green-100 text-green-800",
        icon: "✓",
        iconBg: "bg-green-500",
        headline: isPhev ? "A PHEV fits your situation well" : "An EV fits your routine well",
        summary: isPhev
          ? "Your setup, schedule, and driving needs are a strong match for a plug-in hybrid. The gas engine removes the main EV risks for your situation."
          : "Your home charging setup and schedule make this a low-friction transition. Most people in your situation adapt quickly.",
        cta: isPhev ? "Find PHEV matches for you →" : "Find EV matches for you →",
      },
      "Conditional": {
        bg: "bg-amber-50 border-amber-200",
        badge: "bg-amber-100 text-amber-800",
        icon: "~",
        iconBg: "bg-amber-500",
        headline: isPhev ? "A PHEV could work — with a few caveats" : "An EV could work — with some adjustments",
        summary: isPhev
          ? "Your situation is workable for a PHEV, but a couple of factors are worth thinking through before you commit."
          : "Your setup is workable, but a few things could create friction in the first few months. Worth knowing before you buy.",
        cta: isPhev ? "See which PHEVs suit you →" : "See which EVs suit your routine →",
      },
      "High Friction": {
        bg: "bg-red-50 border-red-200",
        badge: "bg-red-100 text-red-800",
        icon: "!",
        iconBg: "bg-red-500",
        headline: "Your current setup has real friction points",
        summary: isPhev
          ? "A standard EV would be difficult in your situation. A PHEV removes most of the risk — or you may want to wait until your charging situation changes."
          : "Based on your answers, a full BEV would require meaningful changes to your routine. A PHEV might be a better bridge.",
        cta: "See what would need to change →",
      },
    }[label];

    // Top 2-3 friction points (most relevant only)
    const topFrictions = sentences.slice(0, 3);

    return (
      <div className="p-6 space-y-5">

        {/* ── Verdict Card ── */}
        <div className={`rounded-xl border-2 p-4 ${verdict.bg}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full ${verdict.iconBg} text-white flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5`}>
              {verdict.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${verdict.badge}`}>
                  {label} · {isPhev ? "PHEV" : "BEV"}
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900 leading-snug">
                {verdict.headline}
              </h3>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                {verdict.summary}
              </p>
            </div>
          </div>
        </div>

        {/* ── What to watch for ── */}
        {topFrictions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              {label === "Good Fit" ? "Keep in mind" : "What to watch for"}
            </p>
            <ul className="space-y-2">
              {topFrictions.map((sentence, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                  <span>{sentence}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Primary CTA ── */}
        <button
          onClick={handleFinalSubmit}
          disabled={submitting}
          className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-lg transition-all disabled:opacity-50 text-sm"
        >
          {submitting ? "Loading..." : verdict.cta}
        </button>

        {/* ── Micro-feedback ── */}
        {showMicroFeedback && !feedbackGiven && (
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-sm text-gray-600">Does this feel right?</p>
            <div className="flex gap-2">
              <button onClick={() => handleMicroFeedback("up")} className="px-3 py-1 rounded-lg border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all text-base" aria-label="Yes">👍</button>
              <button onClick={() => handleMicroFeedback("down")} className="px-3 py-1 rounded-lg border border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all text-base" aria-label="No">👎</button>
            </div>
          </div>
        )}
        {feedbackGiven && (
          <p className="text-xs text-center text-green-700">Thanks — that helps us improve.</p>
        )}

        {/* ── Secondary actions ── */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => handleCopy(copyText)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showCopySuccess ? <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-600">Copied!</span></> : <><Copy className="w-4 h-4" /><span>Copy summary</span></>}
          </button>
          <button
            onClick={() => {
              trackEvent("satisfied_without_report", { why_choice: whyChoice, region: regionResolved });
              onClose();
            }}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            This answered my question
          </button>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {phase === "questions" ? "Quick Routine Check" : phase === "why" ? "Almost done" : "Your Situation"}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {phase === "questions" ? "~2 minutes • BEV + PHEV" : phase === "why" ? "One quick question" : "Copy and share on Reddit"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <motion.div
                key={phase}
                initial={{ opacity: 0, x: phase === "questions" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                {phase === "questions" ? renderQuestions() : phase === "why" ? renderWhy() : renderOutput()}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
