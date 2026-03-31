"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTurnstile } from "@/hooks/useTurnstile";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Route, Gavel } from "lucide-react";
import Link from "next/link";
import ManualEntryModal, { type ManualVehicleData } from "@/components/ManualEntryModal";
import LoginModal from "@/components/LoginModal";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import HowItWorksSection from "@/components/landing/HowItWorksSection";

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

  const scrollToPaste = () => {
    document.getElementById("paste-box")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => document.getElementById("listing-input")?.focus(), 400);
  };

  return (
    <div className="min-h-screen bg-white">
      <div id="turnstile-score" className="hidden" />
      <Header variant="homepage" />

      {/* ── Section 1: Hero ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: copy */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Free · No sign-up required
            </p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Get the second opinion that actually matters.
            </h1>
            <p className="text-base md:text-lg text-gray-600 mb-6 leading-relaxed">
              Paste any used car or Copart listing.<br />
              Instantly see routine fit, real risks, and what to ask the seller.
            </p>
            <button
              onClick={scrollToPaste}
              className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
            >
              Paste Listing → Get Free Report
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-gray-400 mt-3">
              Works with CarGurus, AutoTrader, Craigslist, Facebook Marketplace, Copart &amp; IAAI
            </p>
          </div>

          {/* Right: static sample report card */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-sm rounded-2xl shadow-xl border border-gray-100 bg-white p-5">
              <p className="text-[10px] text-gray-400 mb-3">Example result — not your listing</p>
              <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                CarGurus listing detected ✓
              </div>
              <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 text-sm font-semibold px-3 py-1.5 rounded-lg mb-4 ml-2">
                ● Conditional Buy
              </div>
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">⚠ Top risks</p>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-start gap-1.5"><span className="mt-0.5 w-1 h-1 rounded-full bg-yellow-400 shrink-0" />Battery at 81% health</li>
                  <li className="flex items-start gap-1.5"><span className="mt-0.5 w-1 h-1 rounded-full bg-yellow-400 shrink-0" />Priced 8% above market</li>
                  <li className="flex items-start gap-1.5"><span className="mt-0.5 w-1 h-1 rounded-full bg-yellow-400 shrink-0" />No service history on record</li>
                </ul>
              </div>
              <div className="border-t border-gray-100 pt-4 space-y-1.5">
                <p className="text-xs text-blue-600">→ Ask about battery test results</p>
                <p className="text-xs text-blue-600">→ Request full service records</p>
                <p className="text-xs text-blue-600">→ Is there flexibility on price?</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Trust Bar ─────────────────────────────────────── */}
      <div className="border-y border-gray-100 bg-gray-50 py-3">
        <p className="text-center text-xs text-gray-500">
          Used by serious EV shoppers · Powered by Auto.dev + NHTSA data · No sales pitch. Just honest analysis.
        </p>
      </div>

      {/* ── Section 3: How It Works ──────────────────────────────────── */}
      <HowItWorksSection variant="homepage" />

      {/* ── Section 4: Main Paste Box ────────────────────────────────── */}
      <section id="paste-box" className="py-10 md:py-16 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Analyze a listing</h2>
            <p className="text-sm text-gray-500 mb-4">Paste any used car or auction URL below.</p>
            <input
              id="listing-input"
              type="url"
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleHomePasteSubmit(); }}
              placeholder="Paste any used car or auction link here…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder-gray-400 mb-3"
            />
            {detectedDomain && (
              <p className="text-xs text-green-600 font-medium mb-3">{detectedDomain}</p>
            )}
            <button
              onClick={handleHomePasteSubmit}
              disabled={!listingUrl.trim()}
              className={`w-full px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                listingUrl.trim()
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Analyze Listing — It&apos;s Free
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Instant verdict + routine risks. No account needed.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 5: Feature Highlights ───────────────────────────── */}
      <section className="py-10 md:py-16">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* EV Routine Fit */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-4">
              <Route className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Buying an EV? Check if it actually fits your real life.
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Daily commute, apartment charging, winter range, hardest day.
            </p>
            <Link href="/receipt" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Run EV Routine Check →
            </Link>
          </div>

          {/* Copart & Salvage */}
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-6">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
              <Gavel className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Evaluating a salvage or auction vehicle?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Repair estimates, after-repair value, max safe bid, post-repair routine impact.
            </p>
            <Link href="/copart" className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors">
              Try Auction Bidder →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 6: Social Proof ──────────────────────────────────── */}
      <section className="py-10 md:py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { quote: "Saved $2,400 on a used Bolt after seeing hidden battery risk", attr: "Apartment owner, Chicago" },
            { quote: "Avoided a $6k repair on a salvage Ioniq 5 – the routine impact was a dealbreaker", attr: "Used-EV buyer" },
            { quote: "Compared 12 listings in one weekend and felt confident for the first time", attr: "First-time EV shopper" },
          ].map(({ quote, attr }) => (
            <div key={attr} className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-sm text-gray-700 italic mb-2">&ldquo;{quote}&rdquo;</p>
              <p className="text-xs text-gray-400">{attr}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 7: Final CTA ─────────────────────────────────────── */}
      <section className="py-16 md:py-24 text-center">
        <div className="max-w-lg mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to check a listing?</h2>
          <p className="text-sm text-gray-500 mb-6">Takes under 30 seconds. Free, no account needed.</p>
          <button
            onClick={scrollToPaste}
            className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-md"
          >
            Paste it here →
          </button>
        </div>
      </section>

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
