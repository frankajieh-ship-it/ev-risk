"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTurnstile } from "@/hooks/useTurnstile";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronUp, Mail, Menu, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import LoginModal from "@/components/LoginModal";
import ManualEntryModal, { type ManualVehicleData } from "@/components/ManualEntryModal";
import VehicleInputTabs from "@/components/VehicleInputTabs";
import VehicleRecommendations from "@/components/VehicleRecommendations";
import RoutineStep from "@/components/RoutineStep";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import UniqueAdvantageSection from "@/components/landing/UniqueAdvantageSection";
import FeaturedDeals from "@/components/landing/FeaturedDeals";
import { type ManualEntryData } from "@/components/ManualEntryInlineForm";
import { getReceiptHistory } from "@/lib/receipt-history";
import { anonGarageCount } from "@/lib/anon-garage";
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

  const { isAuthenticated, isDealer } = useAuth();
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

  // Homepage URL/VIN input (URL-first; detects VIN automatically)
  const [homeInput, setHomeInput] = useState("");
  const isVinInput = /^[A-HJ-NPR-Z0-9]{17}$/i.test(homeInput.trim());
  const isUrlInput = /^https?:\/\/.+/.test(homeInput.trim());
  const homeInputValid = isVinInput || isUrlInput;

  const handleHomeSubmit = () => {
    const val = homeInput.trim();
    if (!val) return;
    if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(val)) {
      trackEvent("vin_submit_homepage", { page_source: "homepage" });
      router.push(`/receipt?vin=${encodeURIComponent(val.toUpperCase())}&src=homepage`);
    } else {
      trackEvent("url_submit_homepage", { page_source: "homepage" });
      try { sessionStorage.setItem("offo_page_source", "homepage"); } catch {}
      router.push(`/receipt?url=${encodeURIComponent(val)}&src=homepage`);
    }
  };

  // ── V2 Wizard state ──────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<WizardStep>("routine");
  const [routineData, setRoutineData] = useState<MinimumViableRoutine | null>(null);
  const [shortlistCount, setShortlistCount] = useState(0);

  useEffect(() => {
    setShortlistCount(anonGarageCount());
  }, []);

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
          trackUrlAutofillAttempt(url, false, undefined, "Parse failure - manual entry required");
        } else {
          setExtractError(result.error || "Failed to extract listing data");
          setExtractWarnings(result.warnings || []);
          trackUrlAutofillAttempt(url, false, undefined, result.error);
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
      trackUrlAutofillAttempt(url, false, undefined, errorMsg);
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
    { q: "Is OFFO a Carfax alternative for used EVs?", a: "Unlike Carfax, OFFO checks if the EV actually fits your life — not just its history." },
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
              <Link href="/deals" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Deal Watch</Link>
              <Link href="/news" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">EV News</Link>
              <Link href="/blog" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Blog</Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-3">
                {isDealer ? (
                  <Link href="/dealer" className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] border border-white/[0.10] text-white/70 rounded-lg text-[0.8125rem] font-medium hover:bg-white/[0.10] transition-colors">
                    Dealer Portal
                  </Link>
                ) : (
                  <Link href="/for-dealers" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">For Dealers</Link>
                )}
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
                  { href: "/deals", label: "Deal Watch" },
                  { href: "/news", label: "EV News" },
                  { href: "/blog", label: "Blog" },
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
                <div className="border-t border-white/[0.06] pt-3 mt-2 space-y-1">
                  {isDealer ? (
                    <Link href="/dealer" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm font-medium text-[#00d97e] hover:text-white">Dealer Portal</Link>
                  ) : (
                    <Link href="/for-dealers" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm font-medium text-white/60 hover:text-white">For Dealers</Link>
                  )}
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
          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-5 tracking-tight" style={{ lineHeight: "1.05" }}>
            Know before you buy.<br />
            <span className="text-[#00d97e]">Paste any listing.</span>
          </h1>

          <p className="text-base md:text-lg text-white/50 mb-5 max-w-xl mx-auto" style={{ lineHeight: "1.6" }}>
            Instantly see open recalls, battery health estimate, market price vs. comparables, and 3 copy-paste negotiation scripts — for that exact listing. Full VIN &amp; title history coming soon.
          </p>

          <p className="text-sm text-white/30 mb-10 max-w-xl mx-auto">
            Found a CarGurus listing? Paste it to analyze and get a verdict.
          </p>

          {/* URL / VIN input row */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <input
              id="listing-input"
              type="text"
              value={homeInput}
              onChange={(e) => setHomeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && homeInputValid) handleHomeSubmit(); }}
              placeholder="Paste a listing URL or 17-character VIN"
              className="flex-1 px-5 py-4 rounded-xl bg-white/[0.07] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/60 focus:ring-1 focus:ring-[#00d97e]/30 transition-colors"
              autoFocus
            />
            <button
              onClick={handleHomeSubmit}
              disabled={!homeInputValid}
              className={`px-7 py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                homeInputValid
                  ? "bg-[#00d97e] text-[#0d1117] hover:bg-[#00f090]"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              Analyze <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {isVinInput && (
            <p className="text-xs text-[#00d97e] mt-3">VIN detected — click Analyze to autofill</p>
          )}
          {isUrlInput && (
            <p className="text-xs text-[#00d97e] mt-3">Listing URL detected — we&apos;ll extract the details</p>
          )}

          <p className="text-xs text-white/30 mt-4">
            <Link href="/receipt" className="text-white/40 hover:text-white/60 underline underline-offset-2 transition-colors">
              No URL or VIN? Enter details manually →
            </Link>
          </p>

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

      {/* ── Section: Dual entry point CTA ────────────────────────────── */}
      <div className="bg-[#0d1117] border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-4 py-5 grid grid-cols-2 gap-3">
          {/* Left: reinforce listing analysis */}
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-4">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Have a listing?</p>
            <p className="text-sm text-white/80 font-medium leading-snug">Paste the URL or VIN above</p>
            <p className="text-xs text-white/35 mt-1">Get a risk verdict in seconds</p>
          </div>
          {/* Right: quiz entry point */}
          <button
            onClick={() => {
              setCurrentStep("routine");
              setTimeout(() => {
                document.getElementById("fit-check")?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            }}
            className="bg-[#00d97e]/10 border border-[#00d97e]/25 rounded-xl px-4 py-4 text-left hover:bg-[#00d97e]/15 hover:border-[#00d97e]/40 transition-colors group"
          >
            <p className="text-xs font-semibold text-[#00d97e]/70 uppercase tracking-wider mb-1">Not sure yet?</p>
            <p className="text-sm text-white/80 font-medium leading-snug group-hover:text-white transition-colors">60-second EV quiz</p>
            <p className="text-xs text-white/35 mt-1">Find EVs that fit your life →</p>
          </button>
        </div>
      </div>

      {/* ── Section: EV Routine Wizard ───────────────────────────────── */}
      {currentStep === "routine" && (
        <div className="max-w-2xl mx-auto px-4 py-6 bg-[#0d1117]">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider whitespace-nowrap">
              Find your fit in 60 seconds
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <p className="text-center text-sm text-white/60 mt-3 font-medium">
            Unlike Carfax, OFFO checks if the EV actually fits your life — not just its history.
          </p>
          <p className="text-center text-xs text-white/35 mt-1">
            3 questions. No sign-up. Personalized vehicle match.
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
              shortlistCount={shortlistCount}
              onShortlistSave={() => setShortlistCount((c) => c + 1)}
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

      {/* ── Section 3: How It Works ──────────────────────────────────── */}
      <HowItWorksSection variant="homepage" dark />

      {/* ── Section: What OFFO checks ────────────────────────────────── */}
      <UniqueAdvantageSection />

      {/* ── Section: Scan the Listing ───────────────────────────────── */}
      <section className="bg-[#0d1117] py-20 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Label */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00d97e]/10 border border-[#00d97e]/20 text-xs font-semibold text-[#00d97e] uppercase tracking-widest">
              New
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-3">
            Paste the listing. OFFO reads it for you.
          </h2>
          <p className="text-white/50 text-center text-base max-w-xl mx-auto mb-14">
            Drop a CarGurus, AutoTrader, or Cars.com URL and OFFO automatically pulls the price, mileage, VIN, and listing photos — then runs an AI analysis before you ever call the dealer.
          </p>

          {/* 3-step visual flow */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
            {/* Step 1 */}
            <div className="relative rounded-2xl border border-white/[0.08] bg-[#161b22] p-6">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center mb-4">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </div>
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">Step 1</p>
              <h3 className="text-base font-semibold text-white mb-2">Paste any listing URL</h3>
              <p className="text-sm text-white/45 leading-relaxed">CarGurus, AutoTrader, Cars.com — OFFO extracts every field automatically. No copy-paste, no manual entry.</p>
              {/* Mock URL bar */}
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2">
                <svg className="w-3 h-3 text-white/20 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                <span className="text-xs text-white/25 truncate">cargurus.com/Cars/listing/details/...</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative rounded-2xl border border-[#00d97e]/20 bg-[#161b22] p-6 ring-1 ring-[#00d97e]/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#00d97e] text-[#0d1117] text-[10px] font-bold uppercase tracking-wider">OFFO</div>
              <div className="w-8 h-8 rounded-lg bg-[#00d97e]/15 flex items-center justify-center mb-4">
                <svg className="w-4 h-4 text-[#00d97e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">Step 2</p>
              <h3 className="text-base font-semibold text-white mb-2">We scan the listing &amp; photos</h3>
              <p className="text-sm text-white/45 leading-relaxed">OFFO checks price against market data, reads the listing for red flags, and analyses each photo for damage and missing angles.</p>
              {/* Mock checklist */}
              <div className="mt-4 space-y-1.5">
                {["Price vs market", "VIN history signals", "Photo angle coverage", "Damage findings"].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#00d97e] shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <span className="text-xs text-white/50">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative rounded-2xl border border-white/[0.08] bg-[#161b22] p-6">
              <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center mb-4">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">Step 3</p>
              <h3 className="text-base font-semibold text-white mb-2">Get your verdict before the test drive</h3>
              <p className="text-sm text-white/45 leading-relaxed">GREEN / YELLOW / RED verdict, negotiation script, questions to ask, and a pre-visit checklist — free, no account needed.</p>
              {/* Mock verdict badge */}
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00d97e]/10 border border-[#00d97e]/20">
                <span className="w-2 h-2 rounded-full bg-[#00d97e]" />
                <span className="text-xs font-semibold text-[#00d97e]">GREEN — Fair price, low risk</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link
              href="/receipt"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00d97e] text-[#0d1117] font-semibold text-sm hover:bg-[#00c970] transition-colors"
            >
              Scan a listing now
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="mt-3 text-xs text-white/30">Free · No account required · Results in under 60 seconds</p>
          </div>
        </div>
      </section>

      {/* ── Section 6: Social Proof ──────────────────────────────────── */}
      <section className="section bg-[#111827]">
        {/* Testimonial cards */}
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            {totalReceipts !== null
              ? `Trusted by ${totalReceipts.toLocaleString()}+ EV buyers`
              : "Trusted by thousands of EV buyers"}
          </h2>
          <p className="text-sm text-white/40 text-center mb-8">From real Reddit threads, not case studies.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { subreddit: "r/whatcarshouldIbuy", title: "This 2022 Ford Mustang Mach‑E was listed as a 'Great Deal' at $24,255 — here's what the OFFO receipt actually showed", views: "8,372", tag: "Used-EV receipt", photo: "/car-mustang-mache.webp" },
              { subreddit: "r/electriccars", title: "Dealer called this 2013 Tesla Model S a 'Good Deal' at $12,995… here's what the full OFFO receipt actually showed", views: "5,759", tag: "Salvage deal check", photo: "/car-tesla-model3.webp" },
              { subreddit: "r/EVRoutine", title: "Just moved and thinking about an EV without home charging? Here's what actually ends up mattering.", views: "108,023", tag: "Routine Fit check", photo: "/car-nissan-leaf.webp" },
              { subreddit: "r/EVRoutine", title: "Apartment dweller with no home charging, tows a small boat weekly, $25–40k budget — here's what EVRoutine recommends", views: "7,575", tag: "Routine Fit check", photo: "/car-bolt-ev.webp" },
            ].map(({ subreddit, title, views, tag, photo }) => (
              <div key={title} className="overflow-hidden flex flex-col rounded-xl border border-white/10 bg-white/5">
                <div className="h-36 overflow-hidden bg-white/5">
                  <Image src={photo} alt="" width={300} height={144} className="w-full h-full object-cover object-center" />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" aria-hidden>
                        <circle cx="10" cy="10" r="10" fill="#FF4500"/>
                        <path d="M16.67 10a1.46 1.46 0 00-2.47-1 7.12 7.12 0 00-3.85-1.23l.65-3.08 2.13.45a1 1 0 101.07-1 1 1 0 00-.96.68l-2.38-.5a.26.26 0 00-.31.2l-.73 3.44a7.14 7.14 0 00-3.89 1.23 1.46 1.46 0 10-1.61 2.39 2.87 2.87 0 000 .44c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a2.87 2.87 0 000-.44 1.46 1.46 0 00.6-1.18zM7.27 11a1 1 0 111 1 1 1 0 01-1-1zm5.6 2.71a3.58 3.58 0 01-2.87.89 3.58 3.58 0 01-2.87-.89.23.23 0 01.33-.33 3.15 3.15 0 002.54.71 3.15 3.15 0 002.54-.71.23.23 0 01.33.33zm-.2-1.71a1 1 0 111-1 1 1 0 01-1 1z" fill="white"/>
                      </svg>
                      <span className="text-[0.625rem] font-semibold text-white/40">{subreddit}</span>
                    </div>
                    <span className="text-[0.6875rem] font-semibold text-[#00d97e]/60 tracking-wide">✓ Real post</span>
                  </div>
                  <p className="text-xs font-semibold text-white leading-relaxed flex-1">&ldquo;{title}&rdquo;</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-white/25">{views} views</span>
                    <span className="text-white/15">·</span>
                    <span className="text-xs text-white/25">{tag}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── Section 7: Deal Watch ────────────────────────────────────── */}
      <div className="bg-[#0d1117]">
        <FeaturedDeals />
      </div>

      {/* ── Section 8: FAQ + Contact ──────────────────────────────────── */}
      <section className="py-10 md:py-16 bg-[#111827]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="lg:w-64 shrink-0">
              <h2 className="text-2xl font-bold text-white mb-3" style={{ lineHeight: "var(--leading-snug)" }}>Your questions,<br />answered</h2>
              <p className="text-sm text-white/40 mb-1">Can&apos;t find what you&apos;re looking for?</p>
              <p className="text-sm text-white/40 mb-5">Check out our <Link href="/receipt" className="text-[#00d97e] hover:text-[#00f090] transition-colors">Analyze tool</Link> or reach out.</p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00d97e] hover:bg-[#00f090] text-[#0d1117] text-sm font-semibold rounded-xl transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact us
              </Link>
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
            Enter VIN →
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

      {/* Sticky bottom CTA — visible on mobile for spike traffic that scrolls past hero */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0d1117]/95 backdrop-blur-sm border-t border-white/[0.08] px-4 py-3 flex items-center gap-3">
        <p className="flex-1 text-sm text-white/60 leading-tight">Got a listing? Get your free EV receipt.</p>
        <Link
          href="/receipt"
          onClick={() => { try { sessionStorage.setItem("offo_page_source", "homepage_sticky"); } catch {} }}
          className="shrink-0 px-4 py-2 rounded-lg bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00f090] transition-colors"
        >
          Try it free →
        </Link>
      </div>

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
