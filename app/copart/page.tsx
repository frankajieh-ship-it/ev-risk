/**
 * /copart — Copart Auction Fit & Risk Advisor
 *
 * Calls POST /api/auction/analyze (unified service) and renders the full report.
 * Backward-compat components (SalvageRiskCard, ArbitrageCalculatorCard, etc.)
 * are kept unchanged — we map AuctionEvalReport fields to their existing props.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, AlertTriangle, Loader2, ChevronRight } from "lucide-react";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import { useEventTracking } from "@/hooks/useEventTracking";
import SalvageRiskCard from "@/components/copart/SalvageRiskCard";
import AuctionBidGuidanceCard from "@/components/copart/AuctionBidGuidanceCard";
import CopartUnlockCard from "@/components/copart/CopartUnlockCard";
import ArbitrageCalculatorCard from "@/components/copart/ArbitrageCalculatorCard";
import TitleFlagsCard from "@/components/copart/TitleFlagsCard";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type { AuctionEvalReport } from "@/lib/auction/types";

type PageState = "idle" | "fetching" | "done" | "error";

const SESSION_KEY = "offo_copart_session";

interface StoredSession {
  input: string;
  resultId: string;
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

export default function CopartPage() {
  const { trackEvent } = useEventTracking();
  const [input, setInput] = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [report, setReport] = useState<AuctionEvalReport | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [salvageRisk, setSalvageRisk] = useState<SalvageRiskResult | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlock, setShowUnlock] = useState(true);

  const receiptToken = typeof window !== "undefined" ? getOrCreateReceiptToken() : "";

  // Used to pass lot metadata to ArbitrageCalculatorCard (backward compat)
  const listingTextRef = useRef("");

  // ── Handle Stripe redirect return (?checkout=success) ───────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const session: StoredSession = JSON.parse(stored);
        sessionStorage.removeItem(SESSION_KEY);
        setInput(session.input);
        setResultId(session.resultId);
        setIsUnlocked(true);
        setShowUnlock(false);
      }
    } catch { /* ignore */ }

    const clean = window.location.pathname;
    window.history.replaceState({}, "", clean);
  }, []);

  // ── Check payment status when we have a resultId ─────────────────────────
  useEffect(() => {
    if (!resultId || !receiptToken) return;
    fetch(`/api/payments/status?scenario_type=copart&scenario_id=${resultId}&anon_id=${receiptToken}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.unlocked_base) {
          setIsUnlocked(true);
          setShowUnlock(false);
        }
      })
      .catch(() => {});
  }, [resultId, receiptToken]);

  const handleAnalyze = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setPageState("idle");
    setErrorMsg(null);
    setReport(null);
    setSalvageRisk(null);
    setResultId(null);
    setShowUnlock(true);
    setIsUnlocked(false);
    listingTextRef.current = "";

    trackEvent("copart_analyze_started", {
      input_type: isCopartUrl(trimmed) ? "url" : "lot_or_text",
    });

    setPageState("fetching");
    setStatusMsg("Analyzing auction lot...");

    // Build request — detect URL vs bare lot number
    const isUrl = isCopartUrl(trimmed);
    const lotNumber = !isUrl ? extractLotNumber(trimmed) ?? trimmed : null;

    try {
      const res = await fetch("/api/auction/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: isUrl ? trimmed : undefined,
          lot_number: !isUrl ? trimmed : undefined,
          auction_source: "copart",
          receipt_token: receiptToken,
        }),
      });

      const data = await res.json() as { success: boolean; report?: AuctionEvalReport; error?: string; message?: string };

      if (!data.success || !data.report) {
        setPageState("error");
        setErrorMsg(data.message ?? data.error ?? "Analysis failed. Please try again.");
        return;
      }

      const r = data.report;
      setReport(r);
      setResultId(r.report_id);

      // Map salvage_risk to SalvageRiskResult shape for existing components
      setSalvageRisk(r.salvage_risk as SalvageRiskResult);

      // Build synthetic listing text for ArbitrageCalculatorCard backward compat
      const lot = r.lot;
      listingTextRef.current = [
        lot.year, lot.make, lot.model, lot.trim,
        lot.primary_damage ? `Primary damage: ${lot.primary_damage}` : null,
        lot.secondary_damage ? `Secondary damage: ${lot.secondary_damage}` : null,
        lot.loss_type ? `Loss type: ${lot.loss_type}` : null,
        lot.condition_notes,
        lot.title_status ? `Title: ${lot.title_status}` : null,
        lot.odometer ? `Odometer: ${lot.odometer}` : null,
        lot.location,
      ].filter(Boolean).join(" ");

      // Store session for post-Stripe restore
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ input: trimmed, resultId: r.report_id } as StoredSession));
      } catch { /* ignore */ }

      setPageState("done");
      trackEvent("copart_analyze_completed", {
        result_id: r.report_id,
        cached: r.cached,
        salvage_grade: r.salvage_risk.grade,
        salvage_score: r.salvage_risk.score,
        recall_count: r.recalls.length,
      });
    } catch (err) {
      setPageState("error");
      setErrorMsg("Connection error. Please try again.");
      trackEvent("copart_analyze_failed", { error: err instanceof Error ? err.message : "unknown" });
    }
  }, [input, receiptToken, trackEvent]);

  const isLoading = pageState === "fetching";
  const lot = report?.lot ?? null;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-100 px-3 py-1 rounded-full mb-4">
            <AlertTriangle className="w-3.5 h-3.5" />
            Salvage &amp; Auction Intelligence
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Evaluate any Copart auction before you bid
          </h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Paste a Copart lot URL or lot number. Get a salvage risk score, ARV, repair cost estimate, and max safe bid.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Copart lot URL or lot number
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.copart.com/lot/12345678 or 12345678"
            className="w-full h-20 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
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
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm font-semibold text-amber-800">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {pageState === "done" && report && salvageRisk && lot && (
          <div className="space-y-4">
            {/* Phase 1: Salvage risk + bid guidance */}
            <SalvageRiskCard result={salvageRisk} dataSource="api" />

            <AuctionBidGuidanceCard
              result={salvageRisk}
              vin={lot.vin}
              askingPrice={lot.current_bid}
            />

            {/* Phase 2: Arbitrage + title flags (paid unlock) */}
            {isUnlocked && resultId && (
              <>
                <ArbitrageCalculatorCard
                  receiptId={resultId}
                  vin={lot.vin}
                  listingText={listingTextRef.current}
                  askingPrice={lot.current_bid}
                  make={lot.make}
                  model={lot.model}
                  year={lot.year}
                  trim={lot.trim}
                  receiptToken={receiptToken}
                />
                <TitleFlagsCard zip={lot.location ?? null} />
              </>
            )}

            {/* $19.99 upsell — hidden after unlock */}
            {showUnlock && !isUnlocked && resultId && (
              <CopartUnlockCard
                receiptToken={receiptToken}
                receiptId={resultId}
                onDismiss={() => setShowUnlock(false)}
                teaserArvLow={salvageRisk?.arv_hint_low ?? null}
                teaserArvHigh={salvageRisk?.arv_hint_high ?? null}
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
