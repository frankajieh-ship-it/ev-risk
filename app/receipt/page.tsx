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
import { Receipt, Loader2, QrCode, Menu, X, Zap, Bell, Bookmark, MessageCircle, ShieldCheck, RefreshCw } from "lucide-react";
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
import FeedbackWidget from "@/components/FeedbackWidget";
import ExitFeedbackModal from "@/components/receipt/ExitFeedbackModal";
import DealerInquiryModal from "@/components/receipt/DealerInquiryModal";
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
const ReceiptSummaryCard = dynamic(() => import("@/components/receipt/ReceiptSummaryCard"), { ssr: false });
const CompareView = dynamic(() => import("@/components/receipt/CompareView"), { ssr: false });
const CompareSelectModal = dynamic(() => import("@/components/receipt/CompareSelectModal"), { ssr: false });
const ShareModal = dynamic(() => import("@/components/receipt/ShareModal"), { ssr: false });
const OFfoChat = dynamic(() => import("@/components/chat/OFfoChat"), { ssr: false });
const ReceiptPaywallCard = dynamic(() => import("@/components/receipt/ReceiptPaywallCard"), { ssr: false });

const PdfDownloadButton = dynamic(() => import("@/components/receipt/PdfDownloadButton"), { ssr: false });
const ReceiptToolsSection = dynamic(() => import("@/components/receipt/ReceiptToolsSection"), { ssr: false });
const CompareBadge = dynamic(() => import("@/components/receipt/CompareBadge"), { ssr: false });
const DealCard = dynamic(() => import("@/components/deals/DealCard").then(m => ({ default: m.default })), { ssr: false });
const FeaturedDeals = dynamic(() => import("@/components/landing/FeaturedDeals"), { ssr: false });
import { SourcesFooter } from "@/components/blocks/SourcesFooter";
import ReturnToRoutinePrompt from "@/components/receipt/ReturnToRoutinePrompt";
import RecallBanner from "@/components/receipt/RecallBanner";
import WorkspaceSaveNudge from "@/components/receipt/WorkspaceSaveNudge";
import PostReceiptPopup from "@/components/receipt/PostReceiptPopup";
import { PurchaseConfirmButton } from "@/components/receipt/PurchaseConfirmButton";
import { buildTweetUrl } from "@/lib/tweet-share";
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

// Live example deals strip — shown on empty state so users see the product before pasting
function LiveExampleDeals({ onSelect }: { onSelect: (url: string) => void }) {
  const [deals, setDeals] = useState<import("@/components/deals/DealCard").CuratedDeal[]>([]);

  useEffect(() => {
    fetch("/api/deals?sort=mileage&per_page=3&mileage_max=40000")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.deals?.length) setDeals(d.deals); })
      .catch(() => {});
  }, []);

  if (!deals.length) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-2">
      <div className="rounded-2xl border border-[#00d97e]/20 bg-[#00d97e]/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#00d97e] mb-1">See it in action</p>
        <p className="text-sm text-white/50 mb-4">Click any listing below to run a live analysis — no sign-up needed.</p>
        <div className="space-y-2">
          {deals.map((deal) => (
            <button
              key={deal.id}
              onClick={() => onSelect(deal.listing_url)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#161b22] border border-white/[0.08] hover:border-[#00d97e]/30 hover:bg-[#00d97e]/[0.04] transition-all text-left group"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{deal.vehicle_label}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {deal.price ? `$${deal.price.toLocaleString()}` : ""}
                  {deal.price && deal.mileage ? " · " : ""}
                  {deal.mileage ? `${deal.mileage.toLocaleString()} mi` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold text-[#00d97e] bg-[#00d97e]/10 px-2 py-0.5 rounded-full group-hover:bg-[#00d97e]/20 transition-colors">
                Analyze →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


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
  const { isAuthenticated, isConfigured: authConfigured, session } = useAuth();
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

  // From EV Routine recommendation flow
  const [fromRoutine, setFromRoutine] = useState(false);
  const [prefillYear, setPrefillYear] = useState<string | null>(null);

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

  // Phase 2: listing age signals from receipt API response
  const [listingFirstSeenAt, setListingFirstSeenAt] = useState<string | null>(null);
  const [listingPriceDropCents, setListingPriceDropCents] = useState<number | null>(null);

  // Phase 3: dealer match — shown when listing URL belongs to an OFFO dealer
  const [dealerInfo, setDealerInfo] = useState<{ id: string; name: string; slug: string; logo_url: string | null; is_verified: boolean } | null>(null);
  const [showInquiryModal, setShowInquiryModal] = useState(false);

  // Receipt token
  const [receiptToken, setReceiptToken] = useState("");

  // Prefill from SEO page or extension
  const [prefillText, setPrefillText] = useState<string | null>(null);
  const [prefillUrl, setPrefillUrl] = useState<string | null>(null);
  const [prefillVin, setPrefillVin] = useState<string | null>(null);
  const [pageSource, setPageSource] = useState<string | null>(null);
  // When coming from deal_watch with a known listing_url, skip extraction and generate directly
  const [dealWatchDirectUrl, setDealWatchDirectUrl] = useState<string | null>(null);

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
    onListingAgeLoaded: ({ firstSeenAt, priceDropCents }) => {
      setListingFirstSeenAt(firstSeenAt);
      setListingPriceDropCents(priceDropCents);
    },
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
  const { deepDive, isLoadingDeepDive, deepDiveFailed, retryDeepDive } = useDeepDive({
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
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  // Post-receipt popup (save + compare) — shown 5s after result
  const [showPostReceiptPopup, setShowPostReceiptPopup] = useState(false);
  const postReceiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listing photos — first extracted photo seeded automatically as a starting point;
  // user adds the rest via drag-and-drop or file upload for full AI coverage.
  const [listingPhotos, setListingPhotos] = useState<string[]>([]);

  // Reset photos when receipt is cleared (new submission starting)
  useEffect(() => {
    if (!receipt) setListingPhotos([]);
  }, [receipt]);

  const handlePhotosFailed = useCallback(() => {}, []);

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
    const attribution = initAttribution();
    // Fall back to attribution-derived source when no sessionStorage page_source was set
    if (!sessionStorage.getItem("offo_page_source") && attribution.page_source) {
      setPageSource(attribution.page_source);
    }

    // Check for return-to-routine flow (?return_to=routine&run_id=X)
    const params = new URLSearchParams(window.location.search);
    if (params.get("return_to") === "routine" && params.get("run_id")) {
      setReturnToRoutine(true);
      setRoutineRunId(params.get("run_id"));
    }

    // ?vin= can come from any entry point (deal card URL or deal card ?id= link)
    const vinParam = params.get("vin");
    if (vinParam) setPrefillVin(vinParam.toUpperCase());

    // Capture entry source from ?src= for any path (homepage VIN, deal_watch, extension)
    const srcParam = params.get("src");
    if (srcParam && !params.get("url") && !params.get("make")) {
      // Only set here if not handled below by the URL/make blocks
      if (srcParam === "deal_watch" || srcParam === "homepage") {
        setPageSource(srcParam);
      }
    }

    // Check for URL prefill (?url=...&ext=true or ?url=...&src=landing)
    const extUrl = params.get("url");
    if (extUrl) {
      const src = srcParam || (params.get("ext") === "true" ? "extension" : "direct_url");
      setPageSource(src);
      if (src === "deal_watch") {
        // Skip extraction — go straight to generate so the deal cache can return the stored receipt
        setDealWatchDirectUrl(extUrl);
      } else {
        setPrefillUrl(extUrl);
      }
      window.history.replaceState({}, "", "/receipt");
    }

    // Check for make/model prefill from vehicle landing pages (?make=Tesla&model=Model+3)
    const prefillMake = params.get("make");
    const prefillModel = params.get("model");
    if (prefillMake && prefillModel && !extUrl) {
      const year = params.get("year");
      const yearPrefix = year ? `${year} ` : "";
      setPrefillText(`${yearPrefix}${prefillMake} ${prefillModel}`);
      if (year) setPrefillYear(year);
      const src = params.get("src");
      if (src === "routine_rec") {
        setFromRoutine(true);
        setPageSource("routine_rec");
      } else {
        setPageSource("vehicle_landing");
      }
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

  // Reset popup + listing age signals when a new receipt comes in
  useEffect(() => {
    setShowPostReceiptPopup(false);
    if (postReceiptTimerRef.current) clearTimeout(postReceiptTimerRef.current);
    setListingFirstSeenAt(null);
    setListingPriceDropCents(null);
    setDealerInfo(null);
  }, [receipt?.receipt_id]);

  // Check if this listing belongs to an OFFO dealer
  useEffect(() => {
    const url = receipt?.listing_summary?.listing_url;
    if (!url) return;
    fetch(`/api/dealer/match-listing?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => { if (data.dealership) setDealerInfo(data.dealership); })
      .catch(() => {});
  }, [receipt?.listing_summary?.listing_url]);

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


  // Payments disabled — no-op stub so existing call sites don't error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePremiumAction = useCallback((_trigger: string) => {}, []);




  // Wrap core generate to also reset compare state when starting a new generation
  const handleGenerate = useCallback(
    (data: Parameters<typeof handleGenerateCore>[0]) => {
      setCompareReceipt(null);
      setShowCompareView(false);
      return handleGenerateCore(data);
    },
    [handleGenerateCore, setCompareReceipt, setShowCompareView]
  );

  // Deal Watch direct-generate: skip extraction, hit receipt API directly so deal cache fires.
  // If there's no cached receipt (400), fall back to prefillUrl so the user can extract normally.
  const dealWatchFiredRef = useRef(false);
  useEffect(() => {
    if (!dealWatchDirectUrl || !receiptToken || dealWatchFiredRef.current) return;
    dealWatchFiredRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receipt_token: receiptToken,
            listing_url: dealWatchDirectUrl,
            mode: "single",
            input_mode: "deal_watch",
            page_source: "deal_watch",
          }),
        });
        const result = await res.json();
        if (result.success && result.source === "deal_cache") {
          // Cache hit — render the stored receipt directly
          setReceipt(result.receipt);
        } else {
          // Cache miss — fall back to extraction flow
          setPrefillUrl(dealWatchDirectUrl);
        }
      } catch {
        setPrefillUrl(dealWatchDirectUrl);
      }
    })();
  }, [dealWatchDirectUrl, receiptToken]); // eslint-disable-line react-hooks/exhaustive-deps

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

        {/* From EV Routine context banner */}
        {fromRoutine && prefillText && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[#00d97e]/[0.07] border border-[#00d97e]/20">
            <span className="text-xs text-[#00d97e]">From your EV Routine match — paste a listing URL below to analyze it</span>
          </div>
        )}

        {/* Input Card */}
        <ReceiptInputCard
          onGenerate={(data) => {
            // If this is an internal dealer listing, set dealerInfo immediately
            // so the "Message Dealer" button is ready when the receipt renders.
            if (data.dealer_info) {
              setDealerInfo({ ...data.dealer_info, is_verified: true });
            }
            handleGenerate(data);
          }}
          onExtractionSuccess={() => {}}
          onExtractionFields={handleExtractionFields}
          onPhotosExtracted={(photos) => {
            // Seed only the first extracted photo — user adds the rest.
            // This gives context without flooding with duplicates.
            if (photos[0]) setListingPhotos([photos[0]]);
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
              {/* Back to EV Routine matches — shown when arriving via routine_rec flow */}
              {fromRoutine && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 mb-3 rounded-xl bg-white/[0.05] border border-white/[0.08]">
                  <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    ← Back to your EV matches
                  </button>
                  <button
                    onClick={() => {
                      if (receipt) {
                        const ls = receipt.listing_summary;
                        addToAnonGarage({
                          type: "receipt",
                          label: `${ls.year} ${ls.make} ${ls.model}`,
                          data: { receipt_id: receipt.receipt_id, verdict: receipt.verdict },
                        });
                      }
                      router.push("/workspace/garage");
                    }}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-[#00d97e] text-[#0d1117] rounded-lg hover:bg-[#00c970] transition-colors"
                  >
                    Save &amp; view garage →
                  </button>
                </div>
              )}

              {/* AI plain-language summary — shown first, auto-generates when upgrade completes */}
              <ReceiptSummaryCard
                receiptId={receipt.receipt_id}
                isUpgrading={isUpgrading}
                generationStatus={isUpgrading ? "lite" : "full"}
                initialSummary={(receipt as unknown as Record<string, unknown>).receipt_summary as import("@/lib/receipt-sections").ListingAISummary ?? null}
                initialStatus={sections?.receipt_summary?.status}
                verdict={receipt.verdict}
                vin={(receipt as unknown as Record<string, unknown>).vin as string | undefined}
              />

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
                sellerPackUnlocked={sellerPackUnlocked}
                onSellerPackUpgrade={() => {}}
                isUpgrading={isUpgrading}
                upgradeFailed={upgradeFailed}
                isUnlocked={isUnlocked}
                paymentsEnabled={paymentsEnabled}
                onPaywallClick={() => handlePremiumAction("output_card")}
                photos={listingPhotos}
                receiptId={receipt?.receipt_id}
                vin={receipt?.vin ?? undefined}
                onSave={handleQuickSave}
                saveState={hasSaved ? "saved" : "idle"}
                onCompare={() => setShowCompareModal(true)}
                showCompare={authConfigured}
                firstSeenAt={listingFirstSeenAt}
                priceDropCents={listingPriceDropCents}
                dealerInfo={dealerInfo}
                onContactDealer={dealerInfo ? () => setShowInquiryModal(true) : undefined}
                onPhotosFailed={handlePhotosFailed}
                onAddPhotos={(dataUrls) => setListingPhotos(prev => [...prev, ...dataUrls])}
              />
              </div>


              {/* Retention hook — shown immediately after result so unauthenticated users see it first */}
              {!isAuthenticated && (
                <WorkspaceSaveNudge onSignIn={() => setShowAuthPrompt(true)} />
              )}

              {/* ── Paywall or deep sections ── */}
              {!isUnlocked && paymentsEnabled ? (
                <ReceiptPaywallCard
                  receiptToken={receiptToken}
                  scenarioId={receipt.receipt_id}
                />
              ) : (
                <>
                  {receipt.receipt_id && (
                    <NegotiationDeepSection
                      receiptId={receipt.receipt_id}
                      initialScripts={(receipt as unknown as Record<string, unknown>).negotiation_deep as import("@/lib/receipt-sections").NegotiationScript[] ?? null}
                      initialStatus={sections?.negotiation_deep?.status}
                      isUnlocked={isUnlocked}
                      paymentsEnabled={paymentsEnabled}
                    />
                  )}
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
                  {deepDiveFailed && !deepDive && !isLoadingDeepDive && (
                    <div className="flex flex-col items-center gap-3 py-6 text-sm text-white/40">
                      <p>Deep dive analysis could not be generated.</p>
                      <button
                        onClick={retryDeepDive}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white/80 transition-colors text-xs font-medium"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry deep dive
                      </button>
                    </div>
                  )}
                  {receipt.receipt_details ? (
                    <ReceiptDetailsAccordion
                      details={receipt.receipt_details}
                      operatorNotes={receipt.operator_notes}
                      listingSummary={receipt.listing_summary}
                      region={region}
                    />
                  ) : receipt.receipt_id ? (
                    <ReceiptDetailsOnDemand
                      receiptId={receipt.receipt_id}
                      operatorNotes={receipt.operator_notes}
                      listingSummary={receipt.listing_summary}
                      region={region}
                      initialStatus={sections?.receipt_details?.status}
                    />
                  ) : null}
                </>
              )}

              {/* ── Next-step CTA bar ────────────────────────────────── */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">What&apos;s next?</p>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <Link
                    href={`/receipt?compare=${receipt.receipt_id}`}
                    onClick={() => trackEvent("cta_compare_clicked", { receipt_id: receipt.receipt_id })}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-[#00d97e]/20 bg-[#00d97e]/[0.04] text-[#00d97e] hover:bg-[#00d97e]/10 transition-colors text-center"
                  >
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-semibold leading-tight">Compare another<br />listing</span>
                  </Link>
                  <Link
                    href="/workspace/deal-watch"
                    onClick={() => trackEvent("cta_deal_watch_clicked", { receipt_id: receipt.receipt_id })}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-white/[0.08] text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-colors text-center"
                  >
                    <Bell className="w-4 h-4" />
                    <span className="text-xs leading-tight">Set up<br />deal watch</span>
                  </Link>
                  {shareSlug && (
                    <a
                      href={buildTweetUrl(receipt, shareSlug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent("cta_tweet_clicked", { receipt_id: receipt.receipt_id, verdict: receipt.verdict })}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-white/[0.08] text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-colors text-center"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.26 5.632 5.905-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span className="text-xs leading-tight">Post to X</span>
                    </a>
                  )}
                  <button
                    onClick={() => {
                      trackEvent("cta_tools_clicked", { receipt_id: receipt.receipt_id });
                      document.getElementById("receipt-tools-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-white/[0.08] text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-colors text-center"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs leading-tight">Run the<br />numbers</span>
                  </button>
                </div>
                {/* "I bought this" — only shown to authenticated users whose garage has this car */}
                {isAuthenticated && session?.access_token && receipt && (
                  <PurchaseConfirmButton
                    receiptId={receipt.receipt_id}
                    authToken={session.access_token}
                    verdict={receipt.verdict}
                    vin={receipt.vin ?? null}
                  />
                )}

                <button
                  onClick={() => {
                    trackEvent("cta_chat_clicked", { receipt_id: receipt.receipt_id });
                    const bubble = document.querySelector<HTMLElement>("[data-offo-chat-trigger]");
                    if (bubble) bubble.click();
                    else window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-white/[0.06] text-white/40 hover:text-white/60 hover:border-white/[0.10] hover:bg-white/[0.03] transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="text-xs">Ask AI about this vehicle</span>
                </button>
              </div>

              {/* Tools — pre-populated from receipt data */}
              <div id="receipt-tools-section">
                <ReceiptToolsSection
                  make={receipt.listing_summary?.make}
                  model={receipt.listing_summary?.model}
                  year={receipt.listing_summary?.year}
                  mileage={receipt.listing_summary?.mileage}
                  price={receipt.listing_summary?.price}
                  batteryKwh={(receipt.listing_summary as Record<string, unknown>)?.battery_kwh as number | undefined}
                  rangeMi={(receipt.listing_summary as Record<string, unknown>)?.range_mi as number | undefined}
                  dcFastKw={(receipt.listing_summary as Record<string, unknown>)?.dc_fast_kw as number | undefined}
                />
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

              {/* ── Deal Watch (full curated section) ───────────────── */}
              <FeaturedDeals />

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
          paymentsEnabled={paymentsEnabled}
          freeMode={freeMode}
          trackEvent={trackEvent}
        />
      )}

      {/* Marketing sections — visible before first receipt */}
      {!receipt && (
        <>
          <LiveExampleDeals onSelect={(url) => setPrefillUrl(url)} />
          <HowItWorksSection dark />
          <ExampleAnalysisSection />
          <UniqueAdvantageSection />
        </>
      )}

      {/* Dealer inquiry modal — shown when user clicks Contact Dealer on a verified dealer listing */}
      {showInquiryModal && dealerInfo && (
        <DealerInquiryModal
          dealerInfo={dealerInfo}
          vehicleLabel={[receipt?.listing_summary?.year, receipt?.listing_summary?.make, receipt?.listing_summary?.model].filter(Boolean).join(" ") || "this vehicle"}
          isAuthenticated={isAuthenticated}
          accessToken={session?.access_token ?? null}
          onClose={() => setShowInquiryModal(false)}
          receiptId={receipt?.receipt_id ?? null}
        />
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
