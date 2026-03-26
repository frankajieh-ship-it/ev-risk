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
import type { LotData } from "@/app/api/copart/lot/route";

type PageState = "idle" | "fetching" | "generating" | "done" | "error";
type DataSource = "api" | "scrape" | "manual";

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

function extractLotNumber(url: string): string | null {
  const match = url.match(/\/lot\/(\d{6,12})/);
  return match ? match[1] : null;
}

function buildSyntheticText(lot: LotData): string {
  return [
    lot.year, lot.make, lot.model, lot.trim,
    lot.primaryDamage ? `Primary damage: ${lot.primaryDamage}` : null,
    lot.secondaryDamage ? `Secondary damage: ${lot.secondaryDamage}` : null,
    lot.lossType ? `Loss type: ${lot.lossType}` : null,
    lot.highlights,
    lot.titleType ? `Title: ${lot.titleType}` : null,
    lot.odometer ? `Odometer: ${lot.odometer}` : null,
    lot.odometerBrand ? `Odometer brand: ${lot.odometerBrand}` : null,
    lot.location,
  ].filter(Boolean).join(" ");
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
  const [showUnlock, setShowUnlock] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [fetchBlocked, setFetchBlocked] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>("manual");

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
    setShowUnlock(true);
    setIsUnlocked(false);
    setFetchBlocked(false);
    setDataSource("manual");

    trackEvent("copart_analyze_started", { input_type: isCopartUrl(trimmed) ? "url" : "vin_or_text" });

    let listingText = trimmed;
    let vin: string | undefined;
    let listingUrl: string | undefined;
    let resolvedSource: DataSource = "manual";

    // Step 1: if URL, try Copart lot API first, then proxy-fetch as fallback
    if (isCopartUrl(trimmed)) {
      setPageState("fetching");
      listingUrl = trimmed;

      const lotNumber = extractLotNumber(trimmed);

      if (lotNumber) {
        // ── Strategy A: Copart public JSON API (no cookie required) ──────────
        setStatusMsg("Fetching lot details...");
        try {
          const res = await fetch(`/api/copart/lot?lotNumber=${lotNumber}`);
          const data = await res.json() as { success: boolean; lot?: LotData };

          if (data.success && data.lot) {
            const lot = data.lot;
            listingText = buildSyntheticText(lot);
            vin = lot.vin ?? undefined;
            if (vin) setDetectedVin(vin);
            resolvedSource = "api";
            trackEvent("copart_lot_api_success", { lotNumber, source: lot.source });
          }
        } catch (e) {
          console.warn("[Copart] Lot API error:", e);
        }
      }

      // ── Strategy B: proxy-fetch HTML (fallback if lot API didn't populate) ─
      if (resolvedSource !== "api" || !listingText.trim()) {
        setStatusMsg("Fetching auction lot...");
        try {
          const res = await fetch("/api/proxy-fetch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: trimmed }),
          });
          const data = await res.json() as { success: boolean; html?: string; cookie_wall?: boolean };

          if (data.success && data.html) {
            const parsed = parseCopartHtml(data.html);
            // Only use proxy text if we don't already have API data
            if (!listingText.trim() || listingText === trimmed) {
              listingText = parsed.listingText;
            }
            if (!vin && parsed.vin) {
              vin = parsed.vin;
              setDetectedVin(vin);
            }
            if (resolvedSource === "manual") resolvedSource = "scrape";
          } else if (data.cookie_wall && resolvedSource === "manual") {
            // Only hard-fail if we have no data at all from the lot API
            setPageState("error");
            setFetchBlocked(true);
            setErrorMsg("cookie_wall");
            return;
          }
          // If proxy fails but lot API already gave us data, continue silently
        } catch (e) {
          console.warn("[Copart] Proxy fetch error:", e);
        }
      }

      setDataSource(resolvedSource);

      // If we still have no usable data, show error
      if (!listingText.trim() || listingText === trimmed) {
        setPageState("error");
        setFetchBlocked(true);
        setErrorMsg("fetch_failed");
        return;
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
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-semibold text-amber-800">
                {errorMsg === "cookie_wall"
                  ? "Copart blocked automatic extraction (cookie consent wall)"
                  : errorMsg === "fetch_failed"
                  ? "Couldn't fetch the auction lot page"
                  : errorMsg}
              </p>
            </div>
            {fetchBlocked && (
              <div className="pl-6 space-y-1.5 text-sm text-amber-700">
                <p>To get an accurate analysis, paste the lot details manually:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5 text-amber-600">
                  <li>Open the Copart lot in your browser and accept cookies</li>
                  <li>Copy the damage description, title type, VIN, year/make/model, and mileage</li>
                  <li>Paste everything into the box above and click Analyse</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {pageState === "done" && receipt && salvageRisk && (
          <div className="space-y-4">
            {/* Phase 1: Salvage risk + bid guidance (always shown) */}
            <SalvageRiskCard result={salvageRisk} dataSource={dataSource} />

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
            <SaveReceiptCTA receipt={receipt} />

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
