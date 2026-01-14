"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEventTracking } from "@/hooks/useEventTracking";
import {
  selectFrictionSentences,
  calculateFitContext,
  mapToScoringInput
  
} from "@/lib/sanity-check-logic";
import { CLOSING_LINE, type SanityCheckAnswers } from "@/lib/sanity-check-sentences";

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

type Phase = "questions" | "output";

export default function FitQuizModal({ isOpen, onClose, initialData }: FitQuizModalProps) {
  const router = useRouter();
  const { trackEvent } = useEventTracking();

  const [phase, setPhase] = useState<Phase>("questions");
  const [sanityAnswers, setSanityAnswers] = useState<Partial<SanityCheckAnswers>>({});
  const [zipCode, setZipCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase("questions");
      setSanityAnswers({
      executionUncertaintyTolerance: "medium",
      downtimeRecoveryTolerance: "medium"
    });
      setZipCode("");
      setSubmitting(false);
      setShowCopySuccess(false);
    }
  }, [isOpen]);

  const handleAnswerChange = (field: keyof SanityCheckAnswers, value: any) => {
    setSanityAnswers(prev => ({ ...prev, [field]: value }));
  };

  const handleContinueToOutput = () => {
    // Validate all 5 answers present
    if (!sanityAnswers.chargingAccess || !sanityAnswers.schedule ||
        !sanityAnswers.backup || !sanityAnswers.dependency || !zipCode.trim()) {
      alert("Please answer all questions");
      return;
    }

    // Validate ZIP code
    if (!/^\d{5}$/.test(zipCode)) {
      alert("Please enter a valid 5-digit ZIP code");
      return;
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
    });

    setPhase("output");
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

    // Map sanity-check answers to ScoringInput
    const mappedInputs = mapToScoringInput(sanityAnswers as SanityCheckAnswers, zipCode);

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

    // Track report generation
    trackEvent("report_generated", {
      source: "sanity-check",
      has_battery_info: initialData?.batteryInfoAvailable !== undefined ? initialData.batteryInfoAvailable : true,
      missing_fields_count: initialData?.missingFields?.length || 0,
    });

    console.log('[Sanity Check] Submitting data:', reportData);

    // Navigate to report
    const queryParams = new URLSearchParams({
      data: JSON.stringify(reportData),
    });

    router.push(`/report?${queryParams.toString()}`);
  };

  const renderQuestions = () => {
    const allAnswered =
      sanityAnswers.chargingAccess &&
      sanityAnswers.schedule &&
      sanityAnswers.backup &&
      sanityAnswers.dependency &&
      sanityAnswers.executionUncertaintyTolerance &&
      sanityAnswers.downtimeRecoveryTolerance &&
      zipCode.trim();

    return (
      <div className="p-6 space-y-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Quick routine check</h3>
          <p className="text-sm text-gray-600">
            7 questions to understand how an EV might fit your situation
          </p>
        </div>

        {/* Question 1: Primary Charging Access */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            What's your primary charging access?
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

        {/* Question 3: Backup Tolerance */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            What's your backup tolerance?
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

        {/* Question 4: Infrastructure Dependency */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            What's your infrastructure dependency?
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
            When something doesn't start immediately (charging/app/session), how disruptive is that for you?
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

        {/* Question 7: ZIP Code */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            What's your ZIP code?
          </label>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="12345"
            pattern="\d{5}"
            maxLength={5}
            className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-600 focus:outline-none"
          />
          <p className="text-xs text-gray-500">
            Used for climate and charging infrastructure context
          </p>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinueToOutput}
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

  const renderOutput = () => {
    const sentences = selectFrictionSentences(sanityAnswers as SanityCheckAnswers);
    const fitContext = calculateFitContext(sanityAnswers as SanityCheckAnswers);
    const copyText = sentences.join("\n") + "\n\n" + CLOSING_LINE;

    return (
      <div className="p-6 space-y-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">In situations like yours:</h3>

        {/* Friction Bullets */}
        <ul className="space-y-3 mb-4">
          {sentences.map((sentence, idx) => (
            <li key={idx} className="text-gray-700 flex items-start gap-2 text-sm leading-relaxed">
              <span className="text-blue-600 mt-1 flex-shrink-0">•</span>
              <span>{sentence}</span>
            </li>
          ))}
        </ul>

        {/* Closing Line */}
        <p className="text-sm text-gray-600 italic leading-relaxed border-t pt-4 mt-4">
          {CLOSING_LINE}
        </p>

        {/* Optional Fit Context (de-emphasized) */}
        <p className="text-xs text-gray-500">
          Overall fit context: <span className="font-medium">{fitContext}</span>
        </p>

        {/* Copy Button */}
        <button
          onClick={() => handleCopy(copyText)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-all"
        >
          {showCopySuccess ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5 text-gray-600" />
              <span className="font-semibold text-gray-700">Copy to clipboard</span>
            </>
          )}
        </button>

        {/* Continue to OFFO Button */}
        <button
          onClick={handleFinalSubmit}
          disabled={submitting}
          className="w-full py-4 rounded-lg font-semibold bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-lg transition-all disabled:opacity-50"
        >
          {submitting ? "Loading..." : "Continue to OFFO check"}
        </button>
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
                    {phase === "questions" ? "Quick Routine Check" : "Your Situation"}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {phase === "questions" ? "5 questions • ~30 seconds" : "Copy and share on Reddit"}
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
                initial={{ opacity: 0, x: phase === "output" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                {phase === "questions" ? renderQuestions() : renderOutput()}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
