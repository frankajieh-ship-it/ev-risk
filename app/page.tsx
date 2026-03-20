"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTurnstile } from "@/hooks/useTurnstile";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import ManualEntryModal, { type ManualVehicleData } from "@/components/ManualEntryModal";
import VehicleInputTabs from "@/components/VehicleInputTabs";
import VehicleRecommendations from "@/components/VehicleRecommendations";
import SavedScenariosList from "@/components/SavedScenariosList";
import LoginModal from "@/components/LoginModal";
import RoutineStep from "@/components/RoutineStep";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

import { type ManualEntryData } from "@/components/ManualEntryInlineForm";
import type { MinimumViableRoutine } from "@/types/v2";

type WizardStep = "routine" | "recommendations" | "vehicle_manual" | "generating";

export default function Home() {
  const router = useRouter();

  // Forward auth redirects (PKCE code or hash fragments) to the callback page
  useEffect(() => {
    // PKCE flow: Supabase redirects to Site URL with ?code= query param
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.location.href = `/auth/callback?code=${encodeURIComponent(code)}`;
      return;
    }
    // Legacy/fallback: hash fragment with error or access_token
    const hash = window.location.hash;
    if (hash && (hash.includes("error=") || hash.includes("access_token="))) {
      window.location.href = `/auth/callback${hash}`;
    }
    // Store invite token for attribution through fit flow
    const inviteToken = params.get("invite_token");
    if (inviteToken) {
      try { sessionStorage.setItem("offo_invite_token", inviteToken); } catch { /* ignore */ }
    }
  }, []);

  // Auth state for saved scenarios
  const { isAuthenticated } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Track visitor on homepage
  useVisitorTracking({
    enabled: true,
    trackPageViews: true,
    trackSessionDuration: true,
  });

  const { trackButtonClick, trackUrlAutofillAttempt, trackEvent, trackCTAClick, trackLandingView, trackIntakeStarted } = useEventTracking();
  const { startSession, completeSession } = useSessionTracking();

  const { execute: executeTurnstile } = useTurnstile({
    containerId: "turnstile-score",
    action: "score-submit",
  });

  // Fire landing_view on mount
  useEffect(() => {
    trackLandingView();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Homepage inline paste box
  const [listingText, setListingText] = useState("");

  const handleHomePasteSubmit = () => {
    const trimmed = listingText.trim();
    if (trimmed.length < 5) return;
    trackEvent("listing_paste_submitted", { page_source: "homepage", text_length: trimmed.length });
    try {
      sessionStorage.setItem("offo_listing_text", trimmed);
      sessionStorage.setItem("offo_page_source", "homepage");
    } catch { /* ignore */ }
    router.push("/receipt");
  };

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
      // Turnstile bot protection
      const turnstileToken = await executeTurnstile();

      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema_version: "v2",
          routine,
          turnstileToken: turnstileToken || undefined,
          leave_this_empty: "",
          ...(vehicleData ? {
            model: vehicleData.model,
            year: vehicleData.year,
            currentMileage: vehicleData.currentMileage ?? 0,
          } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Turnstile rejection
        if (response.status === 403 && result.captcha_required) {
          throw new Error("Verification failed. Please refresh and try again.");
        }
        throw new Error(result.error || result.details?.join(", ") || "Scoring failed");
      }

      // Auto-persist report to database (non-blocking)
      try {
        const persistRes = await fetch("/api/report/free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportData: result }),
        });
        if (persistRes.ok) {
          const { reportId } = await persistRes.json();
          result._persisted_report_id = reportId;
        }
      } catch {
        // Non-blocking — report still renders even if DB insert fails
      }

      // Navigate to report page with v2 data
      const params = new URLSearchParams({
        data: JSON.stringify(result),
      });
      router.push(`/report?${params.toString()}`);
    } catch (err) {
      console.warn("[Frontend] V2 score error:", err);
      setGenerateError(err instanceof Error ? err.message : "An error occurred");
      // Go back to recommendations so user can retry
      setCurrentStep("recommendations");
    }
  };

  // Routine step handlers
  const handleRoutineComplete = (routine: MinimumViableRoutine) => {
    setRoutineData(routine);
    setCurrentStep("recommendations");
    trackButtonClick("routine_step_complete", "homepage");
    trackIntakeStarted();

    // Session tracking: start session + complete with routine inputs
    startSession({ source: "homepage" }).then((sid) => {
      if (sid) {
        completeSession(
          {
            chargingAccess: routine.charging_access,
            weeklyMiles: routine.weekly_miles,
            climate: routine.climate,
            longestDayPattern: routine.longest_day_pattern,
          },
          {}
        ).catch(() => {});
      }
    }).catch(() => {});
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
      <div id="turnstile-score" className="hidden" />

      {/* 1. Header with persona nav */}
      <Header variant="homepage" />

      {/* 3. Hero — inline paste box */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-2xl mx-auto px-4 pt-10 pb-6 md:pt-20 md:pb-10">
          <div className="text-center">
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 md:mb-4">
              Get a quick second opinion{" "}
              <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                on any car deal
              </span>
            </h1>
            <p className="text-base md:text-lg text-gray-600 mb-6 md:mb-8 max-w-xl mx-auto">
              Paste a listing URL, VIN, or any car ad text. Get a deal verdict, risk flags, and what to ask the seller — in seconds. Free, no sign-up.
            </p>
          </div>

          {/* Inline paste box */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-5">
            <textarea
              value={listingText}
              onChange={(e) => setListingText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleHomePasteSubmit(); }}
              placeholder="Paste a CarGurus, AutoTrader, or Facebook Marketplace link — or any listing text, VIN, or car description"
              rows={4}
              maxLength={8000}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-3 text-gray-900 placeholder-gray-400"
            />
            <button
              onClick={handleHomePasteSubmit}
              disabled={listingText.trim().length < 5}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                listingText.trim().length >= 5
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Get Quick Opinion
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">Free · No sign-up · Works on CarGurus, AutoTrader, FB Marketplace &amp; more</p>
          </div>

          {/* Soft secondary link to routine check */}
          <p className="text-center text-sm text-gray-500 mt-5">
            Buying an EV?{" "}
            <button
              onClick={() => {
                trackCTAClick("start_fit_check");
                document.getElementById("fit-check")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Also check if it fits your driving routine →
            </button>
          </p>
        </div>
      </section>

      {/* Divider before EV routine wizard */}
      {currentStep === "routine" && (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">EV Routine Check — Advanced</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <p className="text-center text-sm text-gray-500 mt-3">
            Already know the car? Check if an EV actually fits your charging routine before you commit.
          </p>
        </div>
      )}

      <section id="fit-check" className="pb-12 md:pb-20">
        <div className="max-w-3xl mx-auto px-4">
          {/* Wizard heading — only on routine step */}
          {currentStep === "routine" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8"
            >
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                Will this EV fit your real routine?
              </h2>
              <p className="text-gray-500 text-sm">
                3 quick questions. No sign-up needed.
              </p>
            </motion.div>
          )}

          {/* Step Indicator */}
          {currentStep !== "generating" && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-3">
                <div className={`flex items-center gap-2 ${currentStep === "routine" ? "text-blue-600" : "text-gray-500"}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep === "routine" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                  }`}>1</span>
                  <span className="text-sm font-medium hidden sm:inline">Your Routine</span>
                </div>
                <div className="w-8 h-px bg-gray-300" />
                <div className={`flex items-center gap-2 ${currentStep === "recommendations" || currentStep === "vehicle_manual" ? "text-blue-600" : "text-gray-500"}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep === "recommendations" || currentStep === "vehicle_manual" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                  }`}>2</span>
                  <span className="text-sm font-medium hidden sm:inline">Find Your EV</span>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Content */}
          {/* Step 1: Routine */}
          {currentStep === "routine" && (
            <RoutineStep
              onComplete={handleRoutineComplete}
            />
          )}

          {/* Step 2a: Vehicle Recommendations */}
          {currentStep === "recommendations" && routineData && (
            <VehicleRecommendations
              routine={routineData}
              onSelectVehicle={(vehicle) => generateV2Report(routineData, vehicle)}
              onSwitchToManual={() => setCurrentStep("vehicle_manual")}
              onBack={() => setCurrentStep("routine")}
            />
          )}

          {/* Step 2b: Manual Vehicle Entry (fallback) */}
          {currentStep === "vehicle_manual" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Back to recommendations */}
              <div className="mb-4">
                <button
                  onClick={() => setCurrentStep("recommendations")}
                  className="flex items-center text-gray-500 hover:text-gray-700 transition-colors text-sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to recommendations
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
        </div>
      </section>

      {/* 9. Saved Scenarios — authenticated users only */}
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

      {/* 10. Footer */}
      <Footer />

      {/* Modals */}
      <ManualEntryModal
        isOpen={manualEntryOpen}
        onClose={() => setManualEntryOpen(false)}
        onSubmit={handleManualEntry}
        missingFields={manualEntryMissingFields}
      />
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
