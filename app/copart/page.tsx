/**
 * /copart — Copart Auction Fit & Risk Advisor
 *
 * Unified free-tier page. All features visible — no paywall.
 * Uses site-standard Header + Footer components.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Search,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Bell,
  ChevronDown,
  ChevronUp,
  Shield,
  Gavel,
  Car,
  Info,
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import { useEventTracking } from "@/hooks/useEventTracking";
import SalvageRiskCard from "@/components/copart/SalvageRiskCard";
import AuctionBidGuidanceCard from "@/components/copart/AuctionBidGuidanceCard";
import ArbitrageCalculatorCard from "@/components/copart/ArbitrageCalculatorCard";
import TitleFlagsCard from "@/components/copart/TitleFlagsCard";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type { AuctionEvalReport, NhtsaRecallSummary } from "@/lib/auction/types";

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

function RecallsCard({ recalls }: { recalls: NhtsaRecallSummary[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold text-gray-900">Open Recalls</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            {recalls.length}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
          <span>{open ? "Hide" : "Show all"}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {!open && (
        <div className="flex flex-wrap gap-1.5">
          {recalls.map((r) => (
            <span
              key={r.NHTSACampaignNumber}
              className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100"
            >
              {r.Component.split(":")[0].trim()}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-2 pt-1">
          {recalls.map((r) => (
            <div key={r.NHTSACampaignNumber} className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-gray-800 leading-snug">{r.Component}</p>
                <span className="text-[10px] text-gray-400 font-mono flex-shrink-0 mt-0.5">
                  #{r.NHTSACampaignNumber}
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{r.Summary}</p>
              {r.Remedy && (
                <div className="flex items-start gap-1.5 pt-0.5">
                  <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide flex-shrink-0 mt-0.5">Remedy</span>
                  <p className="text-xs text-green-800 leading-relaxed">{r.Remedy}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  const receiptToken = typeof window !== "undefined" ? getOrCreateReceiptToken() : "";
  const listingTextRef = useRef("");

  // Restore session after Stripe redirect (kept for backward compat, no longer used for paywall)
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
      }
    } catch { /* ignore */ }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const handleAnalyze = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setPageState("idle");
    setErrorMsg(null);
    setReport(null);
    setSalvageRisk(null);
    setResultId(null);
    listingTextRef.current = "";

    trackEvent("copart_analyze_started", {
      input_type: isCopartUrl(trimmed) ? "url" : "lot_or_text",
    });

    setPageState("fetching");
    setStatusMsg("Analyzing auction lot...");

    const isUrl = isCopartUrl(trimmed);

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
      setSalvageRisk(r.salvage_risk as SalvageRiskResult);

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header variant="receipt" />

      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-100 px-3 py-1 rounded-full mb-4">
            <Gavel className="w-3.5 h-3.5" />
            Salvage &amp; Auction Intelligence
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Evaluate any Copart auction before you bid
          </h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Paste a Copart lot URL or lot number. Get a salvage risk score, ARV estimate, repair cost breakdown, and max safe bid — free.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {[
              { icon: Shield, label: "Salvage risk score" },
              { icon: Car, label: "Battery health projection" },
              { icon: Gavel, label: "Max safe bid calc" },
              { icon: Bell, label: "Open recalls" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                <Icon className="w-3 h-3 text-blue-500" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-5">

        {/* Input card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Copart lot URL or lot number
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && input.trim() && handleAnalyze()}
              placeholder="https://www.copart.com/lot/12345678  or  12345678"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !input.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {isLoading ? statusMsg : "Analyze"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Works with Copart and IAAI lot URLs or bare lot numbers.
          </p>
        </div>

        {/* Error */}
        {pageState === "error" && errorMsg && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm font-medium text-amber-800">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
            </div>
            <p className="text-sm font-medium text-gray-700">{statusMsg}</p>
            <p className="text-xs text-gray-400">Fetching lot data, market comps, recalls…</p>
          </div>
        )}

        {/* Results */}
        {pageState === "done" && report && salvageRisk && lot && (
          <div className="space-y-4">

            {/* Lot summary strip */}
            {(lot.year || lot.make || lot.model) && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Lot {lot.lot_number}</p>
                    <h2 className="text-lg font-bold text-gray-900">
                      {[lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ")}
                    </h2>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                      {lot.primary_damage && (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          {lot.primary_damage}
                        </span>
                      )}
                      {lot.title_status && (
                        <span className="flex items-center gap-1">
                          <Info className="w-3 h-3 text-blue-400" />
                          {lot.title_status} title
                        </span>
                      )}
                      {lot.odometer && (
                        <span>{lot.odometer.toLocaleString()} mi</span>
                      )}
                      {lot.location && (
                        <span>{lot.location}</span>
                      )}
                    </div>
                  </div>
                  {lot.current_bid && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Current bid</p>
                      <p className="text-xl font-bold text-gray-900">${lot.current_bid.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risk + guidance */}
            <SalvageRiskCard result={salvageRisk} dataSource="api" />

            <AuctionBidGuidanceCard
              result={salvageRisk}
              vin={lot.vin}
              askingPrice={lot.current_bid}
            />

            {/* Arbitrage calculator — always shown */}
            {resultId && (
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
            )}

            {/* Title flags — always shown */}
            <TitleFlagsCard zip={lot.location ?? null} />

            {/* Recalls — always shown */}
            {report.recalls.length > 0 && (
              <RecallsCard recalls={report.recalls} />
            )}

            {/* Cross-link to retail receipt tool */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-900">Evaluating a retail listing instead?</p>
                <p className="text-xs text-blue-600 mt-0.5">Use the Listing Receipt for private-sale and dealer listings.</p>
              </div>
              <Link
                href="/receipt"
                className="flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900 transition-colors whitespace-nowrap"
              >
                Try it <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        )}

        {/* Idle state — how it works */}
        {pageState === "idle" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">How it works</h3>
            <div className="space-y-3">
              {[
                {
                  step: "1",
                  title: "Paste a Copart URL or lot number",
                  desc: "We fetch live lot data including damage, title, mileage, and bid price.",
                },
                {
                  step: "2",
                  title: "Get a 6-factor salvage risk score",
                  desc: "Battery risk, structural damage, title impact, recalls, repair cost, and mileage — all scored.",
                },
                {
                  step: "3",
                  title: "See your max safe bid",
                  desc: "We pull market comps (ARV), estimate repair cost via AI, and compute a break-even bid with margin.",
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <Footer />
    </div>
  );
}
