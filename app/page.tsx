"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTurnstile } from "@/hooks/useTurnstile";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { ArrowRight, Star, ChevronDown, ChevronUp, Mail, Menu, X, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import LoginModal from "@/components/LoginModal";
import ManualEntryModal, { type ManualVehicleData } from "@/components/ManualEntryModal";
import VehicleInputTabs from "@/components/VehicleInputTabs";
import VehicleRecommendations from "@/components/VehicleRecommendations";
import SavedScenariosList from "@/components/SavedScenariosList";
import RoutineStep from "@/components/RoutineStep";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FeaturedDeals from "@/components/landing/FeaturedDeals";
import { type ManualEntryData } from "@/components/ManualEntryInlineForm";
import { getReceiptHistory } from "@/lib/receipt-history";
import type { MinimumViableRoutine } from "@/types/v2";

type WizardStep = "routine" | "recommendations" | "vehicle_manual" | "generating";

interface ExtractedVehicleData {
  model: string;
  year: number;
  currentMileage: number;
  price: number;
  vin: string;
}

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

  const { isAuthenticated } = useAuth();
  const { execute: executeTurnstile } = useTurnstile({
    containerId: "turnstile-score",
    action: "score-submit",
  });
  const { startSession, completeSession } = useSessionTracking();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [totalReceipts, setTotalReceipts] = useState<number | null>(null);
  const [localReceiptCount, setLocalReceiptCount] = useState(0);

  useEffect(() => {
    fetch("/api/homepage/stats")
      .then((r) => r.json())
      .then((d) => { if (d.success && d.total_receipts > 0) setTotalReceipts(d.total_receipts); })
      .catch(() => {}); // non-critical, fall back to static text
  }, []);

  // Read local receipt history for return-visitor nudge
  useEffect(() => {
    setLocalReceiptCount(getReceiptHistory().length);
  }, []);

  // Track visitor on homepage
  useVisitorTracking({
    enabled: true,
    trackPageViews: true,
    trackSessionDuration: true,
  });

  const { trackEvent, trackLandingView, trackButtonClick, trackUrlAutofillAttempt, trackIntakeStarted } = useEventTracking();

  // Fire landing_view on mount
  useEffect(() => {
    trackLandingView();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Homepage inline URL input
  const [listingUrl, setListingUrl] = useState("");

  // Derived paste detection — computed inline, no useEffect needed
  const { detectedDomain, detectedType } = useMemo(() => {
    const trimmed = listingUrl.trim();
    if (!trimmed) return { detectedDomain: null, detectedType: null };

    // Bare Copart lot number (6–12 digits, no spaces)
    if (/^\d{6,12}$/.test(trimmed)) {
      return { detectedDomain: "Copart lot number detected ✓", detectedType: "auction" as const };
    }

    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, "");
      const path = url.pathname.toLowerCase();

      if (host.includes("copart.com")) return { detectedDomain: "Copart auction detected ✓", detectedType: "auction" as const };
      if (host.includes("iaai.com") || host.includes("iaaiservices.com")) return { detectedDomain: "IAAI auction detected ✓", detectedType: "auction" as const };
      if (host.includes("manheim.com")) return { detectedDomain: "Manheim auction detected ✓", detectedType: "auction" as const };
      if (host.includes("cargurus.com")) return { detectedDomain: "CarGurus listing detected ✓", detectedType: "listing" as const };
      if (host.includes("cars.com")) return { detectedDomain: "Cars.com listing detected ✓", detectedType: "listing" as const };
      if (host.includes("autotrader.com")) return { detectedDomain: "AutoTrader listing detected ✓", detectedType: "listing" as const };
      if (host.includes("facebook.com") && path.includes("marketplace")) return { detectedDomain: "Facebook Marketplace listing detected ✓", detectedType: "listing" as const };
      if (path.includes("/inventory/") || path.includes("/used/") || path.includes("/vehicle/")) return { detectedDomain: "Dealer listing detected ✓", detectedType: "listing" as const };

      return { detectedDomain: null, detectedType: null };
    } catch {
      return { detectedDomain: null, detectedType: null };
    }
  }, [listingUrl]);

  const handleHomePasteSubmit = () => {
    const trimmed = listingUrl.trim();
    if (!trimmed) return;
    trackEvent("listing_paste_submitted", { page_source: "homepage", detected_type: detectedType, text_length: trimmed.length });
    // Route auction URLs directly to the auction bidder, all others to receipt
    if (detectedType === "auction") {
      const isBareLot = /^\d{6,12}$/.test(trimmed);
      router.push(isBareLot
        ? `/copart?lot=${encodeURIComponent(trimmed)}&src=homepage`
        : `/copart?url=${encodeURIComponent(trimmed)}&src=homepage`
      );
    } else {
      router.push(`/receipt?url=${encodeURIComponent(trimmed)}&src=homepage`);
    }
  };

  // ── V2 Wizard state ──────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<WizardStep>("routine");
  const [routineData, setRoutineData] = useState<MinimumViableRoutine | null>(null);

  // Manual Entry Modal (for URL parse failures)
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualEntryMissingFields, setManualEntryMissingFields] = useState<string[]>([]);

  // URL Extraction
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extractedVehicleData, setExtractedVehicleData] = useState<ExtractedVehicleData | null>(null);
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

  // Routine step complete → advance to recommendations
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
      model: extractedVehicleData!.model,
      year: extractedVehicleData!.year,
      currentMileage: extractedVehicleData!.currentMileage,
    });
  };

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: "How do I know the battery condition of a used EV?", a: "OFFO pulls EPA-rated range, cross-references mileage and year against known degradation curves, and flags if the listing's claimed range is suspiciously optimistic. For deeper analysis, always request a battery health report or OBDII scan from the seller." },
    { q: "Can I charge an EV at an apartment without a garage?", a: "Yes — many apartment dwellers rely on Level 2 public chargers or workplace charging. OFFO's routine fit check accounts for your charging access and flags if a given vehicle's range makes apartment charging viable for your daily pattern." },
    { q: "Can I drive long distances with an EV?", a: "Absolutely. Most modern EVs have 250–350 mi EPA range. OFFO maps your longest single-day drive against the vehicle's real-world range (accounting for climate and highway speed) and tells you if you'll need a mid-trip charge stop." },
    { q: "What are the benefits of buying a used EV?", a: "Used EVs often cost 30–50% less than new, still qualify for up to $4,000 federal used-EV tax credits, and have fewer mechanical parts to fail. OFFO helps you avoid the pitfalls — high-degradation batteries, open recalls, and overpriced salvage vehicles." },
    { q: "What does OFFO's OFFO Score actually mean?", a: "The OFFO Score is a 0–100 composite of routine fit (does this vehicle work for your daily life?), value assessment (is the price fair for the condition?), and risk flags (recalls, battery health, title issues). Higher is better — 80+ is a confident buy." },
  ];


  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div id="turnstile-score" className="hidden" />

      {/* ── Dark hero wrapper ────────────────────────────────────────── */}
      <div className="bg-[#0d1117]">
        {/* Dark nav */}
        <nav className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur-md border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
            <Link href="/">
              <Image src="/offo-logo.jpg" alt="OFFO" width={200} height={103} className="w-24 sm:w-28 h-auto" priority />
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/receipt" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Receipt Check</Link>
              <Link href="/" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Routine Fit</Link>
              <Link href="/copart" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Copart Arbitrage</Link>
              <Link href="/pricing" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Pricing</Link>
              <Link href="/blog" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Blog</Link>
              <Link href="/workspace/garage" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Garage</Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-3">
                {isAuthenticated ? (
                  <Link href="/workspace" className="text-[0.8125rem] font-medium text-white/70 hover:text-white transition-colors">Dashboard</Link>
                ) : (
                  <button onClick={() => setShowLoginModal(true)} className="text-[0.8125rem] font-medium text-white/70 hover:text-white transition-colors">Sign in</button>
                )}
              </div>
              <button
                onClick={() => { document.getElementById("listing-input")?.focus(); window.scrollTo({ top: 300, behavior: "smooth" }); }}
                className="px-4 py-1.5 rounded-full bg-[#00d97e] text-[#0d1117] text-[0.8125rem] font-semibold hover:bg-[#00f090] transition-colors whitespace-nowrap"
              >
                Get started free
              </button>
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
                aria-label="Toggle menu"
              >
                {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile dropdown */}
          {mobileNavOpen && (
            <div className="md:hidden border-t border-white/[0.06] bg-[#0d1117]">
              <div className="px-5 py-4 space-y-1">
                {[
                  { href: "/receipt", label: "Receipt Check" },
                  { href: "/", label: "Routine Fit" },
                  { href: "/copart", label: "Copart Arbitrage" },
                  { href: "/pricing", label: "Pricing" },
                  { href: "/blog", label: "Blog" },
                  { href: "/workspace/garage", label: "Garage" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileNavOpen(false)}
                    className="block py-2.5 text-sm font-medium text-white/70 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="border-t border-white/[0.06] pt-3 mt-2">
                  {isAuthenticated ? (
                    <Link href="/workspace" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm font-medium text-white/70 hover:text-white">Dashboard</Link>
                  ) : (
                    <button onClick={() => { setShowLoginModal(true); setMobileNavOpen(false); }} className="py-2 text-sm font-medium text-white/70 hover:text-white">Sign in</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-5 pt-20 pb-16 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-white/10 bg-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d97e] animate-pulse" />
            <span className="text-xs font-medium text-white/70 tracking-wide">AI-powered EV decision intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-5 tracking-tight" style={{ lineHeight: "1.05" }}>
            Know before you buy.<br />
            <span className="text-[#00d97e]">Paste any listing.</span>
          </h1>

          <p className="text-base md:text-lg text-white/50 mb-10 max-w-xl mx-auto" style={{ lineHeight: "1.6" }}>
            OFFO analyzes used EV listings for hidden risks, verifies negotiation opportunities, and tells you if the car actually fits your life — in under 30 seconds.
          </p>

          {/* Input row */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <input
              id="listing-input"
              type="url"
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleHomePasteSubmit(); }}
              placeholder="https://cargurus.com/Cars/listingDetail.action?listing=..."
              className="flex-1 px-5 py-4 rounded-xl bg-white/[0.07] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/60 focus:ring-1 focus:ring-[#00d97e]/30 transition-colors"
              autoFocus
            />
            <button
              onClick={handleHomePasteSubmit}
              disabled={!listingUrl.trim()}
              className={`px-7 py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                listingUrl.trim()
                  ? "bg-[#00d97e] text-[#0d1117] hover:bg-[#00f090]"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              Analyze <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {detectedDomain && (
            <p className={`text-xs font-medium mt-3 ${detectedType === "auction" ? "text-orange-400" : "text-[#00d97e]"}`}>
              {detectedDomain}
              {detectedType === "auction" && " — Auction analysis"}
              {detectedType === "listing" && " — Listing analysis"}
            </p>
          )}

          <p className="text-xs text-white/30 mt-4">Free analysis · Save to your garage · Track deals over time</p>
        </section>

        {/* Return visitor nudge — shown when local receipt history exists but not signed in */}
        {!isAuthenticated && localReceiptCount > 0 && (
          <div className="max-w-2xl mx-auto px-4 pb-4">
            <div className="bg-[#161b22] border border-white/[0.08] rounded-xl px-4 py-3 flex items-center justify-between gap-4">
              <p className="text-sm text-white/60">
                You have <span className="text-white/80 font-medium">{localReceiptCount} saved report{localReceiptCount !== 1 ? "s" : ""}</span> — sign in to access from any device
              </p>
              <Link href="/auth/login?redirect=/workspace" className="text-xs font-semibold text-[#00d97e] hover:text-[#00c970] whitespace-nowrap transition-colors">
                Sign in free →
              </Link>
            </div>
          </div>
        )}
      </div>
      {/* ── End dark hero ─────────────────────────────────────────────── */}

      {/* Original Header hidden — replaced above for homepage */}
      <div className="hidden"><Header variant="homepage" /></div>

      {/* ── Section 2: Trust Bar ─────────────────────────────────────── */}
      <div className="bg-[#0d1117] border-t border-white/[0.06] py-3">
        <p className="text-center text-xs text-white/40 tracking-wide">
          Used by serious EV shoppers · Powered by Auto.dev + NHTSA data · No sales pitch. Just honest analysis.
        </p>
      </div>

      {/* ── Section: EV Routine Wizard ───────────────────────────────── */}
      {currentStep === "routine" && (
        <div className="max-w-2xl mx-auto px-4 py-6 bg-[#0d1117]">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider whitespace-nowrap">
              EV Routine Check
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <p className="text-center text-sm text-white/40 mt-3">
            Check if an EV actually fits your charging routine before you commit.
          </p>
        </div>
      )}

      <section id="fit-check" className="pb-12 md:pb-20 bg-[#0d1117]">
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
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                Check if this EV fits your routine
              </h2>
              <p className="text-white/40 text-sm">
                3 quick questions. No sign-up needed.
              </p>
            </motion.div>
          )}

          {/* Step Indicator */}
          {currentStep !== "generating" && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-3">
                <div className={`flex items-center gap-2 ${currentStep === "routine" ? "text-[#00d97e]" : "text-white/30"}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep === "routine" ? "bg-[#00d97e] text-[#0d1117]" : "bg-white/10 text-white/40"
                  }`}>1</span>
                  <span className="text-sm font-medium hidden sm:inline">Your Routine</span>
                </div>
                <div className="w-8 h-px bg-white/10" />
                <div className={`flex items-center gap-2 ${currentStep === "recommendations" || currentStep === "vehicle_manual" ? "text-[#00d97e]" : "text-white/30"}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep === "recommendations" || currentStep === "vehicle_manual" ? "bg-[#00d97e] text-[#0d1117]" : "bg-white/10 text-white/40"
                  }`}>2</span>
                  <span className="text-sm font-medium hidden sm:inline">Find Your EV</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Routine */}
          {currentStep === "routine" && (
            <RoutineStep onComplete={handleRoutineComplete} dark />
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
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-6">
                <svg className="w-8 h-8 text-[#00d97e] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Analyzing your routine fit...</h3>
              <p className="text-white/40">Building your personalized report</p>
            </motion.div>
          )}
        </div>
      </section>

      {/* Saved Scenarios — authenticated users only */}
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

      {/* ── Section 3: How It Works ──────────────────────────────────── */}
      <HowItWorksSection variant="homepage" dark />

      {/* ── Section: Featured Deals ──────────────────────────────────── */}
      <FeaturedDeals />

      {/* ── Section 6: Social Proof ──────────────────────────────────── */}
      <section className="section bg-[#111827]">
        {/* Testimonial cards */}
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            {totalReceipts !== null
              ? `${totalReceipts.toLocaleString()}+ vehicles analyzed`
              : "5.0 stars from 200+ reviews"}
          </h2>
          <p className="text-sm text-white/40 text-center mb-8">Real OFFO users, real decisions.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Marcus T.", location: "Chicago, IL", photo: "/car-bolt-ev.webp", quote: "Saved $2,400 on a used Bolt after seeing the hidden battery risk flag. Would never have caught it myself.", tag: "Used-EV buyer" },
              { name: "Priya S.", location: "Austin, TX", photo: "/car-ioniq5.webp", quote: "Avoided a $6k repair on a salvage Ioniq 5 — the routine impact score was a dealbreaker the seller couldn't argue with.", tag: "First EV purchase" },
              { name: "Jordan R.", location: "Denver, CO", photo: "/car-tesla-model3.webp", quote: "Compared 12 listings in one weekend. First time I've ever felt confident walking into a dealership...", tag: "EV switcher" },
              { name: "Alicia M.", location: "Seattle, WA", photo: "/car-hyundai-kona.webp", quote: "The apartment charging check alone was worth it. OFFO told me exactly which vehicles fit my situation.", tag: "Apartment renter" },
            ].map(({ name, location, photo, quote, tag }) => (
              <div key={name} className="overflow-hidden flex flex-col rounded-xl border border-white/10 bg-white/5">
                <div className="h-36 overflow-hidden bg-white/5">
                  <Image src={photo} alt={name} width={300} height={144} className="w-full h-full object-cover object-center" />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => <Star key={s} className="w-3 h-3 text-[#00d97e] fill-[#00d97e]" />)}
                    </div>
                    <span className="text-[0.6875rem] font-bold text-white/20 tracking-wide">G</span>
                  </div>
                  <p className="text-xs font-semibold text-white mb-1">{name}</p>
                  <p className="text-xs text-white/50 leading-relaxed flex-1">{quote}</p>
                  <p className="text-xs text-white/25 mt-2">{tag} · {location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Coming Soon: EV Mechanic Finder ─────────────────────────── */}
      <section className="py-10 md:py-14 bg-[#0d1117]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-8 overflow-hidden">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Coming Soon</span>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex-1">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Find a Trusted EV Mechanic Near You</h2>
                <p className="text-sm text-white/40 leading-relaxed max-w-lg">
                  We&apos;re building a verified network of EV-specialist mechanics. Get pre-purchase inspections, battery health checks, and ongoing maintenance from shops that know EVs.
                </p>
              </div>
              <div className="flex gap-2 shrink-0 select-none pointer-events-none" aria-hidden>
                {["EV Specialist · Austin, TX", "Battery Expert · Denver, CO", "Tesla Certified · Seattle, WA"].map((label) => (
                  <div key={label} className="blur-sm bg-white/5 rounded-xl border border-white/10 p-3 w-36">
                    <div className="w-8 h-8 rounded-full bg-orange-400/20 mb-2" />
                    <div className="h-2 bg-white/10 rounded mb-1 w-3/4" />
                    <div className="h-2 bg-white/5 rounded w-full mb-2" />
                    <p className="text-xs text-white/20">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button disabled className="px-5 py-2.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl text-sm font-semibold cursor-not-allowed">
                Find a Mechanic — Coming Soon
              </button>
              <p className="text-xs text-white/25">Launching soon — mechanics can join at <span className="font-medium text-white/40">/mechanics/join</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 8: FAQ + Contact ──────────────────────────────────── */}
      <section className="py-10 md:py-16 bg-[#111827]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="lg:w-64 shrink-0">
              <h2 className="text-2xl font-bold text-white mb-3" style={{ lineHeight: "var(--leading-snug)" }}>Your questions,<br />answered</h2>
              <p className="text-sm text-white/40 mb-1">Can&apos;t find what you&apos;re looking for?</p>
              <p className="text-sm text-white/40 mb-5">Check out our <Link href="/receipt" className="text-[#00d97e] hover:text-[#00f090] transition-colors">Analyze tool</Link> or reach out.</p>
              <a
                href="mailto:hello@offo.app"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00d97e] hover:bg-[#00f090] text-[#0d1117] text-sm font-semibold rounded-xl transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact us
              </a>
            </div>

            <div className="flex-1 divide-y divide-white/[0.07]">
              {faqs.map((faq, i) => (
                <div key={i} className="py-4">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between text-left gap-4"
                  >
                    <span className="text-sm font-medium text-white/80">{faq.q}</span>
                    {openFaq === i
                      ? <ChevronUp className="w-4 h-4 text-white/30 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
                    }
                  </button>
                  {openFaq === i && (
                    <p className="mt-3 text-sm text-white/40 leading-relaxed">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 9: Final CTA ─────────────────────────────────────── */}
      <section className="section text-center bg-[#0d1117] border-t border-white/[0.06]">
        <div className="max-w-lg mx-auto px-4">
          <h2 className="text-3xl font-bold text-white mb-3" style={{ lineHeight: "var(--leading-snug)" }}>Ready to check a listing?</h2>
          <p className="text-[0.9375rem] text-white/40 mb-8">Takes under 30 seconds. Free, no account needed.</p>
          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); document.getElementById("listing-input")?.focus(); }}
            className="px-8 py-3.5 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-xl hover:bg-[#00f090] transition-colors"
          >
            Paste it here →
          </button>
        </div>
      </section>

      {/* ── Data Sources Trust Bar ──────────────────────────────────── */}
      <section className="bg-[#0d1117] border-t border-white/[0.06] py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-0">
            <div className="md:pr-8 md:border-r md:border-white/10 shrink-0 text-center md:text-left">
              <p className="text-[#00d97e] font-semibold text-xs uppercase tracking-widest leading-tight mb-1">Powered by</p>
              <p className="text-white/70 font-semibold text-sm leading-tight">trusted automotive data</p>
            </div>
            <div className="flex flex-wrap justify-center md:justify-start items-center md:pl-8 gap-1">
              {[
                { name: "Auto.dev" },
                { name: "NHTSA" },
                { name: "EPA Fuel Economy" },
                { name: "NREL EV charging" },
                { name: "AAA EV Studies" },
              ].map((src, i) => (
                <div key={src.name} className="flex items-center">
                  <span className="text-[0.8125rem] font-medium text-white/30 whitespace-nowrap px-2 py-1">{src.name}</span>
                  {i < 4 && <span className="text-white/10 hidden sm:inline">·</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {/* Modals */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      {manualEntryOpen && (
        <ManualEntryModal
          isOpen={manualEntryOpen}
          missingFields={manualEntryMissingFields}
          onClose={() => setManualEntryOpen(false)}
          onSubmit={handleManualEntry}
        />
      )}
    </div>
  );
}
