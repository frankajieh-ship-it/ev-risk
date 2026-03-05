/**
 * OFFO Listing Receipt Page
 *
 * /receipt
 * Paste a car listing URL or text, get an AI-powered deal receipt.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Receipt, Loader2, QrCode, ArrowLeft } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { initAttribution } from "@/lib/attribution";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { useTurnstile } from "@/hooks/useTurnstile";
import LoginModal from "@/components/LoginModal";
import Header from "@/components/landing/Header";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import ExampleAnalysisSection from "@/components/landing/ExampleAnalysisSection";
import UniqueAdvantageSection from "@/components/landing/UniqueAdvantageSection";
import PricingSection from "@/components/landing/PricingSection";
import Footer from "@/components/landing/Footer";
import ReceiptInputCard from "@/components/receipt/ReceiptInputCard";
import ReceiptOutputCard from "@/components/receipt/ReceiptOutputCard";
import ReceiptDetailsAccordion from "@/components/receipt/ReceiptDetailsAccordion";
import ReceiptHistoryDrawer from "@/components/receipt/ReceiptHistoryDrawer";
import EmailCaptureCard from "@/components/receipt/EmailCaptureCard";
// EmailGateModal removed — 100% skip rate, replaced by inline EmailCaptureCard
import DecisionPackCard from "@/components/receipt/DecisionPackCard";
import FeedbackWidget from "@/components/FeedbackWidget";
import SaveReceiptCTA from "@/components/receipt/SaveReceiptCTA";
import VinCheckSection from "@/components/receipt/VinCheckSection";
import DeepDiveSection from "@/components/receipt/DeepDiveSection";
import NegotiatorSection from "@/components/receipt/NegotiatorSection";
import PdfDownloadButton from "@/components/receipt/PdfDownloadButton";
import CompareBadge from "@/components/receipt/CompareBadge";
import CompareSelectModal from "@/components/receipt/CompareSelectModal";
import CompareView from "@/components/receipt/CompareView";
import RoutineFitMiniStep from "@/components/receipt/RoutineFitMiniStep";
import ShareModal from "@/components/receipt/ShareModal";
import { useReceiptHistory } from "@/hooks/useReceiptHistory";
import { useRegion } from "@/hooks/useRegion";
import RegionSelector from "@/components/RegionSelector";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import type { ListingReceipt, LintError, StructuredListingFields, ReceiptHistoryEntry, DeepDiveContent } from "@/types/receipt";

// Persist/retrieve current receipt ID across auth redirects
const ACTIVE_RECEIPT_KEY = "offo_active_receipt_id";

function storeActiveReceipt(receiptId: string) {
  try { localStorage.setItem(ACTIVE_RECEIPT_KEY, receiptId); } catch {}
}

function consumeActiveReceipt(): string | null {
  try {
    const id = localStorage.getItem(ACTIVE_RECEIPT_KEY);
    if (id) localStorage.removeItem(ACTIVE_RECEIPT_KEY);
    return id;
  } catch { return null; }
}

// Fetch with timeout and retry for resilience against 504s
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 65000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      // 429: return immediately — don't burn retries on rate limits
      if (res.status === 429) return res;

      // 409: duplicate in-flight — respect Retry-After, then retry once
      if (res.status === 409 && attempt < maxRetries) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      // Retry on 503/504 (gateway timeout, AI unavailable)
      if (res.status === 503 || res.status === 504) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
    }
  }
  throw new Error("Max retries exceeded");
}

export default function ReceiptPage() {
  const { trackEvent } = useEventTracking();
  useVisitorTracking();
  const router = useRouter();
  const { isAuthenticated, isConfigured: authConfigured } = useAuth();
  const { region, setRegion } = useRegion();

  // Return-to-routine state
  const [returnToRoutine, setReturnToRoutine] = useState(false);
  const [routineRunId, setRoutineRunId] = useState<string | null>(null);
  const [routineVehicleReady, setRoutineVehicleReady] = useState(false);

  // Core state
  const [receipt, setReceipt] = useState<ListingReceipt | null>(null);
  const [lintPassed, setLintPassed] = useState(true);
  const [lintErrors, setLintErrors] = useState<LintError[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingFree, setRemainingFree] = useState<number | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isSimilarityMatch, setIsSimilarityMatch] = useState(false);

  // History
  const [historyOpen, setHistoryOpen] = useState(false);

  // Pro state
  const [isPro, setIsPro] = useState(false);

  // Receipt token
  const [receiptToken, setReceiptToken] = useState("");

  // Receipt history (merged server + localStorage)
  const {
    history,
    isLoading: isHistoryLoading,
    addReceipt,
    clearHistory,
  } = useReceiptHistory(receiptToken);

  // Single-flight guard
  const inFlightRef = useRef(false);

  // Store last generation input for regenerate
  const lastGenerateInputRef = useRef<{
    listing_url?: string;
    listing_text?: string;
    fields: StructuredListingFields;
    extraction_id?: string;
  } | null>(null);

  // Decision Pack state
  const [deepDive, setDeepDive] = useState<DeepDiveContent | null>(null);
  const [isLoadingDeepDive, setIsLoadingDeepDive] = useState(false);
  const [decisionPackDismissed, setDecisionPackDismissed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<string | null>(null);
  const paywallShownForRef = useRef<Set<string>>(new Set());

  // Compare state
  const [compareReceipt, setCompareReceipt] = useState<ListingReceipt | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showCompareView, setShowCompareView] = useState(false);
  const [showCompareLoginModal, setShowCompareLoginModal] = useState(false);

  // Share state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareSlug, setShareSlug] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  // VIN from extraction (passed to VinCheckSection)
  const [currentVin, setCurrentVin] = useState<string | undefined>(undefined);

  // Email gate removed (100% skip rate) — inline EmailCaptureCard handles email now

  // Retention capture state
  const [hasSaved, setHasSaved] = useState(false);
  const [hasEmailed, setHasEmailed] = useState(false);

  // Prefill from SEO page or extension
  const [prefillText, setPrefillText] = useState<string | null>(null);
  const [prefillUrl, setPrefillUrl] = useState<string | null>(null);
  const [pageSource, setPageSource] = useState<string | null>(null);

  // Payment status hook
  const {
    isUnlocked,
    compareRemaining,
    compareBoundTo,
    purchaseId,
    packTier,
    isLoading: isPaymentLoading,
    paymentsEnabled,
    freeMode,
    refetch: refetchPayment,
  } = usePaymentStatus("receipt", receipt?.receipt_id ?? null, receiptToken);

  const { execute: executeTurnstile } = useTurnstile({
    containerId: "turnstile-receipt",
    action: "receipt-submit",
  });

  useEffect(() => {
    setReceiptToken(getOrCreateReceiptToken());

    // Email gate localStorage cleanup (gate removed)

    // Check for prefilled listing text from SEO page
    const storedText = sessionStorage.getItem("offo_listing_text");
    if (storedText) {
      setPrefillText(storedText);
      sessionStorage.removeItem("offo_listing_text");
    }
    const storedPageSource = sessionStorage.getItem("offo_page_source");
    if (storedPageSource) {
      setPageSource(storedPageSource);
      sessionStorage.removeItem("offo_page_source");
    }

    // Capture UTM attribution BEFORE cleaning the URL (replaceState wipes params)
    initAttribution();

    // Check for return-to-routine flow (?return_to=routine&run_id=X)
    const params = new URLSearchParams(window.location.search);
    if (params.get("return_to") === "routine" && params.get("run_id")) {
      setReturnToRoutine(true);
      setRoutineRunId(params.get("run_id"));
    }

    // Check for URL prefill (?url=...&ext=true or ?url=...&src=landing)
    const extUrl = params.get("url");
    if (extUrl) {
      setPrefillUrl(extUrl);
      const src = params.get("src") || (params.get("ext") === "true" ? "extension" : "direct_url");
      setPageSource(src);
      window.history.replaceState({}, "", "/receipt");
    }

    // Resume saved receipt from /saved dashboard
    const resumeId = params.get("resume");

    // Also check for receipt stored before auth redirect
    const activeReceiptId = resumeId || consumeActiveReceipt();

    if (activeReceiptId) {
      // Try localStorage history first (instant, no network)
      const localHistory = JSON.parse(localStorage.getItem("offo_receipt_history") || "[]");
      const found = localHistory.find(
        (e: { receipt_id?: string; receipt?: { receipt_id?: string } }) =>
          e.receipt_id === activeReceiptId || e.receipt?.receipt_id === activeReceiptId
      );
      if (found?.receipt) {
        setReceipt(found.receipt);
      } else {
        // Fallback to server
        (async () => {
          try {
            const res = await fetch(`/api/receipt/history?receipt_id=${encodeURIComponent(activeReceiptId)}`);
            const data = await res.json();
            if (data.entries?.length > 0 && data.entries[0].receipt) {
              setReceipt(data.entries[0].receipt);
            }
          } catch {
            // Silently fail — user can still generate a new receipt
          }
        })();
      }

      // Clean the URL if it was a resume param
      if (resumeId) {
        const url = new URL(window.location.href);
        url.searchParams.delete("resume");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
  }, []);

  // Checkout return: detect ?checkout=success and poll for paid status
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.pathname + url.search);

    // Poll payment status until unlocked (max 30s)
    let attempts = 0;
    const maxAttempts = 15;
    const poll = setInterval(async () => {
      attempts++;
      await refetchPayment();
      if (attempts >= maxAttempts) clearInterval(poll);
    }, 2000);

    return () => clearInterval(poll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load deep dive when payment is confirmed
  useEffect(() => {
    if (!isUnlocked || !receipt?.receipt_id || !receiptToken) return;
    if (deepDive || isLoadingDeepDive) return;

    let cancelled = false;
    setIsLoadingDeepDive(true);

    (async () => {
      try {
        const res = await fetch("/api/deepdive/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario_type: "receipt",
            scenario_id: receipt.receipt_id,
            anon_id: receiptToken,
          }),
        });
        const data = await res.json();
        if (!cancelled && data.success && data.deep_dive) {
          setDeepDive(data.deep_dive);
        }
      } catch {
        // Silently fail — deep dive section just won't render
      } finally {
        if (!cancelled) setIsLoadingDeepDive(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isUnlocked, receipt?.receipt_id, receiptToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Multi-step loading progress during generation
  useEffect(() => {
    if (!isGenerating) {
      setGeneratingStep(0);
      return;
    }
    const timers = [
      setTimeout(() => setGeneratingStep(1), 3000),
      setTimeout(() => setGeneratingStep(2), 8000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isGenerating]);

  // Track receipt result viewed
  useEffect(() => {
    if (!receipt?.receipt_id) return;
    trackEvent("receipt_result_viewed", {
      receipt_id: receipt.receipt_id,
      verdict: receipt.verdict,
    });
  }, [receipt?.receipt_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track Buyer Pass teaser impression
  useEffect(() => {
    if (!receipt?.receipt_id || isUnlocked || freeMode || !paymentsEnabled) return;
    trackEvent("buyer_pass_teaser_shown", {
      receipt_id: receipt.receipt_id,
      verdict: receipt.verdict,
    });
  }, [receipt?.receipt_id, isUnlocked, freeMode, paymentsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Email gate useEffect removed — inline EmailCaptureCard handles email capture now

  // Show paywall only when user clicks a premium-gated action
  const handlePremiumAction = useCallback((trigger: string) => {
    if (freeMode) return;
    if (isUnlocked) return;
    const rid = receipt?.receipt_id;
    if (rid && paywallShownForRef.current.has(rid)) {
      // Already shown for this receipt this session — just scroll to it
      document.getElementById("decision-pack-card")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (rid) paywallShownForRef.current.add(rid);
    setShowPaywall(true);
    setDecisionPackDismissed(false);
    setPaywallTrigger(trigger);
    trackEvent("paywall_shown", { receipt_id: rid, trigger_reason: trigger });
    setTimeout(() => {
      document.getElementById("decision-pack-card")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [freeMode, isUnlocked, packTier, receipt, receiptToken, purchaseId, trackEvent]);


  // Auto-load bound comparison when compareBoundTo is set
  useEffect(() => {
    if (!compareBoundTo || compareReceipt) return;

    // Try localStorage first
    const fromHistory = history.find((e) => e.receipt_id === compareBoundTo);
    if (fromHistory) {
      setCompareReceipt(fromHistory.receipt);
      setShowCompareView(true);
      return;
    }

    // Server fallback
    if (!receipt?.receipt_id || !receiptToken) return;
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams({
          anon_id: receiptToken,
        });
        const res = await fetch(
          `/api/receipt/${receipt.receipt_id}/compare?${params}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && data.compare_receipt) {
          setCompareReceipt(data.compare_receipt);
          setShowCompareView(true);
        }
      } catch {
        // Silently fail — compare view just won't show
      }
    })();

    return () => { cancelled = true; };
  }, [compareBoundTo, receipt?.receipt_id, receiptToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate receipt
  const handleGenerate = useCallback(
    async (data: {
      listing_url?: string;
      listing_text?: string;
      fields: StructuredListingFields;
      extraction_id?: string;
    }) => {
      if (!receiptToken) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      lastGenerateInputRef.current = data;

      setIsGenerating(true);
      setError(null);
      setReceipt(null);
      setLintPassed(true);
      setLintErrors([]);
      setIsFallback(false);
      setIsSimilarityMatch(false);
      setCompareReceipt(null);
      setShowCompareView(false);
      setCurrentVin(data.fields.vin || undefined);

      try {
        // Turnstile bot protection
        const turnstileToken = await executeTurnstile();

        const body: Record<string, unknown> = {
          receipt_token: receiptToken,
          mode: "single",
          region,
          turnstileToken: turnstileToken || undefined,
          leave_this_empty: "",
        };

        if (pageSource) body.page_source = pageSource;
        if (data.extraction_id) body.extraction_id = data.extraction_id;

        if (data.listing_url) body.listing_url = data.listing_url;
        if (data.listing_text) body.listing_text = data.listing_text;

        // Spread structured fields into body
        const f = data.fields;
        if (f.year) body.year = f.year;
        if (f.make) body.make = f.make;
        if (f.model) body.model = f.model;
        if (f.trim) body.trim = f.trim;
        if (f.mileage) body.mileage = f.mileage;
        if (f.price) body.price = f.price;
        if (f.vin) body.vin = f.vin;
        if (f.location) body.location = f.location;
        if (f.seller_type) body.seller_type = f.seller_type;
        if (f.title_status) body.title_status = f.title_status;
        if (f.accidents_reported) body.accidents_reported = f.accidents_reported;
        if (f.service_history) body.service_history = f.service_history;
        if (f.owners) body.owners = f.owners;
        if (f.carfax_available) body.carfax_available = f.carfax_available;
        if (f.financing_vs_cash) body.financing_vs_cash = f.financing_vs_cash;
        if (f.country) body.country = f.country;
        if (f.zip_or_postcode) body.zip_or_postcode = f.zip_or_postcode;

        const res = await fetchWithRetry("/api/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const result = await res.json();

        if (!res.ok || !result.success) {
          // Turnstile rejection
          if (res.status === 403 && result.captcha_required) {
            setError("Verification failed. Please refresh and try again.");
            return;
          }
          // Friendly 429 messages with time info
          if (res.status === 429 && result.resetAt) {
            const resetDate = new Date(result.resetAt);
            const hoursLeft = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60)));
            setError(
              result.remaining_free === 0
                ? `Free daily limit reached. Resets in ~${hoursLeft} hour${hoursLeft > 1 ? "s" : ""}.`
                : result.error || "Too many requests. Please try again later."
            );
          } else {
            setError(result.error || "Failed to generate receipt");
          }
          if (typeof result.remaining_free === "number") {
            setRemainingFree(result.remaining_free);
          }
          return;
        }

        setReceipt(result.receipt);
        setLintPassed(result.lint_passed);
        setLintErrors(result.lint_error_codes || []);
        setIsFallback(!!result.fallback);
        setIsSimilarityMatch(!!result.similarity_match);
        if (typeof result.remaining_free === "number") {
          setRemainingFree(result.remaining_free);
        }
        if (typeof result.is_pro === "boolean") {
          setIsPro(result.is_pro);
        }

        // Add to history
        addReceipt(result.receipt);

        // Track event
        trackEvent("receipt_generate", {
          receipt_id: result.receipt.receipt_id,
          verdict: result.receipt.verdict,
          price_label: result.receipt.price_sanity?.label,
          lint_passed: result.lint_passed,
          fallback: !!result.fallback,
        });
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        setError(
          isAbort
            ? "Receipt is taking longer than expected. Please try again."
            : "Generation failed after multiple attempts. Try pasting less text or entering details manually."
        );
      } finally {
        setIsGenerating(false);
        inFlightRef.current = false;
      }
    },
    [receiptToken, region, trackEvent, addReceipt, executeTurnstile]
  );

  // Regenerate: re-submit the last input to get a fresh AI analysis
  const handleRegenerate = useCallback(() => {
    const lastInput = lastGenerateInputRef.current;
    if (!lastInput) return;
    trackEvent("receipt_regenerate", {
      receipt_id: receipt?.receipt_id,
      was_fallback: isFallback,
      was_similarity: isSimilarityMatch,
    });
    handleGenerate(lastInput);
  }, [handleGenerate, receipt?.receipt_id, isFallback, isSimilarityMatch, trackEvent]);

  // Post receipt event to dedicated endpoint (fire-and-forget)
  const postReceiptEvent = useCallback(
    (eventType: string) => {
      if (!receipt?.receipt_id || !receiptToken) return;
      fetch("/api/receipt/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: receipt.receipt_id,
          event_type: eventType,
          receipt_token: receiptToken,
        }),
      }).catch(() => {});
    },
    [receipt, receiptToken]
  );

  // Handle copy (legacy receipt_events table)
  const handleCopy = useCallback(() => {
    postReceiptEvent("copy");
  }, [postReceiptEvent]);

  // Granular copy tracking (user_events table)
  const handleTrackCopy = useCallback(
    (copyType: string) => {
      const eventNameMap: Record<string, string> = {
        reddit_draft: "copy_reddit_draft",
        "must-ask": "copy_checklist",
        opener: "copy_seller_message",
        quick_checklist: "copy_checklist",
      };
      const eventName = eventNameMap[copyType];
      if (eventName) {
        trackEvent(eventName, {
          receipt_id: receipt?.receipt_id,
          verdict: receipt?.verdict,
        });
      }
    },
    [trackEvent, receipt]
  );

  // Track lint fallback served (one-time, fired from ReceiptOutputCard)
  const handleLintFallback = useCallback(() => {
    trackEvent("lint_failed_fallback_served", {
      receipt_id: receipt?.receipt_id,
      verdict: receipt?.verdict,
      lint_error_count: lintErrors.length,
    });
  }, [trackEvent, receipt, lintErrors]);

  // Handle share receipt
  const handleShareClick = useCallback(async () => {
    if (!receipt?.receipt_id || !receiptToken || isSharing) return;
    setIsSharing(true);
    trackEvent("share_qr_clicked", { receipt_id: receipt.receipt_id });

    try {
      const res = await fetch("/api/share/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: receipt.receipt_id,
          receipt_token: receiptToken,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setShareUrl(data.share_url);
        setShareSlug(data.share_slug);
        setShowShareModal(true);
      }
    } catch {
      // Silently fail — share is non-critical
    } finally {
      setIsSharing(false);
    }
  }, [receipt, receiptToken, isSharing, trackEvent]);

  // Handle auto-fix
  const handleAutoFix = useCallback(async () => {
    if (!receipt || !receiptToken) return;
    setIsFixing(true);
    try {
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_token: receiptToken,
          mode: "fix_only",
          receipt_json: receipt,
          lint_errors: lintErrors,
        }),
      });
      const result = await res.json();
      if (result.success && result.receipt) {
        setReceipt(result.receipt);
        setLintPassed(result.lint_passed);
        setLintErrors(result.lint_error_codes || []);

        trackEvent("receipt_regen", {
          receipt_id: receipt.receipt_id,
          lint_passed: result.lint_passed,
        });
      }
    } catch {
      // silently fail
    } finally {
      setIsFixing(false);
    }
  }, [receipt, receiptToken, lintErrors, trackEvent]);

  // Handle extraction fields for return-to-routine flow
  const handleExtractionFields = useCallback((fields: { year?: number; make?: string; model?: string; trim?: string; mileage?: number }) => {
    if (!returnToRoutine) return;
    try {
      localStorage.setItem("offo_routine_vehicle", JSON.stringify(fields));
      setRoutineVehicleReady(true);
    } catch {
      // ignore
    }
  }, [returnToRoutine]);

  // Return to routine with vehicle data
  const handleReturnToRoutine = useCallback(() => {
    if (!routineRunId) return;
    router.push(`/routine/results?run_id=${routineRunId}&apply_vehicle=true`);
  }, [routineRunId, router]);

  // View historical receipt
  const handleHistorySelect = useCallback((entry: ReceiptHistoryEntry) => {
    setReceipt(entry.receipt);
    setLintPassed(true);
    setLintErrors([]);
    setError(null);
    setHistoryOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header
        historyCount={history.length}
        onHistoryClick={() => {
          setHistoryOpen(true);
          trackEvent("receipt_history_viewed");
        }}
        regionSelector={<RegionSelector region={region} onChange={setRegion} />}
      />
      <div id="turnstile-receipt" className="hidden" />
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Receipt className="w-6 h-6 text-blue-600" />
            <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">
              by OFFO Lab
            </span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-green-600 bg-clip-text text-transparent mb-2">
            Get a second opinion before the test drive
          </h1>
          <p className="text-gray-600">
            Paste a listing. Get the fair price check, key questions, and a pre-visit checklist.
          </p>
        </div>

        {/* Input Card */}
        <ReceiptInputCard
          onGenerate={handleGenerate}
          onExtractionSuccess={() => {}}
          onExtractionFields={handleExtractionFields}
          isGenerating={isGenerating}
          generatingStep={generatingStep}
          remainingFree={freeMode ? null : remainingFree}
          error={error}
          isPro={isPro}
          prefillText={prefillText}
          prefillUrl={prefillUrl}
          trackEvent={trackEvent}
          receiptToken={receiptToken}
          hasResult={!!receipt}
        />

        {/* Return to Routine banner — shown when coming from routine and vehicle extracted */}
        {returnToRoutine && routineVehicleReady && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200"
          >
            <p className="text-sm font-medium text-gray-900 mb-2">
              Vehicle data extracted! Return to your routine analysis to see updated results.
            </p>
            <button
              onClick={handleReturnToRoutine}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Routine with Vehicle Data
            </button>
          </motion.div>
        )}

        {/* Return to Routine hint — shown before extraction */}
        {returnToRoutine && !routineVehicleReady && (
          <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-xs text-blue-700">
              Paste a listing URL above to extract vehicle data, then return to your routine analysis.
            </p>
          </div>
        )}

        {/* Output */}
        <AnimatePresence>
          {receipt && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mt-6 space-y-4"
            >
              <ReceiptOutputCard
                receipt={receipt}
                lintPassed={lintPassed}
                lintErrors={lintErrors}
                onCopy={handleCopy}
                onTrackCopy={handleTrackCopy}
                onAutoFix={handleAutoFix}
                isFixing={isFixing}
                isFallback={isFallback}
                isSimilarityMatch={isSimilarityMatch}
                onRegenerate={isFallback ? handleRegenerate : undefined}
                onTrackLintFallback={handleLintFallback}
                region={region}
              />

              {/* Buyer Pass teaser — proactive, not gated */}
              {!isUnlocked && !freeMode && paymentsEnabled && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Want the full picture on this {[receipt.listing_summary?.year, receipt.listing_summary?.make, receipt.listing_summary?.model].filter(Boolean).join(" ") || "listing"}?
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Deep market comparison, 3-year cost projection, and ready-to-send negotiation scripts. Plus 9 more receipt checks.
                    </p>
                  </div>
                  <button
                    onClick={() => handlePremiumAction("inline_teaser")}
                    className="flex-shrink-0 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Get Buyer Pass — $9.99
                  </button>
                </div>
              )}

              {/* Negotiator — Seller Strategy */}
              <NegotiatorSection
                receipt={receipt}
                isUnlocked={isUnlocked}
                onUpgradeClick={() => handlePremiumAction("negotiator_upsell")}
                freeMode={freeMode}
              />

              {/* Routine Fit — moved up for prominence */}
              <RoutineFitMiniStep
                receiptMileage={receipt.listing_summary?.mileage}
                receiptPrice={receipt.listing_summary?.price}
                receiptSellerType={receipt.listing_summary?.seller_type}
                trackEvent={trackEvent}
              />

              {/* VIN Check */}
              <VinCheckSection
                receiptId={receipt.receipt_id}
                receiptToken={receiptToken}
                listingYear={receipt.listing_summary?.year}
                listingMake={receipt.listing_summary?.make}
                listingModel={receipt.listing_summary?.model}
                existingVin={currentVin}
                trackEvent={trackEvent}
              />

              {/* Action row — Save / Share / PDF */}
              <div id="save-receipt-cta" className="flex items-center gap-2">
                <div className="flex-1">
                  <SaveReceiptCTA
                    receipt={receipt}
                    onSaveSuccess={() => setHasSaved(true)}
                    compact
                  />
                </div>
                <button
                  onClick={handleShareClick}
                  disabled={isSharing}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <QrCode className="w-4 h-4" />
                  Share
                </button>
                {paymentsEnabled && !freeMode && (
                  <PdfDownloadButton
                    receiptId={receipt.receipt_id}
                    receiptToken={receiptToken}
                    isUnlocked={isUnlocked}
                    onCheckoutRedirect={() => handlePremiumAction("download_pdf")}
                    compact
                  />
                )}
              </div>

              {/* Email capture — moved up for visibility */}
              <div id="email-capture-card">
                <EmailCaptureCard
                  receiptId={receipt.receipt_id}
                  onSubmit={() => {
                    setHasEmailed(true);
                    trackEvent("email_checklist_submit", {
                      receipt_id: receipt.receipt_id,
                    });
                  }}
                />
              </div>

              {/* Decision Pack paywall (shown on premium action click, hidden in free mode) */}
              {showPaywall && !decisionPackDismissed && !isPaymentLoading && !freeMode && (
                <div id="decision-pack-card">
                  <DecisionPackCard
                    receiptToken={receiptToken}
                    receiptId={receipt.receipt_id}
                    triggerReason={paywallTrigger}
                    onDismiss={() => setDecisionPackDismissed(true)}
                  />
                </div>
              )}

              {/* Deep dive content (when unlocked, hidden in free mode) */}
              {isUnlocked && deepDive && !freeMode && (
                <DeepDiveSection
                  deepDive={deepDive}
                  receiptId={receipt.receipt_id}
                />
              )}

              {/* Deep dive loading spinner (hidden in free mode) */}
              {isUnlocked && isLoadingDeepDive && !deepDive && !freeMode && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating your deep dive analysis...
                </div>
              )}

              {/* Compare view (when bound and visible) */}
              {showCompareView && compareReceipt && receipt && (
                <CompareView
                  receiptA={receipt}
                  receiptB={compareReceipt}
                />
              )}

              {/* Compare badge — free with login, or paid legacy */}
              {authConfigured && (
                <CompareBadge
                  compareRemaining={compareRemaining}
                  compareBoundTo={compareBoundTo}
                  isAuthenticated={isAuthenticated}
                  onInitiateCompare={() => setShowCompareModal(true)}
                  onViewCompare={() => setShowCompareView(true)}
                  onSignIn={() => {
                    if (receipt) storeActiveReceipt(receipt.receipt_id);
                    setShowCompareLoginModal(true);
                  }}
                />
              )}

              {/* Details accordion */}
              {receipt.receipt_details && (
                <ReceiptDetailsAccordion
                  details={receipt.receipt_details}
                  operatorNotes={receipt.operator_notes}
                  listingSummary={receipt.listing_summary}
                />
              )}

              {/* Feedback */}
              <FeedbackWidget
                contextType="receipt"
                contextId={receipt.receipt_id}
              />

              {/* Contact/feedback link */}
              <p className="text-center text-sm text-gray-500 pt-2">
                Found this helpful? Got questions?{" "}
                <Link
                  href={`/contact?from=receipt&receiptId=${receipt.receipt_id}&verdict=${receipt.verdict}`}
                  onClick={() =>
                    trackEvent("contact_click_post_receipt", {
                      receipt_id: receipt.receipt_id,
                      verdict: receipt.verdict,
                    })
                  }
                  className="text-indigo-600 hover:text-indigo-700 underline"
                >
                  Tell us
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Marketing sections — visible before first receipt */}
      {!receipt && (
        <>
          <HowItWorksSection />
          <ExampleAnalysisSection />
          <UniqueAdvantageSection />
          <PricingSection />
        </>
      )}

      <Footer />

      {/* History drawer */}
      <ReceiptHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onSelect={handleHistorySelect}
        onClear={clearHistory}
        isLoading={isHistoryLoading}
        region={region}
      />

      {/* Compare select modal — works for free (no purchaseId) and paid */}
      {receipt && (
        <CompareSelectModal
          isOpen={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          history={history}
          currentReceiptId={receipt.receipt_id}
          purchaseId={purchaseId || undefined}
          onCompareComplete={(compareRcpt) => {
            setCompareReceipt(compareRcpt);
            setShowCompareView(true);
            if (purchaseId) refetchPayment();
          }}
        />
      )}

      {/* Compare login modal */}
      <LoginModal
        isOpen={showCompareLoginModal}
        onClose={() => setShowCompareLoginModal(false)}
        onSuccess={() => setShowCompareLoginModal(false)}
        redirectPath={
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : undefined
        }
      />

      {/* Email gate modal removed — 100% skip rate, inline capture card is better */}

      {/* Share receipt modal */}
      {receipt && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareUrl={shareUrl}
          shareSlug={shareSlug}
          receiptId={receipt.receipt_id}
          receipt={receipt}
        />
      )}

    </div>
  );
}
