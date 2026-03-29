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
  Copy,
  CheckCircle,
  Mail,
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { getOrCreateReceiptToken, getOrCreatePersistentSessionId } from "@/lib/session-utils";
import { useEventTracking } from "@/hooks/useEventTracking";
import SalvageRiskCard from "@/components/copart/SalvageRiskCard";
import OffoScoreCard from "@/components/copart/OffoScoreCard";
import AuctionBidGuidanceCard from "@/components/copart/AuctionBidGuidanceCard";
import ArbitrageCalculatorCard from "@/components/copart/ArbitrageCalculatorCard";
import TitleFlagsCard from "@/components/copart/TitleFlagsCard";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type {
  AuctionEvalReport,
  NhtsaRecallSummary,
  ChargingProfileSummary,
  RangeProjection,
  IncentiveStatus,
  ElectricityContext,
} from "@/lib/auction/types";
import type { OffoScore } from "@/types/v2";

type PageState = "idle" | "fetching" | "done" | "error";

const SESSION_KEY = "offo_copart_session";

interface StoredSession {
  input: string;
  resultId: string;
}

function AuctionShareButton({ resultId }: { resultId: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const url = `${window.location.origin}/auction/${resultId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap ${
        copied ? "bg-green-50 border-green-200 text-green-700" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900"
      }`}
    >
      {copied ? <><CheckCircle className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
    </button>
  );
}

function AuctionEmailCapture({ resultId }: { resultId: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auction/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), result_id: resultId, anon_id: getOrCreatePersistentSessionId() }),
      });
      const data = await res.json();
      if (data.success) { setStatus("success"); } else { setErrorMsg(data.error ?? "Failed. Try again."); setStatus("error"); }
    } catch { setErrorMsg("Connection error."); setStatus("error"); }
  };

  if (status === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-green-800">Report sent — check your inbox!</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Mail className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Save this report to your inbox</p>
          <p className="text-xs text-gray-500">Get the full analysis + shareable link sent to you.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          required
        />
        <button
          type="submit"
          disabled={status === "submitting" || !email.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {status === "submitting" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Send report"}
        </button>
      </form>
      {errorMsg && <p className="text-xs text-red-500 mt-2">{errorMsg}</p>}
      <p className="text-xs text-gray-400 mt-2">No spam. One email. Unsubscribe any time.</p>
    </div>
  );
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

function ChargingProfileCard({ profile }: { profile: ChargingProfileSummary }) {
  const curveLabel: Record<ChargingProfileSummary["curve_shape"], string> = {
    flat: "Flat — holds full speed longer (better for road trips)",
    tapered: "Tapered — speed drops gradually above 50%",
    steep_taper: "Steep taper — speed drops sharply above 50%",
  };
  const coldKw = profile.peak_dc_kw
    ? Math.round(profile.peak_dc_kw * (1 - profile.cold_derate_percent / 100))
    : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">DC Charging Profile</h3>
          <p className="text-xs text-gray-400">{profile.source_model}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-xs text-gray-500 mb-0.5">Peak charge rate</p>
          <p className="text-lg font-bold text-gray-900">{profile.peak_dc_kw ?? "—"} <span className="text-sm font-normal text-gray-500">kW</span></p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-xs text-gray-500 mb-0.5">10–80% charge time</p>
          <p className="text-lg font-bold text-gray-900">{profile.time_10_to_80_min ?? "—"} <span className="text-sm font-normal text-gray-500">min</span></p>
        </div>
      </div>
      <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 space-y-1">
        <p className="text-xs font-semibold text-amber-800">Cold weather impact (32°F)</p>
        <p className="text-xs text-amber-700">
          Peak drops ~{profile.cold_derate_percent}% — from {profile.peak_dc_kw ?? "?"} kW to ~{coldKw ?? "?"} kW
        </p>
      </div>
      <p className="text-xs text-gray-500">{curveLabel[profile.curve_shape]}</p>
    </div>
  );
}

function RangeProjectionCard({ range }: { range: RangeProjection }) {
  const bars: Array<{ label: string; mi: number | null; color: string }> = [
    { label: "EPA rated", mi: range.epa_range_mi, color: "bg-blue-500" },
    { label: "Real-world", mi: range.real_world_range_mi, color: "bg-green-500" },
    { label: "At 32°F", mi: range.cold_range_mi, color: "bg-amber-400" },
    { label: "At 0°F", mi: range.extreme_cold_range_mi, color: "bg-red-400" },
  ];
  const maxMi = Math.max(...bars.map((b) => b.mi ?? 0), 1);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
          <Car className="w-4 h-4 text-green-600" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Range Projection</h3>
      </div>
      <div className="space-y-2">
        {bars.filter((b) => b.mi !== null).map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <p className="text-xs text-gray-500 w-20 flex-shrink-0">{b.label}</p>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div
                className={`${b.color} h-2 rounded-full transition-all`}
                style={{ width: `${Math.round(((b.mi ?? 0) / maxMi) * 100)}%` }}
              />
            </div>
            <p className="text-xs font-semibold text-gray-800 w-14 text-right flex-shrink-0">{b.mi} mi</p>
          </div>
        ))}
      </div>
      {range.climate_note && (
        <p className="text-xs text-gray-400 pt-1">{range.climate_note}</p>
      )}
      <p className="text-[10px] text-gray-300">Source: AAA + Recurrent fleet data</p>
    </div>
  );
}

function IncentiveStatusCard({ incentive }: { incentive: IncentiveStatus }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-red-500" />
        </div>
        <h3 className="text-base font-bold text-gray-900">EV Tax Credit Eligibility</h3>
      </div>
      <div className="space-y-2">
        <div className="rounded-xl border border-red-100 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-800">Federal new vehicle credit (§30D)</p>
          <p className="text-xs text-red-700 mt-0.5">
            Salvage title — NOT eligible.
            {incentive.federal_new_amount > 0
              ? ` Original buyer may have claimed $${incentive.federal_new_amount.toLocaleString()} — factor this into your negotiation.`
              : ""}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-700">Federal used vehicle credit (§25E)</p>
          <p className="text-xs text-gray-600 mt-0.5">
            {incentive.federal_used_amount > 0
              ? `Up to $${incentive.federal_used_amount.toLocaleString()} if purchased from a licensed dealer.`
              : "Not eligible for this vehicle."}
          </p>
        </div>
        {incentive.state_amount > 0 && incentive.state && (
          <div className="rounded-xl border border-green-100 bg-green-50 p-3">
            <p className="text-xs font-semibold text-green-800">{incentive.state} state incentive</p>
            <p className="text-xs text-green-700 mt-0.5">Up to ${incentive.state_amount.toLocaleString()}</p>
          </div>
        )}
        {incentive.notes && (
          <p className="text-xs text-gray-400">{incentive.notes}</p>
        )}
      </div>
    </div>
  );
}

function ElectricityContextCard({ electricity }: { electricity: ElectricityContext }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900">Charging Cost Estimate</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-xs text-gray-500 mb-0.5">{electricity.state} residential rate</p>
          <p className="text-lg font-bold text-gray-900">{electricity.residential_kwh_cents}<span className="text-sm font-normal text-gray-500">¢/kWh</span></p>
        </div>
        {electricity.monthly_cost_estimate_usd !== null && (
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
            <p className="text-xs text-gray-500 mb-0.5">Est. monthly cost</p>
            <p className="text-lg font-bold text-gray-900">${electricity.monthly_cost_estimate_usd}<span className="text-sm font-normal text-gray-500">/mo</span></p>
          </div>
        )}
      </div>
      {electricity.ev_tou_kwh_cents !== null && (
        <div className="rounded-xl bg-green-50 border border-green-100 p-3">
          <p className="text-xs font-semibold text-green-800">Off-peak EV rate available</p>
          <p className="text-xs text-green-700 mt-0.5">TOU rate ~{electricity.ev_tou_kwh_cents}¢/kWh may reduce monthly cost significantly.</p>
        </div>
      )}
      <p className="text-[10px] text-gray-300">At 12,000 mi/yr · {electricity.state} state average rate · EIA data</p>
    </div>
  );
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
  const [offoScore, setOffoScore] = useState<OffoScore | null>(null);

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
    setOffoScore(null);
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
      setOffoScore((r.offo_score as OffoScore | undefined) ?? null);

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

            {/* OFFO Score — unified verdict shown first */}
            {offoScore && <OffoScoreCard offoScore={offoScore} />}

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

            {/* data_v2 cards — shown when enrichment data is available */}
            {report.charging_profile && (
              <ChargingProfileCard profile={report.charging_profile} />
            )}
            {report.range_projection && (
              <RangeProjectionCard range={report.range_projection} />
            )}
            {report.incentive_status && (
              <IncentiveStatusCard incentive={report.incentive_status} />
            )}
            {report.electricity_context && (
              <ElectricityContextCard electricity={report.electricity_context} />
            )}

            {/* Email capture */}
            {resultId && <AuctionEmailCapture resultId={resultId} />}

            {/* Share nudge */}
            {resultId && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-blue-900">Share this report</p>
                  <p className="text-xs text-blue-600 mt-0.5">Send the link to your mechanic, partner, or bidding group.</p>
                </div>
                <AuctionShareButton resultId={resultId} />
              </div>
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
