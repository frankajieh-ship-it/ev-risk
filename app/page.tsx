"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTurnstile } from "@/hooks/useTurnstile";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import ManualEntryModal, { type ManualVehicleData } from "@/components/ManualEntryModal";
import LoginModal from "@/components/LoginModal";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SampleReportPreview from "@/components/landing/SampleReportPreview";
import HeroFeatureStrip from "@/components/landing/HeroFeatureStrip";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import WhyTrustOffo from "@/components/landing/WhyTrustOffo";
import TrustBadge from "@/components/landing/TrustBadge";

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

  // Homepage inline URL input
  const [listingUrl, setListingUrl] = useState("");
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null);

  // Paste detection — normalize URL and show detected source label
  useEffect(() => {
    if (!listingUrl.trim()) { setDetectedDomain(null); return; }
    try {
      const url = new URL(listingUrl.trim());
      const host = url.hostname.replace(/^www\./, "");
      const path = url.pathname.toLowerCase();

      // Strip UTM params + tracking suffixes
      const clean = new URL(listingUrl.trim());
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid"].forEach(p => clean.searchParams.delete(p));

      let label: string | null = null;
      if (host.includes("cargurus.com")) label = "CarGurus listing detected ✓";
      else if (host.includes("cars.com")) label = "Cars.com listing detected ✓";
      else if (host.includes("autotrader.com")) label = "AutoTrader listing detected ✓";
      else if (host.includes("facebook.com") && path.includes("marketplace")) label = "Facebook Marketplace listing detected ✓";
      else if (path.includes("/inventory/") || path.includes("/used/") || path.includes("/vehicle/")) label = "Dealer listing detected ✓";

      setDetectedDomain(label);
    } catch {
      setDetectedDomain(null);
    }
  }, [listingUrl]);

  const handleHomePasteSubmit = () => {
    const trimmed = listingUrl.trim();
    if (!trimmed) return;
    trackEvent("listing_paste_submitted", { page_source: "homepage", text_length: trimmed.length });
    router.push(`/receipt?url=${encodeURIComponent(trimmed)}&src=homepage`);
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
    trackEvent("report_generation_started", {
      has_vehicle: !!vehicleData,
      schema_version: "v2",
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
      } catch (persistErr) {
        console.warn("[Report] DB persist failed:", persistErr);
      }

      // Navigate to report page with v2 data
      const params = new URLSearchParams({
        data: JSON.stringify(result),
      });
      router.push(`/report?${params.toString()}`);
    } catch (err) {
      console.warn("[Frontend] V2 score error:", err);
      trackEvent("report_generation_failed", {
        error: err instanceof Error ? err.message : "unknown",
        schema_version: "v2",
      });
      setGenerateError(err instanceof Error ? err.message : "An error occurred");
      // Go back to recommendations so user can retry
      setCurrentStep("recommendations");
    }
  };

  // Routine step handlers
  const handleRoutineComplete = (routine: MinimumViableRoutine) => {
    setRoutineData(routine);
    setCurrentStep("recommendations");
    try { sessionStorage.setItem("offo_routine_context", JSON.stringify(routine)); } catch {}
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
              Know if this used EV is worth your time{" "}
              <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                before the test drive
              </span>
            </h1>
            <p className="text-base md:text-lg text-gray-600 mb-6 md:mb-8 max-w-xl mx-auto">
              Paste any listing. Get a verdict, top risks, price context, and the seller questions that decide the deal.
            </p>
          </div>

          {/* Inline URL input */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-5">
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                value={listingUrl}
                onChange={(e) => setListingUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleHomePasteSubmit(); }}
                placeholder="Paste a CarGurus, AutoTrader, or Facebook Marketplace link"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                autoFocus
              />
              <button
                onClick={handleHomePasteSubmit}
                disabled={!listingUrl.trim()}
                className={`px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
                  listingUrl.trim()
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                Analyze
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {detectedDomain && (
              <p className="text-xs text-green-600 font-medium mb-2">{detectedDomain}</p>
            )}
            {/* Static trust badges */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>✓ Free verdict</span>
              <span>✓ No sign-up required</span>
              <span>✓ Built for used EV listings</span>
            </div>
            <TrustBadge />
          </div>

          <SampleReportPreview />
          <HeroFeatureStrip />

          {/* What happens next */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">After your analysis, you can:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { label: "Compare with another car", href: "/compare" },
                { label: "Save to Garage", href: "/shortlist" },
                { label: "Run EV Routine Check", href: "/receipt" },
                { label: "Unlock full analysis", href: "/receipt" },
              ].map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                >
                  → {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <HowItWorksSection variant="homepage" />

      {/* Auction Intelligence */}
      <section className="max-w-2xl mx-auto px-4 pb-6">
        <a
          href="/copart"
          className="block bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-px shadow-md hover:shadow-lg transition-shadow group"
        >
          <div className="bg-white rounded-[15px] px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0 text-lg">
                🔨
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-gray-900">Auction Bidder — free</p>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-orange-500 px-1.5 py-0.5 rounded-full leading-none">
                    NEW
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-snug">
                  Paste any Copart lot URL. Get salvage risk, ARV, repair cost breakdown, and max safe bid — instantly.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-orange-500 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </a>
      </section>

      {/* EV Routine Check — compact entry card */}
      <section className="max-w-2xl mx-auto px-4 pb-10">
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-gray-900 mb-0.5">Check if an EV fits your weekly routine</p>
            <p className="text-xs text-gray-500 leading-snug">
              Charging, winter, longest-day stress, and fallback planning · 3 quick questions
            </p>
          </div>
          <Link
            href="/receipt"
            className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Start →
          </Link>
        </div>
      </section>

      {/* Why trust OFFO */}
      <WhyTrustOffo />

      {/* Footer */}
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
