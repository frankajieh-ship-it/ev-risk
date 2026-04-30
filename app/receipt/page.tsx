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
import { Receipt, Loader2, QrCode, Menu, X, Zap, Bookmark, MessageCircle } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { addToAnonGarage } from "@/lib/anon-garage";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { initAttribution } from "@/lib/attribution";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { useTurnstile } from "@/hooks/useTurnstile";
import LoginModal from "@/components/LoginModal";
import AuthLoginModal from "@/components/auth/LoginModal";
import ReceiptInputCard from "@/components/receipt/ReceiptInputCard";
import ReceiptOutputCard from "@/components/receipt/ReceiptOutputCard";
import EmailCaptureCard from "@/components/receipt/EmailCaptureCard";
// EmailGateModal removed — 100% skip rate, replaced by inline EmailCaptureCard
import FeedbackWidget from "@/components/FeedbackWidget";
import ExitFeedbackModal from "@/components/receipt/ExitFeedbackModal";
import dynamic from "next/dynamic";

// Heavy components lazy-loaded — not needed for initial receipt render
// All below-fold and conditional components are lazy — keeps initial bundle lean
const HowItWorksSection = dynamic(() => import("@/components/landing/HowItWorksSection"), { ssr: false });
const ExampleAnalysisSection = dynamic(() => import("@/components/landing/ExampleAnalysisSection"), { ssr: false });
const UniqueAdvantageSection = dynamic(() => import("@/components/landing/UniqueAdvantageSection"), { ssr: false });
const Footer = dynamic(() => import("@/components/landing/Footer"), { ssr: false });
const ModelInfoSection = dynamic(() => import("@/components/receipt/ModelInfoSection"), { ssr: false });
const ReceiptDetailsAccordion = dynamic(() => import("@/components/receipt/ReceiptDetailsAccordion"), { ssr: false });
const ReceiptHistoryDrawer = dynamic(() => import("@/components/receipt/ReceiptHistoryDrawer"), { ssr: false });
const NewsCarousel = dynamic(() => import("@/components/NewsCarousel"), { ssr: false });
const DeepDiveSection = dynamic(() => import("@/components/receipt/DeepDiveSection"), { ssr: false });
const NegotiationDeepSection = dynamic(() => import("@/components/receipt/NegotiationDeepSection"), { ssr: false });
const CompareView = dynamic(() => import("@/components/receipt/CompareView"), { ssr: false });
const CompareSelectModal = dynamic(() => import("@/components/receipt/CompareSelectModal"), { ssr: false });
const ShareModal = dynamic(() => import("@/components/receipt/ShareModal"), { ssr: false });
const OFfoChat = dynamic(() => import("@/components/chat/OFfoChat"), { ssr: false });

const PdfDownloadButton = dynamic(() => import("@/components/receipt/PdfDownloadButton"), { ssr: false });
const CompareBadge = dynamic(() => import("@/components/receipt/CompareBadge"), { ssr: false });
const DealCard = dynamic(() => import("@/components/deals/DealCard").then(m => ({ default: m.default })), { ssr: false });
const TutorialModal = dynamic(() => import("@/components/TutorialModal"), { ssr: false });
import { SourcesFooter } from "@/components/blocks/SourcesFooter";
import ReturnToRoutinePrompt from "@/components/receipt/ReturnToRoutinePrompt";
import RecallBanner from "@/components/receipt/RecallBanner";
import WorkspaceSaveNudge from "@/components/receipt/WorkspaceSaveNudge";
import PostReceiptPopup from "@/components/receipt/PostReceiptPopup";
import { useReceiptGeneration } from "@/hooks/useReceiptGeneration";
import { useDeepDive } from "@/hooks/useDeepDive";
import { useCompareState } from "@/hooks/useCompareState";
import { useShareReceipt } from "@/hooks/useShareReceipt";
import { useReceiptHistory } from "@/hooks/useReceiptHistory";
import { useRegion } from "@/hooks/useRegion";
import RegionSelector from "@/components/RegionSelector";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import type { ListingReceipt, DeepDiveContent } from "@/types/receipt";
import type { MinimumViableRoutine } from "@/types/v2";
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
          <div className="space-y-2">
            <p className="text-xs text-white/40 text-center">Fee estimates couldn&apos;t load — this is usually a temporary issue.</p>
            <button
              onClick={generate}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white/60 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg border border-white/[0.10] transition-colors"
            >
              Try again
            </button>
          </div>
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

  // History
  const [historyOpen, setHistoryOpen] = useState(false);

  // Pro state
  const [isPro, setIsPro] = useState(false);

  // Receipt token
  const [receiptToken, setReceiptToken] = useState("");

  // Prefill from SEO page or extension
  const [prefillText, setPrefillText] = useState<string | null>(null);
  const [prefillUrl, setPrefillUrl] = useState<string | null>(null);
  const [prefillVin, setPrefillVin] = useState<string | null>(null);
  const [pageSource, setPageSource] = useState<string | null>(null);

  // Receipt history (merged server + localStorage)
  const {
    history,
    isLoading: isHistoryLoading,
    addReceipt,
    deleteReceipt,
    clearHistory,
  } = useReceiptHistory(receiptToken);

  // Scroll target for result visibility
  const resultRef = useRef<HTMLDivElement>(null);

  const { execute: executeTurnstile } = useTurnstile({
    containerId: "turnstile-receipt",
    action: "receipt-submit",
  });

  const {
    receipt, setReceipt,
    lintPassed, lintErrors,
    isGenerating, generatingStep,
    isFixing,
    error, setError,
    remainingFree,
    isFallback, isSimilarityMatch,
    isUpgrading, upgradeFailed,
    currentVin, sections,
    lastGenerateInputRef,
    handleGenerate: handleGenerateCore, handleRegenerate, handleAutoFix, handleHistorySelect,
  } = useReceiptGeneration({
    receiptToken,
    region,
    trackEvent,
    addReceipt,
    executeTurnstile,
    routineContext,
    pageSource,
    onRoutineContextUsed: ({ fitLabel, fitScore, fitSummary }) => {
      setRoutineContextUsed(true);
      setRoutineFitLabel(fitLabel);
      setRoutineFitScore(fitScore);
      setRoutineFitSummary(fitSummary);
    },
    onRecallsLoaded: setActiveRecalls,
    onIsProChanged: setIsPro,
  });

  // Payment status hook (needs receipt which comes from useReceiptGeneration above)
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

  // Decision Pack state
  const [decisionPackDismissed, setDecisionPackDismissed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<string | null>(null);
  const paywallShownForRef = useRef<Set<string>>(new Set());

  // Seller Pack state
  const [showSellerPackPaywall, setShowSellerPackPaywall] = useState(false);
  const [sellerPackDismissed, setSellerPackDismissed] = useState(false);

  // Compare state (hook)
  const {
    compareReceipt, setCompareReceipt,
    showCompareModal, setShowCompareModal,
    showCompareView, setShowCompareView,
    showCompareLoginModal, setShowCompareLoginModal,
  } = useCompareState({
    compareBoundTo,
    receiptId: receipt?.receipt_id,
    receiptToken,
    history,
  });

  // Share state (hook)
  const {
    showShareModal, setShowShareModal,
    shareUrl, shareSlug,
    isSharing, handleShareClick,
  } = useShareReceipt({ receipt, receiptToken, trackEvent });

  // Deep dive (hook — auto-loads on receipt change)
  const { deepDive, isLoadingDeepDive } = useDeepDive({
    receiptId: receipt?.receipt_id,
    receiptToken,
  });

  // Retention capture state — initialised from localStorage to avoid flicker
  const [hasSaved, setHasSaved] = useState(false);
  // Sync hasSaved when receipt changes (e.g. loaded via ?id= param)
  useEffect(() => {
    if (!receipt?.receipt_id) return;
    try {
      const existing = JSON.parse(localStorage.getItem("offo_saved_receipts") || "[]");
      setHasSaved(existing.some((r: { receipt_id: string }) => r.receipt_id === receipt.receipt_id));
    } catch { setHasSaved(false); }
  }, [receipt?.receipt_id]);
  const [hasEmailed, setHasEmailed] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  // Post-receipt popup (save + compare) — shown 5s after result
  const [showPostReceiptPopup, setShowPostReceiptPopup] = useState(false);
  const postReceiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listing photos from Auto.dev enrichment
  const [listingPhotos, setListingPhotos] = useState<string[]>([]);

  // When receipt is loaded by ?id= (not via extraction), populate photos from stored data
  useEffect(() => {
    if (!receipt) return;
    if (listingPhotos.length > 0) return;
    if (receipt.photo_urls?.length) {
      setListingPhotos(receipt.photo_urls);
      return;
    }
    const make = receipt.listing_summary?.make;
    const model = receipt.listing_summary?.model;
    const year = receipt.listing_summary?.year;
    const vin = receipt.vin;
    if (!make && !vin) return;
    const photoParams = new URLSearchParams();
    if (make) photoParams.set("make", make);
    if (model) photoParams.set("model", model);
    if (year) photoParams.set("year", String(year));
    if (vin) photoParams.set("vin", vin);
    fetch(`/api/photos?${photoParams}`)
      .then((r) => r.json())
      .then((d: { photo_urls?: string[] }) => {
        if (d.photo_urls?.length) setListingPhotos(d.photo_urls);
      })
      .catch(() => {});
  }, [receipt?.receipt_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Matching deals for this vehicle
  const [matchingDeals, setMatchingDeals] = useState<import("@/components/deals/DealCard").CuratedDeal[]>([]);

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

    // ?vin= can come from any entry point (deal card URL or deal card ?id= link)
    const vinParam = params.get("vin");
    if (vinParam) setPrefillVin(vinParam.toUpperCase());

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
    const resumeId = params.get("resume") || params.get("id");

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

    trackEvent("receipt_purchase_succeeded", {
      receipt_id: receipt?.receipt_id,
      offer_type: "receipt_single_399",
      session_id: params.get("session_id"),
    });

    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");
    url.searchParams.delete("scenario_type");
    url.searchParams.delete("scenario_id");
    window.history.replaceState({}, "", url.pathname + url.search);

    // Poll payment status until purchase is confirmed paid (max 30s), then auto-generate
    let attempts = 0;
    const maxAttempts = 15;
    const poll = setInterval(async () => {
      attempts++;
      await refetchPayment();
      // Once payment confirmed, re-run generate with last known input
      if (attempts >= maxAttempts) {
        clearInterval(poll);
      }
    }, 2000);

    return () => clearInterval(poll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps



  // Ensure any receipt (including those loaded by ?id=) is in history so compare works
  useEffect(() => {
    if (!receipt?.receipt_id) return;
    addReceipt(receipt);
  }, [receipt?.receipt_id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Fetch matching deals for this vehicle when a receipt loads
  useEffect(() => {
    if (!receipt) { setMatchingDeals([]); return; }
    const make = receipt.listing_summary?.make;
    const model = receipt.listing_summary?.model;
    if (!make) return;
    const params = new URLSearchParams({ verdict: "GREEN,YELLOW", per_page: "3" });
    params.set("make", make);
    if (model) params.set("model", model);
    fetch(`/api/deals?${params}`)
      .then((r) => r.json())
      .then((d: { deals?: import("@/components/deals/DealCard").CuratedDeal[] }) => {
        setMatchingDeals(d.deals ?? []);
      })
      .catch(() => {});
  }, [receipt?.receipt_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stock photo fallback intentionally removed — only show photos extracted
  // directly from the listing page (onPhotosExtracted). Generic make/model
  // lookups return wrong-year or wrong-trim stock images that mislead users.

  // Reset popup when a new receipt comes in
  useEffect(() => {
    setShowPostReceiptPopup(false);
    if (postReceiptTimerRef.current) clearTimeout(postReceiptTimerRef.current);
  }, [receipt?.receipt_id]);

  // Post-receipt popup: show 12s after deep dive loads so user can read it first
  useEffect(() => {
    if (!deepDive) return;
    if (postReceiptTimerRef.current) clearTimeout(postReceiptTimerRef.current);
    postReceiptTimerRef.current = setTimeout(() => {
      setShowPostReceiptPopup(true);
    }, 12000);
    return () => {
      if (postReceiptTimerRef.current) clearTimeout(postReceiptTimerRef.current);
    };
  }, [deepDive]);

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



  // Wrap core generate to also reset compare state when starting a new generation
  const handleGenerate = useCallback(
    (data: Parameters<typeof handleGenerateCore>[0]) => {
      setCompareReceipt(null);
      setShowCompareView(false);
      return handleGenerateCore(data);
    },
    [handleGenerateCore, setCompareReceipt, setShowCompareView]
  );

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

  // Quick save from top-of-card icon (mirrors SaveReceiptCTA logic)
  const handleQuickSave = useCallback(() => {
    if (!receipt || hasSaved) return;
    try {
      const LOCAL_KEY = "offo_saved_receipts";
      const existing = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      if (!existing.some((r: { receipt_id: string }) => r.receipt_id === receipt.receipt_id)) {
        const s = receipt.listing_summary;
        existing.push({
          receipt_id: receipt.receipt_id,
          vehicle: [s?.year, s?.make, s?.model, s?.trim].filter(Boolean).join(" "),
          verdict: receipt.verdict,
          verdict_reason: receipt.verdict_reason || null,
          price: s?.price || null,
          mileage: s?.mileage || null,
          saved_at: new Date().toISOString(),
        });
        localStorage.setItem(LOCAL_KEY, JSON.stringify(existing));
        addToAnonGarage({
          type: "receipt",
          label: [s?.year, s?.make, s?.model].filter(Boolean).join(" ") || "Unknown Vehicle",
          data: { receipt_id: receipt.receipt_id, verdict: receipt.verdict, verdict_reason: receipt.verdict_reason || null, price: s?.price || null, mileage: s?.mileage || null },
        });
      }
    } catch { /* ignore */ }
    setHasSaved(true);
    trackEvent("scenario_save_clicked", { receipt_id: receipt.receipt_id, source: "card_icon" });
  }, [receipt, hasSaved, trackEvent]);

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


  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Dark nav — same pattern as homepage */}
      <nav className="sticky top-0 z-50 bg-[#0d1117] border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/">
            <Image src="/offo-logo.jpg" alt="OFFO" width={200} height={103} className="w-24 sm:w-28 h-auto" priority />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/receipt" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Receipt Check</Link>
            <Link href="/" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Routine Fit</Link>
            <Link href="/copart" className="text-[0.8125rem] font-medium text-white/60 hover:text-white transition-colors">Copart Arbitrage</Link>
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
          prefillVin={prefillVin}
          trackEvent={trackEvent}
          receiptToken={receiptToken}
          hasResult={!!receipt}
        />


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

        {/* Return to Routine prompt — shown when coming from a routine context */}
        {returnToRoutine && (
          <ReturnToRoutinePrompt
            vehicleReady={routineVehicleReady}
            onReturn={handleReturnToRoutine}
          />
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
              <div data-tutorial="receipt-output">
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
                photos={isSimilarityMatch ? [] : listingPhotos}
                onSave={handleQuickSave}
                saveState={hasSaved ? "saved" : "idle"}
                onCompare={() => setShowCompareModal(true)}
                showCompare={authConfigured}
              />
              </div>

              {/* On-demand: extended negotiation scripts — moved here for prominence */}
              {!isUpgrading && receipt.receipt_id && (
                <NegotiationDeepSection
                  receiptId={receipt.receipt_id}
                  initialStatus={sections?.negotiation_deep?.status}
                  isUnlocked={true}
                  paymentsEnabled={false}
                />
              )}

              {/* Email capture — shown after negotiation scripts */}
              {!hasEmailed && (
                <div id="email-capture-card">
                  <EmailCaptureCard
                    receiptId={receipt.receipt_id}
                    onSubmit={() => {
                      setHasEmailed(true);
                      trackEvent("email_checklist_submit", {
                        receipt_id: receipt.receipt_id,
                      });
                    }}
                    onGarageSave={() => {
                      addToAnonGarage({
                        type: "receipt",
                        label: `${receipt.listing_summary?.year ?? ""} ${receipt.listing_summary?.make ?? ""} ${receipt.listing_summary?.model ?? ""}`.trim() || "Saved Receipt",
                        data: receipt as unknown as Record<string, unknown>,
                      });
                      setHasSaved(true);
                    }}
                  />
                </div>
              )}

              {/* ── Deep-dive nudge banner */}
              <div className="rounded-xl border border-[#00d97e]/20 bg-[#00d97e]/[0.04] px-4 py-3.5 flex items-start gap-3">
                <Zap className="w-4 h-4 text-[#00d97e] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">More analysis below</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                    Scroll down for deep-dive negotiation scripts, cost of ownership breakdown, and model-specific known issues.
                  </p>
                </div>
              </div>

              {/* ── Next-step CTA bar ────────────────────────────────── */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">What&apos;s next?</p>
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href="/routine"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent("cta_routine_clicked", { receipt_id: receipt.receipt_id })}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-lg border border-white/[0.08] text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-colors text-center"
                  >
                    <Zap className="w-4 h-4 text-[#00d97e]" />
                    <span className="text-xs leading-tight">Does this fit<br />your routine?</span>
                  </a>
                  <button
                    onClick={handleQuickSave}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-lg border border-white/[0.08] text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-colors"
                  >
                    <Bookmark className={`w-4 h-4 ${hasSaved ? "text-[#00d97e] fill-[#00d97e]" : ""}`} />
                    <span className="text-xs">{hasSaved ? "Saved" : "Save deal"}</span>
                  </button>
                  <button
                    onClick={() => {
                      trackEvent("cta_chat_clicked", { receipt_id: receipt.receipt_id });
                      const bubble = document.querySelector<HTMLElement>("[data-offo-chat-trigger]");
                      if (bubble) bubble.click();
                      else window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                    }}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-lg border border-white/[0.08] text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-xs leading-tight">Ask AI<br />about this</span>
                  </button>
                </div>
              </div>

              {/* ── Matching Deals Strip ─────────────────────────────── */}
              {matchingDeals.length > 0 && (
                <div className="rounded-xl border border-white/[0.08] bg-[#161b22] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#00d97e]">Deal Watch</p>
                      <h3 className="text-sm font-semibold text-white mt-0.5">
                        Other {receipt?.listing_summary?.make} {receipt?.listing_summary?.model} listings we&apos;ve analyzed
                      </h3>
                    </div>
                    <Link href="/deals" className="text-xs text-white/40 hover:text-white/70 transition-colors">See all →</Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {matchingDeals.map((deal, i) => (
                      <DealCard key={deal.id} deal={deal} compact rank={i + 1} />
                    ))}
                  </div>
                </div>
              )}

              {/* Deep dive — moved to top as primary result section */}
              {deepDive && (
                <DeepDiveSection
                  deepDive={deepDive}
                  receiptId={receipt.receipt_id}
                  region={region}
                />
              )}
              {isLoadingDeepDive && !deepDive && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/40">
                  <Loader2 className="w-4 h-4 animate-spin text-[#00d97e]" />
                  Generating your deep dive analysis...
                </div>
              )}


              {/* Compare — shown when auth is configured */}
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

              {/* Feedback — placed immediately after verdict actions for max visibility */}
              <FeedbackWidget
                contextType="receipt"
                contextId={receipt.receipt_id}
              />

              {/* Active recall banner */}
              <RecallBanner recalls={activeRecalls} />

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

              {/* Workspace save nudge — shown to unauthenticated users after receipt loads */}
              {!isAuthenticated && (
                <WorkspaceSaveNudge onSignIn={() => setShowAuthPrompt(true)} />
              )}


              {/* EV routine news carousel */}
              <NewsCarousel
                make={receipt.listing_summary?.make}
                model={receipt.listing_summary?.model}
              />


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

              {/* Model Info — research links (at bottom, after all analysis) */}
              {receipt.listing_summary?.make && receipt.listing_summary?.model && (
                <ModelInfoSection
                  make={receipt.listing_summary.make}
                  model={receipt.listing_summary.model}
                  year={receipt.listing_summary.year}
                  region={region}
                  trackEvent={trackEvent}
                />
              )}

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

      {/* Tutorial modal — floating "?" button shown only before first receipt */}
      {!receipt && <TutorialModal />}

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
        onSelect={(entry) => { handleHistorySelect(entry); setHistoryOpen(false); }}
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

      {/* Auth prompt modal — triggered by workspace save nudge */}
      <AuthLoginModal
        key={showAuthPrompt ? 1 : 0}
        open={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        redirectAfter={`/workspace?from_receipt=${receipt?.receipt_id ?? ""}`}
        headline="Save this report to your workspace"
        subtext="Free account — track deals, compare EVs, and get price alerts."
      />

      {/* Email gate modal removed — 100% skip rate, inline capture card is better */}

      {/* Post-receipt popup — save + compare, shown 5s after result */}
      <PostReceiptPopup
        show={showPostReceiptPopup}
        receipt={receipt}
        onClose={() => setShowPostReceiptPopup(false)}
        onSaveSuccess={() => {
          setHasSaved(true);
          setTimeout(() => {
            setShowPostReceiptPopup(false);
            router.push("/workspace/garage");
          }, 1000);
        }}
        onCompare={() => setShowCompareModal(true)}
      />

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
