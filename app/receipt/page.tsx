/**
 * OFFO Listing Receipt Page
 *
 * /receipt
 * Paste a car listing URL or text, get an instant deal receipt.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Receipt, Loader2, QrCode, ArrowLeft, AlertTriangle, Menu, X } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { initAttribution } from "@/lib/attribution";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { useTurnstile } from "@/hooks/useTurnstile";
import LoginModal from "@/components/LoginModal";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import ExampleAnalysisSection from "@/components/landing/ExampleAnalysisSection";
import UniqueAdvantageSection from "@/components/landing/UniqueAdvantageSection";
import Footer from "@/components/landing/Footer";
import ReceiptInputCard from "@/components/receipt/ReceiptInputCard";
import ReceiptOutputCard from "@/components/receipt/ReceiptOutputCard";
import ReceiptDetailsAccordion from "@/components/receipt/ReceiptDetailsAccordion";
import ReceiptHistoryDrawer from "@/components/receipt/ReceiptHistoryDrawer";
import EmailCaptureCard from "@/components/receipt/EmailCaptureCard";
// EmailGateModal removed — 100% skip rate, replaced by inline EmailCaptureCard
import FeedbackWidget from "@/components/FeedbackWidget";
import ExitFeedbackModal from "@/components/receipt/ExitFeedbackModal";
import SaveReceiptCTA from "@/components/receipt/SaveReceiptCTA";
import ModelInfoSection from "@/components/receipt/ModelInfoSection";
import dynamic from "next/dynamic";

// Heavy components lazy-loaded — not needed for initial receipt render
const NewsCarousel = dynamic(() => import("@/components/NewsCarousel"), { ssr: false });
const DeepDiveSection = dynamic(() => import("@/components/receipt/DeepDiveSection"), { ssr: false });
const NegotiationDeepSection = dynamic(() => import("@/components/receipt/NegotiationDeepSection"), { ssr: false });
const CompareView = dynamic(() => import("@/components/receipt/CompareView"), { ssr: false });
const CompareSelectModal = dynamic(() => import("@/components/receipt/CompareSelectModal"), { ssr: false });
const ShareModal = dynamic(() => import("@/components/receipt/ShareModal"), { ssr: false });
const OFfoChat = dynamic(() => import("@/components/chat/OFfoChat"), { ssr: false });

// Lighter components — static import fine
import PdfDownloadButton from "@/components/receipt/PdfDownloadButton";
import CompareBadge from "@/components/receipt/CompareBadge";
import { SourcesFooter } from "@/components/blocks/SourcesFooter";
import ExtensionNudge from "@/components/ExtensionNudge";
import { useReceiptHistory } from "@/hooks/useReceiptHistory";
import { useRegion } from "@/hooks/useRegion";
import RegionSelector from "@/components/RegionSelector";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import type { ListingReceipt, LintError, StructuredListingFields, ReceiptHistoryEntry, DeepDiveContent } from "@/types/receipt";
import type { MinimumViableRoutine } from "@/types/v2";
import RoutineContextBanner from "@/components/receipt/RoutineContextBanner";
import CompareFromReportCTA from "@/components/receipt/CompareFromReportCTA";
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
    const timeoutId = setTimeout(() => controller.abort(), 90000);
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

      // Retry on 503/504 (gateway timeout, service unavailable)
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

// --- On-demand Receipt Details wrapper ---
// Renders a "Generate Details" trigger; when ready, hands off to ReceiptDetailsAccordion.

function ReceiptDetailsOnDemand({
  receiptId,
  operatorNotes,
  listingSummary,
  region,
  initialStatus,
}: {
  receiptId: string;
  operatorNotes?: import("@/types/receipt").OperatorNotes;
  listingSummary?: import("@/types/receipt").ListingSummary;
  region?: import("@/lib/region").Region;
  initialStatus?: string;
}) {
  const [detailStatus, setDetailStatus] = useState<string>(initialStatus ?? "not_requested");
  const [details, setDetails] = useState<import("@/types/receipt").ReceiptDetails | null>(null);

  const generate = useCallback(async () => {
    setDetailStatus("running");
    try {
      const res = await fetch(`/api/receipt/${receiptId}/generate/receipt_details`, { method: "POST" });
      const json = await res.json();
      if (json.success && json.data) {
        setDetails(json.data as import("@/types/receipt").ReceiptDetails);
        setDetailStatus("ready");
      } else {
        setDetailStatus("failed");
      }
    } catch {
      setDetailStatus("failed");
    }
  }, [receiptId]);

  if (detailStatus === "ready" && details) {
    return (
      <ReceiptDetailsAccordion
        details={details}
        operatorNotes={operatorNotes}
        listingSummary={listingSummary}
        region={region}
      />
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
      <div className="px-4 py-3">
        {detailStatus === "not_requested" && (
          <button
            onClick={generate}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white/60 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg border border-white/[0.10] transition-colors"
          >
            Show Fee Estimates &amp; Listing Details
          </button>
        )}
        {detailStatus === "running" && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating details...
          </div>
        )}
        {detailStatus === "failed" && (
          <button
            onClick={generate}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg border border-red-500/20 transition-colors"
          >
            Retry — details generation failed
          </button>
        )}
      </div>
    </div>
  );
}

export default function ReceiptPage() {
  const { trackEvent } = useEventTracking();
  useVisitorTracking();
  const router = useRouter();
  const { isAuthenticated, isConfigured: authConfigured } = useAuth();
  const { region, setRegion } = useRegion();

  // Routine context — read from sessionStorage when available
  const [routineContext, setRoutineContext] = useState<MinimumViableRoutine | null>(null);
  const [routineContextUsed, setRoutineContextUsed] = useState(false);
  const [routineFitLabel, setRoutineFitLabel] = useState<string | null>(null);
  const [routineFitScore, setRoutineFitScore] = useState<number | null>(null);
  const [routineFitSummary, setRoutineFitSummary] = useState<string | null>(null);

  // Return-to-routine state
  const [returnToRoutine, setReturnToRoutine] = useState(false);
  const [routineRunId, setRoutineRunId] = useState<string | null>(null);
  const [routineVehicleReady, setRoutineVehicleReady] = useState(false);

  // Recall state
  const [activeRecalls, setActiveRecalls] = useState<Array<{
    recall_id: string;
    title: string;
    component: string;
    routine_impact_score: number;
    is_safety_critical: boolean;
    ai_summary: string;
  }>>([]);

  // Mobile nav
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeFailed, setUpgradeFailed] = useState(false);
  const upgradePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    deleteReceipt,
    clearHistory,
  } = useReceiptHistory(receiptToken);

  // Single-flight guard
  const inFlightRef = useRef(false);

  // Scroll target for result visibility
  const resultRef = useRef<HTMLDivElement>(null);

  // Store last generation input for regenerate
  const lastGenerateInputRef = useRef<{
    listing_url?: string;
    listing_text?: string;
    fields: StructuredListingFields;
    extraction_id?: string;
  } | null>(null);

  // On-demand section statuses (populated after core upgrade completes)
  const [sections, setSections] = useState<Record<string, { status: string }> | null>(null);

  // Decision Pack state
  const [deepDive, setDeepDive] = useState<DeepDiveContent | null>(null);
  const [isLoadingDeepDive, setIsLoadingDeepDive] = useState(false);
  const [decisionPackDismissed, setDecisionPackDismissed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<string | null>(null);
  const paywallShownForRef = useRef<Set<string>>(new Set());

  // Seller Pack state
  const [showSellerPackPaywall, setShowSellerPackPaywall] = useState(false);
  const [sellerPackDismissed, setSellerPackDismissed] = useState(false);

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

  // VIN from extraction
  const [currentVin, setCurrentVin] = useState<string | undefined>(undefined);

  // Email gate removed (100% skip rate) — inline EmailCaptureCard handles email now

  // Retention capture state
  const [hasSaved, setHasSaved] = useState(false);
  const [hasEmailed, setHasEmailed] = useState(false);

  // Post-receipt popup (save + compare) — shown 5s after result
  const [showPostReceiptPopup, setShowPostReceiptPopup] = useState(false);
  const postReceiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listing photos from Auto.dev enrichment
  const [listingPhotos, setListingPhotos] = useState<string[]>([]);

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
    paymentsEnabled,
    freeMode,
    sellerPackUnlocked,
    refetch: refetchPayment,
  } = usePaymentStatus("receipt", receipt?.receipt_id ?? null, receiptToken);

  const { execute: executeTurnstile } = useTurnstile({
    containerId: "turnstile-receipt",
    action: "receipt-submit",
  });

  useEffect(() => {
    setReceiptToken(getOrCreateReceiptToken());

    // Email gate localStorage cleanup (gate removed)

    // Read routine context persisted by homepage wizard
    try {
      const raw = sessionStorage.getItem("offo_routine_context");
      if (raw) setRoutineContext(JSON.parse(raw) as MinimumViableRoutine);
    } catch {}

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

    // Check for make/model prefill from vehicle landing pages (?make=Tesla&model=Model+3)
    const prefillMake = params.get("make");
    const prefillModel = params.get("model");
    if (prefillMake && prefillModel && !extUrl) {
      setPrefillText(`${prefillMake} ${prefillModel}`);
      setPageSource("vehicle_landing");
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

    // Track $9.99 Buyer Pass purchase completion
    trackEvent("deep_dive_purchase_succeeded", {
      receipt_id: receipt?.receipt_id,
      offer_type: "buyer_pass_999",
      session_id: params.get("session_id"),
    });

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

  // Auto-load deep dive for all users (free — no payment gate)
  useEffect(() => {
    if (!receipt?.receipt_id || !receiptToken) return;
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (upgradePollingRef.current) clearInterval(upgradePollingRef.current);
    };
  }, []);

  // Poll for full analysis upgrade when receipt is in "lite" status
  const startUpgradePolling = useCallback((receiptId: string) => {
    // Clear any existing polling
    if (upgradePollingRef.current) clearInterval(upgradePollingRef.current);

    setIsUpgrading(true);
    let attempts = 0;
    const maxAttempts = 40;

    const poll = setInterval(async () => {
      attempts++;
      let didFail = false;
      try {
        const res = await fetch(`/api/receipt/${encodeURIComponent(receiptId)}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.generation_status === "full" && data.receipt) {
          clearInterval(poll);
          upgradePollingRef.current = null;
          setReceipt(data.receipt);
          if (data.sections) setSections(data.sections);
          setIsUpgrading(false);
          setIsFallback(false);

          // Update history with upgraded receipt
          addReceipt(data.receipt);

          trackEvent("receipt_full_ready", {
            receipt_id: receiptId,
            polls_count: attempts,
            upgrade_ms: attempts * 3000,
          });
        } else if (data.generation_status === "failed") {
          didFail = true;
          clearInterval(poll);
          upgradePollingRef.current = null;
          setIsUpgrading(false);
          setUpgradeFailed(true);

          trackEvent("receipt_upgrade_failed", {
            receipt_id: receiptId,
            polls_count: attempts,
          });
        }
      } catch {
        // Network error — keep polling
      }

      if (attempts >= maxAttempts && !didFail) {
        clearInterval(poll);
        upgradePollingRef.current = null;
        setIsUpgrading(false);
        setUpgradeFailed(true);

        trackEvent("receipt_upgrade_failed", {
          receipt_id: receiptId,
          polls_count: attempts,
          reason: "max_attempts",
        });
      }
    }, 3000);

    upgradePollingRef.current = poll;
  }, [trackEvent, addReceipt]);

  // Track receipt result viewed + scroll into view
  useEffect(() => {
    if (!receipt?.receipt_id) return;
    trackEvent("receipt_result_viewed", {
      receipt_id: receipt.receipt_id,
      verdict: receipt.verdict,
    });
    // Scroll the result into view so users don't miss it
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [receipt?.receipt_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Post-receipt popup: show 5s after a new receipt arrives
  useEffect(() => {
    if (!receipt?.receipt_id) return;
    if (postReceiptTimerRef.current) clearTimeout(postReceiptTimerRef.current);
    setShowPostReceiptPopup(false);
    postReceiptTimerRef.current = setTimeout(() => {
      setShowPostReceiptPopup(true);
    }, 5000);
    return () => {
      if (postReceiptTimerRef.current) clearTimeout(postReceiptTimerRef.current);
    };
  }, [receipt?.receipt_id]);  

  // Track Buyer Pass teaser impression
  useEffect(() => {
    if (!receipt?.receipt_id || isUnlocked || freeMode || !paymentsEnabled) return;
    trackEvent("buyer_pass_teaser_shown", {
      receipt_id: receipt.receipt_id,
      verdict: receipt.verdict,
    });
  }, [receipt?.receipt_id, isUnlocked, freeMode, paymentsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track Seller Pack teaser impression (locked questions visible)
  useEffect(() => {
    if (!receipt?.receipt_id || sellerPackUnlocked || freeMode || !paymentsEnabled) return;
    if ((receipt.must_answer_questions?.length || 0) <= 2) return;
    trackEvent("seller_pack_teaser_shown", {
      receipt_id: receipt.receipt_id,
      question_count: receipt.must_answer_questions.length,
    });
  }, [receipt?.receipt_id, sellerPackUnlocked, freeMode, paymentsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Show seller pack paywall when user clicks a gated question
  const handleSellerPackAction = useCallback(() => {
    if (freeMode || sellerPackUnlocked) return;
    setShowSellerPackPaywall(true);
    setSellerPackDismissed(false);
    trackEvent("seller_pack_cta_clicked", { receipt_id: receipt?.receipt_id });
    setTimeout(() => {
      document.getElementById("seller-pack-card")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [freeMode, sellerPackUnlocked, receipt, trackEvent]);

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
      force_regenerate?: boolean;
    }) => {
      if (!receiptToken) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      lastGenerateInputRef.current = data;

      // Clear any in-progress upgrade polling
      if (upgradePollingRef.current) {
        clearInterval(upgradePollingRef.current);
        upgradePollingRef.current = null;
      }
      setIsUpgrading(false);

      setIsGenerating(true);
      setError(null);
      setReceipt(null);
      setLintPassed(true);
      setLintErrors([]);
      setIsFallback(false);
      setIsSimilarityMatch(false);
      setUpgradeFailed(false);
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

        if (data.force_regenerate) body.force_regenerate = true;

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

        // Pass routine context when available for personalized analysis
        if (routineContext) body.routine_context = routineContext;

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
        if (result.routine_context_used) {
          setRoutineContextUsed(true);
          setRoutineFitLabel(result.routine_fit_label ?? null);
          setRoutineFitScore(result.routine_fit_score ?? null);
          setRoutineFitSummary(result.routine_fit_summary ?? null);
        }
        if (typeof result.remaining_free === "number") {
          setRemainingFree(result.remaining_free);
        }
        if (typeof result.is_pro === "boolean") {
          setIsPro(result.is_pro);
        }
        if (Array.isArray(result.recalls)) {
          setActiveRecalls(result.recalls);
        }

        // Add to history
        addReceipt(result.receipt);

        // Start polling if this is a lite receipt (async full analysis in progress)
        if (result.generation_status === "lite" && result.receipt_id) {
          startUpgradePolling(result.receipt_id);
          trackEvent("receipt_lite_shown", {
            receipt_id: result.receipt.receipt_id,
            verdict: result.receipt.verdict,
            fit_score: result.receipt.fit_score,
          });
        }

        // Track event
        trackEvent("receipt_generate", {
          receipt_id: result.receipt.receipt_id,
          verdict: result.receipt.verdict,
          price_label: result.receipt.price_sanity?.label,
          lint_passed: result.lint_passed,
          fallback: !!result.fallback,
          generation_status: result.generation_status || "full",
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
    [receiptToken, region, trackEvent, addReceipt, executeTurnstile, startUpgradePolling]
  );

  // Regenerate: re-submit the last input to get a fresh analysis
  const handleRegenerate = useCallback(() => {
    const lastInput = lastGenerateInputRef.current;
    if (!lastInput) {
      setError("Unable to regenerate — please re-submit your listing URL or text.");
      return;
    }
    trackEvent("receipt_regen", {
      receipt_id: receipt?.receipt_id,
      was_fallback: isFallback,
      was_similarity: isSimilarityMatch,
      trigger: "manual",
    });
    handleGenerate({ ...lastInput, force_regenerate: true });
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
          trigger: "lint_fix",
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
    <div className="min-h-screen bg-[#0d1117]">
      {/* Dark nav — same pattern as homepage */}
      <nav className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/">
            <Image src="/offo-logo.jpg" alt="OFFO" width={200} height={103} className="w-24 sm:w-28 h-auto" priority />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/receipt" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Receipt Check</Link>
            <Link href="/" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Routine Fit</Link>
            <Link href="/copart" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Copart Arbitrage</Link>
            <Link href="/dealers" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">For Dealers</Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => { setHistoryOpen(true); trackEvent("receipt_history_viewed"); }}
                className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors"
              >
                History {history.length > 0 && <span className="ml-1 text-[0.7rem] bg-white/10 px-1.5 py-0.5 rounded-full">{history.length}</span>}
              </button>
              <RegionSelector region={region} onChange={setRegion} />
              {isAuthenticated ? (
                <Link href="/workspace" className="text-[0.8125rem] font-medium text-white/70 hover:text-white transition-colors">Dashboard</Link>
              ) : (
                <Link href="/auth/login" className="text-[0.8125rem] font-medium text-white/70 hover:text-white transition-colors">Sign in</Link>
              )}
            </div>
            <Link
              href="/"
              className="px-4 py-1.5 rounded-full bg-[#00d97e] text-[#0d1117] text-[0.8125rem] font-semibold hover:bg-[#00f090] transition-colors whitespace-nowrap"
            >
              Routine Fit →
            </Link>
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
                { href: "/dealers", label: "For Dealers" },
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
              <div className="border-t border-white/[0.06] pt-3 mt-2 space-y-2">
                <button
                  onClick={() => { setHistoryOpen(true); trackEvent("receipt_history_viewed"); setMobileNavOpen(false); }}
                  className="block py-2 text-sm font-medium text-white/70 hover:text-white"
                >
                  History {history.length > 0 && `(${history.length})`}
                </button>
                {isAuthenticated ? (
                  <Link href="/workspace" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm font-medium text-white/70 hover:text-white">Dashboard</Link>
                ) : (
                  <Link href="/auth/login" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm font-medium text-white/70 hover:text-white">Sign in</Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <div id="turnstile-receipt" className="hidden" />
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3 px-4 py-1.5 rounded-full border border-white/10 bg-white/5">
            <Receipt className="w-4 h-4 text-[#00d97e]" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
              Listing Receipt
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 tracking-tight" style={{ lineHeight: "1.1" }}>
            Get a second opinion<br />before the test drive
          </h1>
          <p className="text-[0.9375rem] text-white/50">
            Paste a listing. Get the fair price check, key questions, and a pre-visit checklist.
          </p>
        </div>

        {/* Input Card */}
        <ReceiptInputCard
          onGenerate={(data) => {
            // Fetch photos from Auto.dev if extraction didn't return any
            if (listingPhotos.length === 0 && (data.fields.make || data.fields.year)) {
              fetch("/api/photos?" + new URLSearchParams({
                ...(data.fields.make ? { make: data.fields.make } : {}),
                ...(data.fields.model ? { model: data.fields.model } : {}),
                ...(data.fields.year ? { year: String(data.fields.year) } : {}),
                ...(data.fields.vin ? { vin: data.fields.vin } : {}),
              }))
                .then((r) => r.json())
                .then((d) => { if (d.photo_urls?.length) setListingPhotos(d.photo_urls); })
                .catch(() => {});
            }
            handleGenerate(data);
          }}
          onExtractionSuccess={() => {}}
          onExtractionFields={handleExtractionFields}
          onPhotosExtracted={(photos) => {
            setListingPhotos(photos);
          }}
          isGenerating={isGenerating}
          generatingStep={generatingStep}
          remainingFree={null}
          error={error}
          isPro={isPro}
          prefillText={prefillText}
          prefillUrl={prefillUrl}
          trackEvent={trackEvent}
          receiptToken={receiptToken}
          hasResult={!!receipt}
        />

        {/* CarGurus pro tip + bookmarklet */}
        <div className="mt-2 space-y-1 text-center px-2">
          <p className="text-xs text-white/30">
            <span className="font-medium text-white/50">Pro tip:</span>{" "}
            On CarGurus, click the car photo first — the clean listing URL appears in your address bar.
          </p>
          <p className="text-xs text-white/30">
            Save time:{" "}
            { }
            <a
              href="javascript:(function(){var u=encodeURIComponent(window.location.href);window.open('https://offolab.com/receipt?url='+u+'&ext=true','_blank');})();"
              onClick={(e) => e.preventDefault()}
              draggable
              className="text-[#00d97e]/70 underline cursor-grab active:cursor-grabbing font-medium"
              title="Drag this to your bookmarks bar"
            >
              ⬆ OFFO Extract
            </a>
            {" "}— drag to your bookmarks bar, then click on any CarGurus listing
          </p>
        </div>

        {/* Analysis loading indicator */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-white/[0.06] border border-white/10 rounded-2xl px-5 py-4 flex items-start gap-3"
          >
            <Loader2 className="w-5 h-5 text-[#00d97e] animate-spin flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">
                Analysis in progress — this takes about 20–30 seconds
              </p>
              <p className="text-xs text-white/50 mt-1">
                You can explore other tools while you wait — this page will update automatically when ready.
              </p>
            </div>
          </motion.div>
        )}

        {/* Return to Routine banner — shown when coming from routine and vehicle extracted */}
        {returnToRoutine && routineVehicleReady && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-[#00d97e]/10 rounded-2xl border border-[#00d97e]/20"
          >
            <p className="text-sm font-medium text-white mb-2">
              Vehicle data extracted! Return to your routine analysis to see updated results.
            </p>
            <button
              onClick={handleReturnToRoutine}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00f090] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Routine with Vehicle Data
            </button>
          </motion.div>
        )}

        {/* Return to Routine hint — shown before extraction */}
        {returnToRoutine && !routineVehicleReady && (
          <div className="mt-4 p-3 bg-white/[0.05] rounded-xl border border-white/10">
            <p className="text-xs text-white/50">
              Paste a listing URL above to extract vehicle data, then return to your routine analysis.
            </p>
          </div>
        )}

        {/* Output */}
        <AnimatePresence>
          {receipt && (
            <motion.div
              ref={resultRef}
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
                onRegenerate={handleRegenerate}
                isRegenerating={isGenerating}
                onTrackLintFallback={handleLintFallback}
                region={region}
                sellerPackUnlocked={true}
                onSellerPackUpgrade={() => {}}
                isUpgrading={isUpgrading}
                upgradeFailed={upgradeFailed}
                isUnlocked={true}
                paymentsEnabled={false}
                onPaywallClick={() => {}}
                photos={listingPhotos}
              />

              {/* ── Routine context banner — shown when routine was provided ── */}
              {routineContextUsed && routineFitLabel && (
                <RoutineContextBanner
                  label={routineFitLabel}
                  score={routineFitScore ?? 0}
                  summary={routineFitSummary ?? ""}
                />
              )}

              {/* ── Compare CTA — shown after result, surfaces compare flow ── */}
              {!compareBoundTo && (
                <CompareFromReportCTA
                  reportId={receipt.receipt_id}
                />
              )}

              {/* ── Save + Compare — immediately after verdict, max visibility ── */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <SaveReceiptCTA
                    receipt={receipt}
                    onSaveSuccess={() => setHasSaved(true)}
                  />
                </div>
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
              </div>

              {/* Feedback — placed immediately after verdict actions for max visibility */}
              <FeedbackWidget
                contextType="receipt"
                contextId={receipt.receipt_id}
              />

              {/* Active recall banner */}
              {activeRecalls.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-semibold text-red-400 text-sm">
                      Active Recall{activeRecalls.length > 1 ? "s" : ""} on this vehicle
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {activeRecalls.map((r) => (
                      <div key={r.recall_id} className="text-sm text-red-300">
                        <span className="font-medium">{r.component}</span>
                        {r.ai_summary ? `: ${r.ai_summary}` : ""}
                      </div>
                    ))}
                  </div>
                  <a
                    href="/workspace/garage"
                    className="text-xs text-red-400 hover:underline mt-2 inline-block"
                  >
                    View full recall details in My Garage →
                  </a>
                </div>
              )}

              {/* Share / PDF row */}
              <div id="save-receipt-cta" className="flex gap-2">
                <button
                  onClick={handleShareClick}
                  disabled={isSharing}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 text-white/70 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                >
                  <QrCode className="w-4 h-4" />
                  Share
                </button>
                <PdfDownloadButton
                  receiptId={receipt.receipt_id}
                  receiptToken={receiptToken}
                  compact
                />
              </div>

              {/* Extension nudge — shown after receipt loads */}
              <ExtensionNudge context="receipt" />

              {/* Email capture — high visibility, before paywall cards */}
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


              {/* On-demand: extended negotiation scripts */}
              {!isUpgrading && receipt.receipt_id && (
                <NegotiationDeepSection
                  receiptId={receipt.receipt_id}
                  initialStatus={sections?.negotiation_deep?.status}
                  isUnlocked={true}
                  paymentsEnabled={false}
                />
              )}

              {/* Model Info — research links */}
              {receipt.listing_summary?.make && receipt.listing_summary?.model && (
                <ModelInfoSection
                  make={receipt.listing_summary.make}
                  model={receipt.listing_summary.model}
                  year={receipt.listing_summary.year}
                  region={region}
                  trackEvent={trackEvent}
                />
              )}


              {/* EV routine news carousel */}
              <NewsCarousel
                make={receipt.listing_summary?.make}
                model={receipt.listing_summary?.model}
              />

              {/* Deep dive content — free for all users */}
              {deepDive && (
                <DeepDiveSection
                  deepDive={deepDive}
                  receiptId={receipt.receipt_id}
                  region={region}
                />
              )}

              {/* Deep dive loading spinner */}
              {isLoadingDeepDive && !deepDive && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/40">
                  <Loader2 className="w-4 h-4 animate-spin text-[#00d97e]" />
                  Generating your deep dive analysis...
                </div>
              )}

              {/* Compare view (when bound and visible) */}
              {showCompareView && compareReceipt && receipt && (
                <CompareView
                  receiptA={receipt}
                  receiptB={compareReceipt}
                  region={region}
                />
              )}


              {/* Details accordion — on-demand if not yet generated */}
              {receipt.receipt_details ? (
                <ReceiptDetailsAccordion
                  details={receipt.receipt_details}
                  operatorNotes={receipt.operator_notes}
                  listingSummary={receipt.listing_summary}
                  region={region}
                />
              ) : !isUpgrading && receipt.receipt_id ? (
                <ReceiptDetailsOnDemand
                  receiptId={receipt.receipt_id}
                  operatorNotes={receipt.operator_notes}
                  listingSummary={receipt.listing_summary}
                  region={region}
                  initialStatus={sections?.receipt_details?.status}
                />
              ) : null}

              <SourcesFooter />

              {/* Contact/feedback link */}
              <p className="text-center text-sm text-white/40 pt-2">
                Found this helpful? Got questions?{" "}
                <Link
                  href={`/contact?from=receipt&receiptId=${receipt.receipt_id}&verdict=${receipt.verdict}`}
                  onClick={() =>
                    trackEvent("contact_click_post_receipt", {
                      receipt_id: receipt.receipt_id,
                      verdict: receipt.verdict,
                    })
                  }
                  className="text-[#00d97e]/70 hover:text-[#00d97e] underline"
                >
                  Tell us
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Exit-intent feedback modal — triggers when user leaves with a receipt but no feedback */}
      <ExitFeedbackModal hasReceipt={!!receipt} receiptId={receipt?.receipt_id} />

      {/* OFFO Chat — collapsible AI assistant, appears 8s after result */}
      {receipt && receiptToken && (
        <OFfoChat
          scenarioType="receipt"
          scenarioId={receipt.receipt_id}
          sessionId={receiptToken}
          context={{
            vehicle: [receipt.listing_summary.year, receipt.listing_summary.make, receipt.listing_summary.model]
              .filter(Boolean).join(" ") || undefined,
            price: receipt.listing_summary.price ?? undefined,
            mileage: receipt.listing_summary.mileage ?? undefined,
          }}
          paymentsEnabled={false}
          freeMode={true}
          trackEvent={trackEvent}
        />
      )}

      {/* Marketing sections — visible before first receipt */}
      {!receipt && (
        <>
          <HowItWorksSection dark />
          <ExampleAnalysisSection />
          <UniqueAdvantageSection />
          {/* One-time purchase section removed per user request */}
          {/* <PricingSection /> */}
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
        onDelete={deleteReceipt}
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
          region={region}
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

      {/* Post-receipt popup — save + compare, shown 5s after result */}
      <AnimatePresence>
        {showPostReceiptPopup && receipt && (
          <>
            {/* Backdrop */}
            <motion.div
              key="popup-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowPostReceiptPopup(false)}
            />
            {/* Sheet */}
            <motion.div
              key="popup-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#161b22] border border-white/[0.08] rounded-t-2xl shadow-2xl px-5 pt-5 pb-8 max-w-lg mx-auto"
            >
              {/* Drag handle */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

              <h3 className="text-base font-bold text-white mb-1">
                Save to My Garage
              </h3>
              <p className="text-sm text-white/50 mb-5">
                Get recall alerts, AI insights, and easy comparisons — all in one place.
              </p>

              {/* Save */}
              <div className="mb-3">
                <SaveReceiptCTA
                  receipt={receipt}
                  onSaveSuccess={() => {
                    setHasSaved(true);
                    setTimeout(() => {
                      setShowPostReceiptPopup(false);
                      router.push("/workspace/garage");
                    }, 1000);
                  }}
                />
              </div>

              {/* Compare */}
              <button
                onClick={() => {
                  setShowPostReceiptPopup(false);
                  setShowCompareModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.12] text-sm font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition-all"
              >
                Compare with another listing
              </button>

              <button
                onClick={() => setShowPostReceiptPopup(false)}
                className="w-full mt-3 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                Not now
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
