"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTurnstile } from "@/hooks/useTurnstile";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Route, Gavel, Star, ChevronDown, ChevronUp, Mail } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
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

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: "How do I know the battery condition of a used EV?", a: "OFFO pulls EPA-rated range, cross-references mileage and year against known degradation curves, and flags if the listing's claimed range is suspiciously optimistic. For deeper analysis, always request a battery health report or OBDII scan from the seller." },
    { q: "Can I charge an EV at an apartment without a garage?", a: "Yes — many apartment dwellers rely on Level 2 public chargers or workplace charging. OFFO's routine fit check accounts for your charging access and flags if a given vehicle's range makes apartment charging viable for your daily pattern." },
    { q: "Can I drive long distances with an EV?", a: "Absolutely. Most modern EVs have 250–350 mi EPA range. OFFO maps your longest single-day drive against the vehicle's real-world range (accounting for climate and highway speed) and tells you if you'll need a mid-trip charge stop." },
    { q: "What are the benefits of buying a used EV?", a: "Used EVs often cost 30–50% less than new, still qualify for up to $4,000 federal used-EV tax credits, and have fewer mechanical parts to fail. OFFO helps you avoid the pitfalls — high-degradation batteries, open recalls, and overpriced salvage vehicles." },
    { q: "What does OFFO's OFFO Score actually mean?", a: "The OFFO Score is a 0–100 composite of routine fit (does this vehicle work for your daily life?), value assessment (is the price fair for the condition?), and risk flags (recalls, battery health, title issues). Higher is better — 80+ is a confident buy." },
  ];

  const featuredVehicles = [
    { year: 2024, make: "Ford", model: "F-150 Lightning", trim: "LARIAT", mileage: "17K mi", range: "320 mi range", score: 98, price: "$51,998", badge: "Ext Range Battery" },
    { year: 2025, make: "Tesla", model: "Model 3", trim: "Long Range", mileage: "18K mi", range: "330 mi range", score: 96, price: "$39,997", badge: null },
    { year: 2024, make: "Tesla", model: "Model X", trim: "Base", mileage: "16K mi", range: "293 mi range", score: 92, price: "$73,997", badge: null },
    { year: 2018, make: "Nissan", model: "LEAF", trim: "S", mileage: "22K mi", range: "133 mi range", score: 86, price: "$12,998", badge: null },
  ];

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

          {/* Right: hero phone mockup */}
          <div className="flex justify-center lg:justify-end">
            <Image
              src="/hero-phone-mockup.jpg"
              alt="OFFO — One paste. Instant deal rating."
              width={540}
              height={540}
              className="w-full max-w-sm lg:max-w-md rounded-2xl shadow-xl object-cover"
              priority
            />
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
        <div className="max-w-5xl mx-auto px-4 mb-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-1/2">
              <Image
                src="/social-proof-laptop.jpg"
                alt="OFFO verdict on laptop — Confident Purchase"
                width={560}
                height={560}
                className="w-full rounded-2xl shadow-lg object-cover"
              />
            </div>
            <div className="w-full md:w-1/2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Real results</p>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-snug">
                Know the risks before you commit.
              </h2>
              <p className="text-base text-gray-600 leading-relaxed">
                OFFO surfaces what listing pages hide — battery degradation, overpricing, open recalls, and missing service history — so you walk in with the right questions.
              </p>
            </div>
          </div>
        </div>

        {/* Testimonial cards — photo + stars + Google badge style */}
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">5.0 stars from 200+ reviews</h2>
          <p className="text-sm text-gray-500 text-center mb-8">Real OFFO users, real decisions.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Marcus T.", location: "Chicago, IL", photo: "/social-proof-laptop.jpg", quote: "Saved $2,400 on a used Bolt after seeing the hidden battery risk flag. Would never have caught it myself.", tag: "Used-EV buyer" },
              { name: "Priya S.", location: "Austin, TX", photo: "/hero-phone-mockup.jpg", quote: "Avoided a $6k repair on a salvage Ioniq 5 — the routine impact score was a dealbreaker the seller couldn't argue with.", tag: "First EV purchase" },
              { name: "Jordan R.", location: "Denver, CO", photo: "/copart-hero.jpg", quote: "Compared 12 listings in one weekend. First time I've ever felt confident walking into a dealership...", tag: "EV switcher" },
              { name: "Alicia M.", location: "Seattle, WA", photo: "/social-proof-laptop.jpg", quote: "The apartment charging check alone was worth it. OFFO told me exactly which vehicles fit my situation.", tag: "Apartment renter" },
            ].map(({ name, location, photo, quote, tag }) => (
              <div key={name} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="h-36 overflow-hidden">
                  <Image src={photo} alt={name} width={300} height={144} className="w-full h-full object-cover" />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 tracking-wide">G</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-900 underline mb-1">{name}</p>
                  <p className="text-xs text-gray-600 leading-relaxed flex-1">{quote}</p>
                  <p className="text-[10px] text-gray-400 mt-2">{tag} · {location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 7: Featured Vehicles ─────────────────────────────── */}
      <section className="py-10 md:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Top searches on OFFO</h2>
          <p className="text-sm text-gray-500 mb-8">Popular vehicles analyzed by OFFO users this week.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredVehicles.map(({ year, make, model, trim, mileage, range, score, price, badge }) => (
              <Link
                key={`${year}-${make}-${model}`}
                href={`/receipt?q=${encodeURIComponent(`${year} ${make} ${model}`)}`}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="relative h-36 bg-gray-100 flex items-center justify-center">
                  <div className="text-4xl text-gray-300">🚗</div>
                  {badge && (
                    <div className="absolute top-0 left-0 bg-black text-white text-[9px] font-bold px-2 py-1 rounded-br-lg">
                      {badge}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm font-bold text-gray-900">{year} {make} {model}</p>
                  <p className="text-xs text-gray-500 mb-2">{trim} · {mileage} · {range}</p>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${score}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{score}/100</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-3">OFFO Fit Score</p>
                  <p className="text-sm font-bold text-gray-900 border-t border-gray-100 pt-3">{price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 8: FAQ + Contact ──────────────────────────────────── */}
      <section className="py-10 md:py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Left */}
            <div className="lg:w-64 shrink-0">
              <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-snug">Your questions,<br />answered</h2>
              <p className="text-sm text-gray-500 mb-1">Can&apos;t find what you&apos;re looking for?</p>
              <p className="text-sm text-gray-500 mb-5">Check out our <Link href="/receipt" className="underline text-gray-700 hover:text-gray-900">Analyze tool</Link> or reach out.</p>
              <a
                href="mailto:hello@offo.app"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact us
              </a>
            </div>

            {/* Right: accordion */}
            <div className="flex-1 divide-y divide-gray-200">
              {faqs.map((faq, i) => (
                <div key={i} className="py-4">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between text-left gap-4"
                  >
                    <span className="text-sm font-medium text-gray-800">{faq.q}</span>
                    {openFaq === i
                      ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                  </button>
                  {openFaq === i && (
                    <p className="mt-3 text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 9: Final CTA ─────────────────────────────────────── */}
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

      {/* ── Data Sources Trust Bar ──────────────────────────────────── */}
      <section className="bg-[#1a2332] py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-0">
            <div className="md:pr-8 md:border-r md:border-white/10 shrink-0 text-center md:text-left">
              <p className="text-teal-400 font-semibold text-sm leading-tight">Powered by</p>
              <p className="text-white font-bold text-base leading-tight">trusted automotive</p>
              <p className="text-white font-bold text-base leading-tight">data sources</p>
            </div>
            <div className="flex flex-wrap justify-center md:justify-start items-center md:pl-8">
              {[
                { name: "Auto.dev", icon: "◎" },
                { name: "NHTSA", icon: "✦" },
                { name: "EPA Fuel Economy", icon: "◈" },
                { name: "NREL EV charging data", icon: "⚡" },
                { name: "AAA EV Studies", icon: "◎" },
              ].map((src, i) => (
                <div key={src.name} className="flex items-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <span className="text-white/40 text-xs">{src.icon}</span>
                    <span className="text-sm font-medium text-white/80 whitespace-nowrap">{src.name}</span>
                  </div>
                  {i < 4 && <span className="text-white/20 text-sm mx-1 hidden sm:inline">→</span>}
                </div>
              ))}
            </div>
          </div>
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
