"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Receipt } from "lucide-react";
import TrustMicrocopy from "@/components/TrustMicrocopy";
import ManualEntryModal, { type ManualVehicleData } from "@/components/ManualEntryModal";
import VehicleInputTabs from "@/components/VehicleInputTabs";
import SavedScenariosList from "@/components/SavedScenariosList";
import LoginModal from "@/components/LoginModal";
import RoutineStep from "@/components/RoutineStep";
import { type ManualEntryData } from "@/components/ManualEntryInlineForm";
import type { MinimumViableRoutine } from "@/types/v2";

type WizardStep = "routine" | "vehicle" | "generating";

export default function Home() {
  const router = useRouter();

  // Auth state for saved scenarios
  const { isAuthenticated, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Track visitor on homepage
  useVisitorTracking({
    enabled: true,
    trackPageViews: true,
    trackSessionDuration: true,
  });

  const { trackButtonClick, trackUrlAutofillAttempt, trackEvent, trackCTAClick, trackLandingView, trackIntakeStarted } = useEventTracking();

  // Fire landing_view on mount
  useEffect(() => {
    trackLandingView();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // V2 Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>("routine");
  const [routineData, setRoutineData] = useState<MinimumViableRoutine | null>(null);

  // Manual Entry Modal (for URL parse failures)
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualEntryMissingFields, setManualEntryMissingFields] = useState<string[]>([]);

  // URL Extraction
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extractedVehicleData, setExtractedVehicleData] = useState<any>(null);
  const [showExtractedData, setShowExtractedData] = useState(false);

  // Generating state
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Call /api/score with v2 schema and navigate to report
  const generateV2Report = async (
    routine: MinimumViableRoutine,
    vehicleData?: { model: string; year: number; currentMileage?: number }
  ) => {
    setCurrentStep("generating");
    setGenerateError(null);

    trackEvent("v2_score_submit", {
      has_vehicle: !!vehicleData,
      charging_access: routine.charging_access,
      climate: routine.climate,
    });

    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema_version: "v2",
          routine,
          ...(vehicleData ? {
            model: vehicleData.model,
            year: vehicleData.year,
            currentMileage: vehicleData.currentMileage ?? 0,
          } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details?.join(", ") || "Scoring failed");
      }

      // Navigate to report page with v2 data
      const params = new URLSearchParams({
        data: JSON.stringify(result),
      });
      router.push(`/report?${params.toString()}`);
    } catch (err) {
      console.error("[Frontend] V2 score error:", err);
      setGenerateError(err instanceof Error ? err.message : "An error occurred");
      // Go back to vehicle step so user can retry
      setCurrentStep("vehicle");
    }
  };

  // Routine step handlers
  const handleRoutineComplete = (routine: MinimumViableRoutine) => {
    setRoutineData(routine);
    setCurrentStep("vehicle");
    trackButtonClick("routine_step_complete", "homepage");
    trackIntakeStarted();
  };

  const handleRoutineSkipVehicle = (routine: MinimumViableRoutine) => {
    setRoutineData(routine);
    trackButtonClick("routine_skip_vehicle", "homepage");
    trackIntakeStarted();
    generateV2Report(routine);
  };

  // Vehicle step: URL extraction
  const handleExtractListing = async (url: string) => {
    trackButtonClick("home_scan_submit", "homepage");
    setExtracting(true);
    setExtractError(null);
    setExtractWarnings([]);

    try {
      const response = await fetch("/api/extract-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();

      if (!result.success) {
        if (result.needsMoreInfo && result.missing) {
          setManualEntryMissingFields(result.missing);
          setManualEntryOpen(true);
          trackUrlAutofillAttempt(url, false, null, "Parse failure - manual entry required");
        } else {
          setExtractError(result.error || "Failed to extract listing data");
          setExtractWarnings(result.warnings || []);
          trackUrlAutofillAttempt(url, false, null, result.error);
        }
        return;
      }

      trackUrlAutofillAttempt(url, true, result.data);

      const mileage = result.data.mileage || 0;
      setExtractedVehicleData({
        model: result.data.model || "",
        year: result.data.year || new Date().getFullYear(),
        currentMileage: mileage,
        price: result.data.price || 0,
        vin: result.data.vin || "",
      });
      setShowExtractedData(true);
      trackButtonClick("url_scan_success", "homepage");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setExtractError(errorMsg);
      trackUrlAutofillAttempt(url, false, null, errorMsg);
    } finally {
      setExtracting(false);
    }
  };

  // Vehicle step: manual entry from modal (URL parse failure fallback)
  const handleManualEntry = async (manualData: ManualVehicleData) => {
    const vehicleData = {
      model: `${manualData.make} ${manualData.model}`,
      year: manualData.year,
      currentMileage: manualData.mileage || 0,
    };
    setManualEntryOpen(false);
    trackButtonClick("manual_entry_success", "homepage");
    generateV2Report(routineData!, vehicleData);
  };

  // Vehicle step: inline manual entry
  const handleManualEntryInline = async (manualData: ManualEntryData) => {
    trackEvent("manual_entry_submit", {
      context: "homepage",
      has_mileage: !!manualData.mileage,
      has_battery_info: manualData.batteryInfoAvailable,
      missing_fields_count: manualData.missingFields.length,
    });

    const vehicleData = {
      model: `${manualData.make} ${manualData.model}`,
      year: manualData.year,
      currentMileage: manualData.mileage || 0,
    };
    generateV2Report(routineData!, vehicleData);
  };

  // Vehicle step: confirm extracted data → generate report
  const handleConfirmExtracted = () => {
    setShowExtractedData(false);
    generateV2Report(routineData!, {
      model: extractedVehicleData.model,
      year: extractedVehicleData.year,
      currentMileage: extractedVehicleData.currentMileage,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Brand */}
            <div>
              <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                EV-Risk™
              </div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">by OFFO Lab</div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <a
                href="/receipt"
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Receipt className="w-4 h-4" />
                <span className="hidden sm:inline">Listing Receipt</span>
                <span className="sm:hidden">Receipt</span>
              </a>
              <a
                href="/blog"
                className="hidden sm:block text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Insights
              </a>
              {isAuthenticated ? (
                <button
                  onClick={() => logout()}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Compact for mobile */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 pt-6 pb-4 md:pt-12 md:pb-8">
          <div className="text-center max-w-4xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 md:mb-6"
            >
              Find out if an EV{" "}
              <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                fits your routine
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-base md:text-lg text-gray-600 mb-4 md:mb-6 max-w-2xl mx-auto"
            >
              Get a fit verdict, what breaks first, and a fallback plan — based on how you actually drive and charge.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-4 md:mb-6"
            >
              <TrustMicrocopy />
            </motion.div>

            {/* "What you get" pills */}
            {currentStep === "routine" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap items-center justify-center gap-2"
              >
                {["Fit verdict", "What breaks first", "Plan B fallback"].map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full"
                  >
                    {item}
                  </span>
                ))}
              </motion.div>
            )}

            {/* Primary CTA */}
            {currentStep === "routine" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3"
              >
                <button
                  onClick={() => {
                    trackCTAClick("start_fit_check");
                    document.getElementById("routine-form")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25 text-base"
                >
                  Start EV fit check
                </button>
                <a
                  href="/receipt"
                  onClick={() => trackCTAClick("listing_receipt")}
                  className="px-6 py-3 text-blue-600 font-medium rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors text-sm"
                >
                  Turn a listing into a receipt
                </a>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Step Indicator */}
      {currentStep !== "generating" && (
        <div className="max-w-3xl mx-auto px-4 mb-6">
          <div className="flex items-center justify-center gap-3">
            <div className={`flex items-center gap-2 ${currentStep === "routine" ? "text-blue-600" : "text-gray-500"}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === "routine" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
              }`}>1</span>
              <span className="text-sm font-medium hidden sm:inline">Your Routine</span>
            </div>
            <div className="w-8 h-px bg-gray-300" />
            <div className={`flex items-center gap-2 ${currentStep === "vehicle" ? "text-blue-600" : "text-gray-500"}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === "vehicle" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
              }`}>2</span>
              <span className="text-sm font-medium hidden sm:inline">Vehicle</span>
              <span className="text-xs text-gray-500 hidden sm:inline">(optional)</span>
            </div>
          </div>
        </div>
      )}

      {/* Wizard Content */}
      <section id="routine-form" className="max-w-3xl mx-auto px-4 pb-6 md:pb-12">
        {/* Step 1: Routine */}
        {currentStep === "routine" && (
          <RoutineStep
            onComplete={handleRoutineComplete}
            onSkipVehicle={handleRoutineSkipVehicle}
          />
        )}

        {/* Step 2: Vehicle */}
        {currentStep === "vehicle" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Back to routine */}
            <div className="mb-4">
              <button
                onClick={() => setCurrentStep("routine")}
                className="flex items-center text-gray-500 hover:text-gray-700 transition-colors text-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to routine
              </button>
            </div>

            {generateError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {generateError}
              </div>
            )}

            <VehicleInputTabs
              onExtract={handleExtractListing}
              extracting={extracting}
              error={extractError}
              warnings={extractWarnings}
              extractedData={showExtractedData ? extractedVehicleData : null}
              onConfirm={handleConfirmExtracted}
              onReset={() => {
                setExtractedVehicleData(null);
                setShowExtractedData(false);
                setExtractError(null);
              }}
              onManualSubmit={handleManualEntryInline}
            />

            {/* Skip vehicle option */}
            <div className="mt-4 text-center">
              <button
                onClick={() => generateV2Report(routineData!)}
                className="text-sm text-gray-500 hover:text-blue-600 underline transition-colors"
              >
                Skip vehicle — see routine fit only
              </button>
            </div>
          </motion.div>
        )}

        {/* Generating state */}
        {currentStep === "generating" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-6">
              <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Analyzing your routine fit...</h3>
            <p className="text-gray-600">Building your personalized report</p>
          </motion.div>
        )}
      </section>

      {/* Key Insight Section - Only show on routine step */}
      {currentStep === "routine" && (
        <section className="max-w-4xl mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-gradient-to-br from-blue-50 to-green-50 border border-blue-100 rounded-2xl p-8 text-center"
          >
            <p className="text-xl font-semibold text-gray-900 mb-3">
              Most EV regret isn&apos;t about range.
            </p>
            <p className="text-lg text-gray-700 mb-2">
              It&apos;s about charging predictability and routine fit.
            </p>
            <p className="text-sm text-gray-600">
              (Based on real owner experiences)
            </p>
          </motion.div>

          {/* Listing Receipt secondary link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-6 text-center"
          >
            <a
              href="/receipt"
              onClick={() => trackEvent("clicked_listing_receipt")}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Receipt className="w-4 h-4" />
              Have a listing link? Try Listing Receipt
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </motion.div>
        </section>
      )}

      {/* Manual Entry Modal (URL parse failure fallback) */}
      <ManualEntryModal
        isOpen={manualEntryOpen}
        onClose={() => setManualEntryOpen(false)}
        onSubmit={handleManualEntry}
        missingFields={manualEntryMissingFields}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      {/* Saved Scenarios List - Only shown to authenticated users */}
      {isAuthenticated && currentStep === "routine" && (
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <SavedScenariosList
            maxItems={3}
            onSelectScenario={(scenario) => {
              const params = new URLSearchParams({
                data: JSON.stringify({
                  model: scenario.vehicle_model,
                  year: scenario.vehicle_year,
                  ...scenario.inputs,
                }),
              });
              router.push(`/report?${params.toString()}`);
            }}
          />
        </section>
      )}
    </div>
  );
}