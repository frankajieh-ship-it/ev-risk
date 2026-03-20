"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTurnstile } from "@/hooks/useTurnstile";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Receipt, Megaphone } from "lucide-react";
import TrustMicrocopy from "@/components/TrustMicrocopy";
import ManualEntryModal, { type ManualVehicleData } from "@/components/ManualEntryModal";
import VehicleInputTabs from "@/components/VehicleInputTabs";
import VehicleRecommendations from "@/components/VehicleRecommendations";
import SavedScenariosList from "@/components/SavedScenariosList";
import LoginModal from "@/components/LoginModal";
import RoutineStep from "@/components/RoutineStep";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import PersonaCardsSection from "@/components/landing/PersonaCardsSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import UniqueAdvantageSection from "@/components/landing/UniqueAdvantageSection";
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

      {/* 2. Announcement Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-white text-sm">
          <Megaphone className="w-4 h-4 shrink-0" />
          <span className="font-medium">New: Dealer workspaces are live!</span>
          <span className="hidden sm:inline text-white/80">List your EV inventory and connect with buyers.</span>
          <Link href={isAuthenticated ? "/hub" : "/auth/login"} className="underline font-semibold hover:text-white/90 ml-1">
            Get started &rarr;
          </Link>
        </div>
      </div>

      {/* 3. Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 pt-8 pb-6 md:pt-16 md:pb-12">
          <div className="text-center max-w-4xl mx-auto">
            {/* H1 renders immediately (no opacity:0) so browser can measure LCP */}
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 md:mb-5">
              Analyze any EV deal{" "}
              <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                before you buy
              </span>
            </h1>

            <p className="text-base md:text-lg text-gray-600 mb-2 md:mb-3 max-w-2xl mx-auto">
              Paste a listing URL or VIN. Get a deal verdict, risk flags, and what to ask the seller — in seconds.
            </p>

            <p className="text-sm text-gray-500 mb-5 md:mb-6">
              Join thousands of EV shoppers making informed decisions
            </p>

            <div className="mb-6 md:mb-8">
              <TrustMicrocopy />
            </div>

            {/* CTAs */}
            {currentStep === "routine" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex flex-col items-center justify-center gap-4"
              >
                {/* Primary CTA — Deal Checker */}
                <a
                  href="/receipt"
                  onClick={() => trackCTAClick("listing_receipt")}
                  className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25 text-base w-full sm:w-auto text-center"
                >
                  Analyze a Deal →
                </a>

                {/* Secondary CTA — Routine fit check */}
                <button
                  onClick={() => {
                    trackCTAClick("start_fit_check");
                    document.getElementById("fit-check")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium"
                >
                  Or check if an EV fits your routine →
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Persona Value Prop Cards — Shoppers / Owners / Dealers */}
      {currentStep === "routine" && <PersonaCardsSection />}

      {/* 5. How OFFO Works */}
      {currentStep === "routine" && <HowItWorksSection variant="fit-check" />}

      {/* 6. Unique Advantage */}
      {currentStep === "routine" && <UniqueAdvantageSection />}

      {/* 7. Key Insight Quote */}
      {currentStep === "routine" && (
        <section className="max-w-4xl mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
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

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-center"
          >
            <a
              href="/receipt"
              onClick={() => trackEvent("clicked_listing_receipt")}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Receipt className="w-4 h-4" />
              Have a listing? Check if the deal is legit
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </motion.div>
        </section>
      )}

      {/* 8. EV Fit Check Wizard */}
      {/* Sample output preview card — shows what users get before they start */}
      {currentStep === "routine" && (
        <div className="max-w-sm mx-auto px-4 pb-2 -mt-4">
          <Link href="/demo/chevy-bolt-ev-green" className="block group">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Good Fit
                </span>
                <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">See full example →</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">2023 Chevy Bolt EV</p>
              <p className="text-xs text-gray-500 mb-2">Home charging · Mild climate · ~200 mi/wk</p>
              <div className="space-y-1">
                <p className="text-xs text-gray-600"><span className="font-medium text-gray-700">What breaks first:</span> Public dependency on long days</p>
                <p className="text-xs text-gray-600"><span className="font-medium text-gray-700">Plan B:</span> Chevy Equinox EV (more range buffer)</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      <section id="fit-check" className="py-12 md:py-20">
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
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Ready to check your EV fit?
              </h2>
              <p className="text-gray-500">
                Answer 4 quick questions. No signup needed.
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
