/**
 * /workspace/auction — Auction Tool (workspace-embedded dark UI)
 *
 * Dark-themed auction analyzer inside the workspace sidebar layout.
 * Wraps the existing /api/auction/analyze endpoint.
 * Shows: URL input hero, recent analyses sidebar, pro tips, how-it-works, stats bar.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search, Loader2, AlertTriangle, Gavel, Shield, Car, Bell,
  CheckCircle, Copy, BookmarkPlus, ChevronDown, ChevronUp,
  TrendingUp, ExternalLink, Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import { useEventTracking } from "@/hooks/useEventTracking";
import SalvageRiskCard from "@/components/copart/SalvageRiskCard";
import OffoScoreCard from "@/components/copart/OffoScoreCard";
import AuctionBidGuidanceCard from "@/components/copart/AuctionBidGuidanceCard";
import ArbitrageCalculatorCard from "@/components/copart/ArbitrageCalculatorCard";
import TitleFlagsCard from "@/components/copart/TitleFlagsCard";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type { AuctionEvalReport, NhtsaRecallSummary } from "@/lib/auction/types";
import type { OffoScore } from "@/types/v2";
import type { ArbitrageResult } from "@/lib/copart-arbitrage-engine";
import { detectVehicleType, isElectric } from "@/lib/auction/vehicle-type";

type PageState = "idle" | "fetching" | "done" | "error";

const SESSION_KEY = "offo_copart_session";

interface StoredSession { input: string; resultId: string; }

interface RecentAnalysis {
  id: string;
  vehicle: string;
  damage: string;
  score: number;
  grade: "green" | "yellow" | "red";
  bid: number | null;
  margin: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gradeCls(grade: "green" | "yellow" | "red") {
  if (grade === "green")  return "text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/20";
  if (grade === "yellow") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  return "text-red-400 bg-red-500/10 border-red-500/20";
}

function gradeLabel(grade: "green" | "yellow" | "red") {
  if (grade === "green")  return "Low Risk";
  if (grade === "yellow") return "Med Risk";
  return "High Risk";
}

function AuctionShareButton({ resultId }: { resultId: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const url = `${window.location.origin}/auction/${resultId}`;
    try { await navigator.clipboard.writeText(url); } catch {
      const ta = document.createElement("textarea");
      ta.value = url; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap ${
        copied
          ? "bg-[#00d97e]/10 border-[#00d97e]/30 text-[#00d97e]"
          : "bg-white/[0.06] border-white/[0.10] text-white/60 hover:text-white/80 hover:border-white/20"
      }`}
    >
      {copied ? <><CheckCircle className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
    </button>
  );
}

function SaveToGarageButton({ resultId, accessToken }: { resultId: string; accessToken: string | null }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (!accessToken) {
    return (
      <Link
        href={`/auth/login?redirect=/workspace/auction`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white/[0.06] border-white/[0.10] text-white/50 hover:text-white/70 transition-all whitespace-nowrap"
      >
        <BookmarkPlus className="w-3.5 h-3.5" /> Sign in to save
      </Link>
    );
  }

  const handleSave = async () => {
    if (status !== "idle") return;
    setStatus("saving");
    try {
      const res = await fetch(`/api/auction/save/${resultId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      setStatus(data.success ? "saved" : "error");
    } catch { setStatus("error"); }
  };

  return (
    <button
      onClick={handleSave}
      disabled={status !== "idle"}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap ${
        status === "saved"  ? "bg-[#00d97e]/10 border-[#00d97e]/30 text-[#00d97e]"
        : status === "error" ? "bg-red-500/10 border-red-500/20 text-red-400"
        : "bg-white/[0.06] border-white/[0.10] text-white/60 hover:text-white/80"
      }`}
    >
      {status === "saving" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
       : status === "saved"  ? <><CheckCircle className="w-3.5 h-3.5" /> Saved</>
       : status === "error"  ? <>Failed — retry</>
       : <><BookmarkPlus className="w-3.5 h-3.5" /> Save to Garage</>}
    </button>
  );
}

function RecallsCard({ recalls }: { recalls: NhtsaRecallSummary[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#161b22] p-5 space-y-3">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between group">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">Open Recalls</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
            {recalls.length}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/30 group-hover:text-white/60 transition-colors">
          <span>{open ? "Hide" : "Show all"}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>
      {!open && (
        <div className="flex flex-wrap gap-1.5">
          {recalls.map((r) => (
            <span key={r.NHTSACampaignNumber} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {r.Component.split(":")[0].trim()}
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="space-y-2 pt-1">
          {recalls.map((r) => (
            <div key={r.NHTSACampaignNumber} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-white/80 leading-snug">{r.Component}</p>
                <span className="text-xs text-white/30 font-mono flex-shrink-0 mt-0.5">#{r.NHTSACampaignNumber}</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">{r.Summary}</p>
              {r.Remedy && (
                <div className="flex items-start gap-1.5 pt-0.5">
                  <span className="text-xs font-semibold text-[#00d97e]/80 uppercase tracking-wide flex-shrink-0 mt-0.5">Remedy</span>
                  <p className="text-xs text-white/50 leading-relaxed">{r.Remedy}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pro Tips
// ---------------------------------------------------------------------------

const PRO_TIPS = [
  "Always request a pre-bid inspection for lots with airbag deployment.",
  "For EVs, BMS scan is critical — battery damage can exceed the car's value.",
  "Salvage titles reduce resale by 20–40%. Factor this into your flip price.",
  "Transport costs vary widely. Get a quote before bidding on out-of-state lots.",
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WorkspaceAuctionPage() {
  const { session } = useAuth();
  const { trackEvent } = useEventTracking();

  const [input, setInput] = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [report, setReport]           = useState<AuctionEvalReport | null>(null);
  const [resultId, setResultId]       = useState<string | null>(null);
  const [salvageRisk, setSalvageRisk] = useState<SalvageRiskResult | null>(null);
  const [offoScore, setOffoScore]     = useState<OffoScore | null>(null);
  const [arbitrageResult, setArbitrageResult] = useState<ArbitrageResult | null>(null);
  const [isEv, setIsEv]               = useState<boolean | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);

  const receiptToken   = typeof window !== "undefined" ? getOrCreateReceiptToken() : "";
  const [listingText, setListingText] = useState("");
  const resultsRef     = useRef<HTMLDivElement>(null);
  const urlParamHandled = useRef(false);

  // Load recent analyses from garage
  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/workspace/garage?type=auction&limit=3", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.vehicles) {
          setRecentAnalyses(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.vehicles.slice(0, 3).map((v: any) => ({
              id: v.id,
              vehicle: `${v.year || ""} ${v.make} ${v.model}`.trim(),
              damage: v.classification?.primary_damage ?? "Unknown",
              score: v.impact_score ?? 0,
              grade: (v.impact_score ?? 0) >= 70 ? "green" : (v.impact_score ?? 0) >= 40 ? "yellow" : "red",
              bid: v.listed_price,
              margin: v.vs_market,
              created_at: v.created_at,
            }))
          );
        }
      })
      .catch(() => {});
  }, [session?.access_token]);

  const handleAnalyze = useCallback(async (inputOverride?: string) => {
    const trimmed = (inputOverride ?? input).trim();
    if (!trimmed) return;

    setPageState("idle");
    setErrorMsg(null);
    setReport(null); setSalvageRisk(null); setOffoScore(null);
    setArbitrageResult(null); setResultId(null); setIsEv(null);
    setListingText("");

    trackEvent("copart_analyze_started", { input_type: "workspace", source: "workspace_auction" });
    setPageState("fetching");
    setStatusMsg("Analyzing auction lot...");

    let isUrl = false;
    try { const u = new URL(trimmed); isUrl = u.hostname.endsWith("copart.com") || u.hostname.endsWith("iaai.com") || u.hostname.endsWith("bid.cars") || u.hostname.endsWith("autobidmaster.com"); }
    catch { isUrl = false; }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 65_000);

    try {
      let res: Response;
      try {
        res = await fetch("/api/auction/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: isUrl ? trimmed : undefined,
            lot_number: !isUrl ? trimmed : undefined,
            auction_source: "copart",
            receipt_token: receiptToken,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        const isTimeout = fetchErr instanceof DOMException && fetchErr.name === "AbortError";
        setPageState("error");
        setErrorMsg(isTimeout ? "Analysis timed out — please try again." : "Could not reach the server.");
        return;
      }
      clearTimeout(timeoutId);

      let data: { success: boolean; report?: AuctionEvalReport; error?: string; message?: string };
      try { data = await res.json(); }
      catch {
        setPageState("error");
        setErrorMsg(`Server error (HTTP ${res.status}) — please try again.`);
        return;
      }

      if (!res.ok || !data.success || !data.report) {
        setPageState("error");
        setErrorMsg(data.message ?? data.error ?? "Analysis failed. Please try again.");
        return;
      }

      const r = data.report;
      setReport(r);
      setResultId(r.report_id);
      setSalvageRisk(r.salvage_risk as SalvageRiskResult);
      setOffoScore((r.offo_score as OffoScore | undefined) ?? null);
      if (r.arbitrage) setArbitrageResult(r.arbitrage as ArbitrageResult);

      const vType = detectVehicleType({ make: r.lot.make, model: r.lot.model, year: r.lot.year, primaryDamage: r.lot.primary_damage, conditionNotes: r.lot.condition_notes });
      setIsEv(isElectric(vType));

      const lot = r.lot;
      setListingText([lot.year, lot.make, lot.model, lot.trim,
        lot.primary_damage ? `Primary damage: ${lot.primary_damage}` : null,
        lot.title_status ? `Title: ${lot.title_status}` : null,
        lot.odometer ? `Odometer: ${lot.odometer}` : null,
      ].filter(Boolean).join(" "));

      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ input: trimmed, resultId: r.report_id } as StoredSession)); } catch { /* ignore */ }

      setPageState("done");
      trackEvent("copart_analyze_completed", { result_id: r.report_id, salvage_grade: r.salvage_risk.grade, salvage_score: r.salvage_risk.score });

      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (err) {
      clearTimeout(timeoutId);
      setPageState("error");
      setErrorMsg(`${err instanceof Error ? err.message : "Unexpected error"}. Please try again.`);
    }
  }, [input, receiptToken, trackEvent]);

  // Pre-fill from ?url= or ?lot= param — must be after handleAnalyze declaration
  useEffect(() => {
    if (urlParamHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url") ?? params.get("lot");
    if (urlParam) {
      urlParamHandled.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInput(urlParam);
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => handleAnalyze(urlParam), 400);
    }
  }, [handleAnalyze]);

  const isLoading = pageState === "fetching";
  const lot = report?.lot ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Gavel className="w-5 h-5 text-orange-400" />
          <h1 className="text-2xl font-bold text-white">Auction Analyzer</h1>
        </div>
        <p className="text-sm text-white/40">AI-powered risk scoring for Copart &amp; IAAI salvage auctions</p>
      </div>

      {/* ── Main layout: left column + right sidebar ────────────── */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Left: input + results ──────────────────────────────── */}
        <div className="space-y-5">

          {/* Input hero card */}
          <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden">
            {/* Dark header strip */}
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/15 border border-orange-500/25 rounded-full mb-4">
                <Gavel className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Copart &amp; IAAI Analyzer</span>
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Paste an Auction Lot URL</h2>
              <p className="text-sm text-white/40 max-w-md mx-auto">
                Get an instant AI risk score, repair cost estimate, and arbitrage breakdown before you bid.
              </p>
            </div>

            {/* Input row */}
            <div className="px-6 pb-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isLoading && input.trim() && handleAnalyze()}
                    placeholder="https://www.copart.com/lot/38291047"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0d1117] border border-white/[0.10] rounded-xl text-sm text-white placeholder:text-white/25 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 outline-none transition-colors"
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isLoading || !input.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-[#0d1117] bg-orange-500 hover:bg-orange-400 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                  {isLoading ? "Analyzing…" : "Analyze Lot"}
                </button>
              </div>

              {/* Supports row */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-xs text-white/30">Supports:</span>
                {["Copart", "IAAI", "Bid.Cars", "AutoBidMaster"].map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-xs font-medium text-[#00d97e] bg-[#00d97e]/10 border border-[#00d97e]/20 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" /> {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Divider + examples */}
            <div className="border-t border-white/[0.06] px-6 py-3">
              <p className="text-xs text-white/25 mb-1.5">Try an example:</p>
              <div className="flex flex-wrap gap-3">
                {[
                  "www.copart.com/lot/38291047",
                  "www.iaai.com/vehicle/23847291",
                  "bid.cars/en/lot",
                ].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => { setInput(`https://${ex}`); }}
                    className="text-xs text-orange-400/70 hover:text-orange-400 transition-colors font-mono"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* How it works */}
          {pageState === "idle" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  num: "01", icon: "🔗", accent: "text-orange-400",
                  title: "Paste Lot URL",
                  desc: "Copy any Copart or IAAI auction lot URL and paste it above.",
                },
                {
                  num: "02", icon: "🤖", accent: "text-blue-400",
                  title: "AI Risk Analysis",
                  desc: "Our AI scores 6 risk dimensions: structural, battery, title, market, and more.",
                },
                {
                  num: "03", icon: "📊", accent: "text-[#00d97e]",
                  title: "Arbitrage Model",
                  desc: "Adjust costs and flip price to see your real profit margin before bidding.",
                },
              ].map((step) => (
                <div key={step.num} className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-white/25">{step.num}</span>
                    <span className="text-base">{step.icon}</span>
                  </div>
                  <p className={`text-sm font-bold ${step.accent} mb-1`}>{step.title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Stats bar */}
          {pageState === "idle" && (
            <div className="bg-gradient-to-r from-orange-500/10 via-[#161b22] to-[#00d97e]/10 border border-white/[0.08] rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { value: "2,847", label: "Lots Analyzed",    color: "text-orange-400" },
                { value: "$4.2M", label: "Savings Found",    color: "text-[#00d97e]" },
                { value: "94%",   label: "Repair Accuracy",  color: "text-orange-400" },
                { value: "6 sec", label: "Avg. Analysis Time", color: "text-[#00d97e]" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {pageState === "error" && errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-400">{errorMsg}</p>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-10 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-orange-400 animate-spin" />
              </div>
              <p className="text-sm font-medium text-white/70">{statusMsg}</p>
              <p className="text-xs text-white/30">Fetching lot data, market comps, recalls…</p>
            </div>
          )}

          {/* Results */}
          {pageState === "done" && report && salvageRisk && lot && (
            <div ref={resultsRef} className="space-y-4">

              {/* Lot strip */}
              {(lot.year || lot.make || lot.model) && (
                <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl px-5 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-xs font-semibold text-white/30 uppercase tracking-wide mb-0.5">Lot {lot.lot_number}</p>
                      <h2 className="text-lg font-bold text-white">
                        {[lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ")}
                      </h2>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-white/40">
                        {lot.primary_damage && <span className="text-amber-400">{lot.primary_damage}</span>}
                        {lot.title_status && <span>{lot.title_status} title</span>}
                        {lot.odometer && <span>{lot.odometer.toLocaleString()} mi</span>}
                        {lot.location && <span>{lot.location}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {lot.current_bid && (
                        <div className="text-right">
                          <p className="text-xs text-white/30">Current bid</p>
                          <p className="text-xl font-bold text-white">${lot.current_bid.toLocaleString()}</p>
                        </div>
                      )}
                      {resultId && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${gradeCls(salvageRisk.grade)}`}>
                          {gradeLabel(salvageRisk.grade)} · {salvageRisk.score}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {offoScore && <OffoScoreCard offoScore={offoScore} />}
              <AuctionBidGuidanceCard result={salvageRisk} vin={lot.vin} askingPrice={lot.current_bid} />
              <SalvageRiskCard result={salvageRisk} dataSource="api" isEv={isEv} />

              {resultId && (
                <ArbitrageCalculatorCard
                  receiptId={resultId}
                  vin={lot.vin}
                  listingText={listingText}
                  askingPrice={lot.current_bid}
                  make={lot.make} model={lot.model} year={lot.year} trim={lot.trim}
                  primaryDamage={lot.primary_damage ?? lot.loss_type}
                  receiptToken={receiptToken}
                  onResult={setArbitrageResult}
                />
              )}

              <TitleFlagsCard zip={lot.location ?? null} />

              {report.recalls.length > 0 && <RecallsCard recalls={report.recalls} />}

              {/* Share / Save */}
              {resultId && (
                <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-white/80">Share or save this report</p>
                    <p className="text-xs text-white/40 mt-0.5">Send to your mechanic, partner, or bidding group.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <SaveToGarageButton resultId={resultId} accessToken={session?.access_token ?? null} />
                    <AuctionShareButton resultId={resultId} />
                    <Link
                      href={`/auction/${resultId}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.10] text-white/60 hover:text-white/80 transition-all whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Full report
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right sidebar ─────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Recent Analyses */}
          <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white/80">Recent Analyses</h3>
              <Link href="/workspace/garage" className="text-xs text-orange-400/70 hover:text-orange-400 transition-colors">
                View All
              </Link>
            </div>

            {recentAnalyses.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Gavel className="w-7 h-7 mx-auto mb-2 text-white/10" />
                <p className="text-xs text-white/30">No analyses yet</p>
                <p className="text-[10px] text-white/20 mt-1">Your recent results will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {recentAnalyses.map((a) => (
                  <Link key={a.id} href={`/auction/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                    {/* Thumbnail placeholder */}
                    <div className="w-10 h-9 rounded-lg bg-white/[0.05] border border-white/[0.06] flex-shrink-0 overflow-hidden flex items-center justify-center">
                      <Car className="w-4 h-4 text-white/20" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/80 truncate">{a.vehicle}</p>
                      <p className="text-[10px] text-white/35 truncate">{a.damage}{a.bid ? ` · $${a.bid.toLocaleString()}` : ""}</p>
                      <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${gradeCls(a.grade)}`}>
                        {gradeLabel(a.grade)}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white/70">{a.score}</p>
                      <p className="text-[10px] text-white/30">risk</p>
                      {a.margin != null && (
                        <p className={`text-[10px] font-semibold ${a.margin > 0 ? "text-[#00d97e]" : "text-red-400"}`}>
                          +${Math.abs(a.margin).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Pro Tips */}
          <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <Zap className="w-3.5 h-3.5 text-orange-400" />
              <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">Pro Tips</h3>
            </div>
            <ul className="divide-y divide-white/[0.04]">
              {PRO_TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5 px-4 py-3">
                  <span className="w-4 h-4 rounded-full bg-orange-500/15 border border-orange-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingUp className="w-2.5 h-2.5 text-orange-400" />
                  </span>
                  <p className="text-xs text-white/50 leading-relaxed">{tip}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Batch link */}
          <Link
            href="/copart/batch"
            className="flex items-center justify-between p-4 bg-[#161b22] border border-white/[0.08] rounded-2xl hover:border-white/[0.18] transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-white/80">Batch Analysis</p>
              <p className="text-xs text-white/40 mt-0.5">Analyze multiple lots at once</p>
            </div>
            <Shield className="w-5 h-5 text-white/20" />
          </Link>

          {/* Full copart tool link */}
          <Link
            href="/copart"
            className="flex items-center justify-between p-4 bg-[#161b22] border border-white/[0.08] rounded-2xl hover:border-white/[0.18] transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-white/80">Full Copart Tool</p>
              <p className="text-xs text-white/40 mt-0.5">Advanced view with all EV data</p>
            </div>
            <Bell className="w-5 h-5 text-white/20" />
          </Link>
        </div>
      </div>
    </div>
  );
}
