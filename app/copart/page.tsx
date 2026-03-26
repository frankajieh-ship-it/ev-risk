/**
 * /copart — Copart Auction Fit & Risk Advisor
 *
 * Phase 1: salvage risk score + bid guidance + standard receipt
 * Phase 2: arbitrage calculator + title flags (unlocked after $19.99 payment)
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, AlertTriangle, Loader2, ChevronRight } from "lucide-react";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import { computeSalvageRisk } from "@/lib/salvage-risk-scorer";
import { useEventTracking } from "@/hooks/useEventTracking";
import SalvageRiskCard from "@/components/copart/SalvageRiskCard";
import AuctionBidGuidanceCard from "@/components/copart/AuctionBidGuidanceCard";
import CopartUnlockCard from "@/components/copart/CopartUnlockCard";
import ArbitrageCalculatorCard from "@/components/copart/ArbitrageCalculatorCard";
import TitleFlagsCard from "@/components/copart/TitleFlagsCard";
import SaveReceiptCTA from "@/components/receipt/SaveReceiptCTA";
import ReceiptOutputCard from "@/components/receipt/ReceiptOutputCard";
import type { ListingReceipt } from "@/types/receipt";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";

type PageState = "idle" | "fetching" | "generating" | "done" | "error";

const SESSION_KEY = "offo_copart_session";

interface StoredSession {
  input: string;
  receiptId: string;
}

function isCopartUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.hostname.endsWith("copart.com") || u.hostname.endsWith("iaai.com");
  } catch {
    return false;
  }
}

function extractVinFromText(text: string): string | null {
  const match = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
  return match ? match[1].toUpperCase() : null;
}

function parseCopartHtml(html: string): { vin?: string; listingText: string } {
  const vinMatch =
    html.match(/["']vin["']\s*:\s*["']([A-HJ-NPR-Z0-9]{17})["']/i) ||
    html.match(/VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i) ||
    html.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);

  const vin = vinMatch ? vinMatch[1].toUpperCase() : undefined;

  const stripped = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 4000);

  return { vin, listingText: stripped };
}

export default function CopartPage() {
  const { trackEvent } = useEventTracking();
  const [input, setInput] = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ListingReceipt | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [salvageRisk, setSalvageRisk] = useState<SalvageRiskResult | null>(null);
  const [detectedVin, setDetectedVin] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [showUnlock, setShowUnlock] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Store the listing text for the arbitrage card (ref = no re-render)
  const listingTextRef = useRef("");

  const receiptToken = typeof window !== "undefined" ? getOrCreateReceiptToken() : "";

  // ── Check payment status when we have a receiptId ────────────────────────
  useEffect(() => {
    if (!receiptId || !receiptToken) return;
    fetch(`/api/payments/status?scenario_type=copart&scenario_id=${receiptId}&anon_id=${receiptToken}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.unlocked_base) {
          setIsUnlocked(true);
          setShowUnlock(false);
        }
      })
      .catch(() => {});
  }, [receiptId, receiptToken]);

  // ── Handle Stripe redirect return (?checkout=success) ───────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    // Restore session from sessionStorage
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const session: StoredSession = JSON.parse(stored);
        sessionStorage.removeItem(SESSION_KEY);
        setInput(session.input);
        setReceiptId(session.receiptId);
        setIsUnlocked(true);
        setShowUnlock(false);
        setPageState("done");
        // Re-run analysis to restore receipt + risk data
        // (triggers via the input being set in state + user can re-click, or we auto-run)
      }
    } catch { /* ignore */ }

    // Remove checkout query param from URL without reload
    const clean = window.location.pathname;
    window.history.replaceState({}, "", clean);
  }, []);

  const handleAnalyze = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setPageState("idle");
    setErrorMsg(null);
    setReceipt(null);
    setSalvageRisk(null);
    setReceiptId(null);
    setDetectedVin(null);
    setHasSaved(false);
    setShowUnlock(true);
    setIsUnlocked(false);

    trackEvent("copart_analyze_started", { input_type: isCopartUrl(trimmed) ? "url" : "vin_or_text" });

    let listingText = trimmed;
    let vin: string | undefined;
    let listingUrl: string | undefined;

    // Step 1: if URL, proxy-fetch HTML
    if (isCopartUrl(trimmed)) {
      setPageState("fetching");
      setStatusMsg("Fetching auction lot...");

      try {
        const res = await fetch("/api/proxy-fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await res.json();

        if (data.success && data.html) {
          const parsed = parseCopartHtml(data.html);
          listingText = parsed.listingText;
          vin = parsed.vin ?? undefined;
          if (vin) setDetectedVin(vin);
          listingUrl = trimmed;
        } else {
          console.warn("[Copart] Proxy fetch failed:", data.error);
        }
      } catch (e) {
        console.warn("[Copart] Proxy fetch error:", e);
      }
    } else {
      vin = extractVinFromText(trimmed) ?? undefined;
      if (vin) setDetectedVin(vin);
    }

    // Store listing text for arbitrage card
    listingTextRef.current = listingText;

    // Step 2: generate receipt via /api/receipt
    setPageState("generating");
    setStatusMsg("Analyzing vehicle...");

    try {
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_url: listingUrl ?? null,
          listing_text: listingText,
          vin: vin ?? null,
          receipt_token: receiptToken,
          title_status: "salvage",
          seller_type: "auction",
          listing_source: "copart",
        }),
      });

      const data = await res.json();

      if (!data.success || !data.receipt) {
        setPageState("error");
        setErrorMsg(data.error || "Analysis failed. Please try again.");
        return;
      }

      const r: ListingReceipt = data.receipt;
      const rid: string = data.receipt_id ?? "";

      setReceipt(r);
      setReceiptId(rid);

      // Store session for post-Stripe restore
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ input: trimmed, receiptId: rid } as StoredSession));
      } catch { /* ignore */ }

      // Step 3: compute salvage risk
      const ls = r.listing_summary;
      const risk = computeSalvageRisk({
        title_status: ls.title_status,
        accidents_reported: ls.accidents_reported,
        mileage: ls.mileage,
        price: ls.price,
        listing_text: listingText,
        zip_or_postcode: ls.zip_or_postcode,
      });
      setSalvageRisk(risk);

      setPageState("done");
      trackEvent("copart_analyze_completed", {
        receipt_id: rid,
        salvage_grade: risk.grade,
        salvage_score: risk.score,
      });
    } catch (err) {
      setPageState("error");
      setErrorMsg("Connection error. Please try again.");
      trackEvent("copart_analyze_failed", { error: err instanceof Error ? err.message : "unknown" });
    }
  }, [input, receiptToken, trackEvent]);

  const isLoading = pageState === "fetching" || pageState === "generating";

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-100 px-3 py-1 rounded-full mb-4">
            <AlertTriangle className="w-3.5 h-3.5" />
            Salvage & Auction Intelligence
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Evaluate any Copart auction before you bid
          </h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Paste a Copart lot URL or VIN. Get a salvage risk score, ARV, repair cost estimate, and max safe bid.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Copart lot URL or VIN
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.copart.com/lot/... or 1GNSKSKL2NR123456 or paste listing details"
            className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !input.trim()}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 transition-all shadow-sm disabled:opacity-50"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {statusMsg}</>
            ) : (
              <><Search className="w-4 h-4" /> Get Fit &amp; Risk Report</>
            )}
          </button>
        </div>

        {/* Error */}
        {pageState === "error" && errorMsg && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Results */}
        {pageState === "done" && receipt && salvageRisk && (
          <div className="space-y-4">
            {/* Phase 1: Salvage risk + bid guidance (always shown) */}
            <SalvageRiskCard result={salvageRisk} />

            <AuctionBidGuidanceCard
              result={salvageRisk}
              vin={detectedVin}
              askingPrice={receipt.listing_summary.price || null}
            />

            {/* Phase 2: Arbitrage + title flags (unlocked content) */}
            {isUnlocked && receiptId && (
              <>
                <ArbitrageCalculatorCard
                  receiptId={receiptId}
                  vin={detectedVin}
                  listingText={listingTextRef.current}
                  askingPrice={receipt.listing_summary.price || null}
                  make={receipt.listing_summary.make || null}
                  model={receipt.listing_summary.model || null}
                  year={receipt.listing_summary.year || null}
                  trim={receipt.listing_summary.trim || null}
                  receiptToken={receiptToken}
                />
                <TitleFlagsCard zip={receipt.listing_summary.zip_or_postcode} />
              </>
            )}

            {/* Standard receipt */}
            <ReceiptOutputCard
              receipt={receipt}
              lintPassed={true}
              lintErrors={[]}
              region="US"
            />

            {/* Save to Garage */}
            <SaveReceiptCTA
              receipt={receipt}
              onSaveSuccess={() => setHasSaved(true)}
            />

            {/* $19.99 upsell — hidden after unlock or save */}
            {showUnlock && !isUnlocked && receiptId && (
              <CopartUnlockCard
                receiptToken={receiptToken}
                receiptId={receiptId}
                onDismiss={() => setShowUnlock(false)}
              />
            )}

            <div className="text-center py-2">
              <a
                href="/receipt"
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Evaluating a retail listing instead?
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
