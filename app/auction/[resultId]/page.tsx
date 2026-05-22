/**
 * /auction/[resultId] — Shared Auction Result Page
 *
 * Shareable, bookmarkable result page for any auction analysis.
 * Fetches from GET /api/auction/result/[resultId].
 *
 * Features:
 * - Dynamic OG meta (via layout.tsx generateMetadata)
 * - Copy shareable link button
 * - Email capture ("save this report")
 * - Full free-tier display: risk, damage, arbitrage, recalls
 */

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useEventTracking } from "@/hooks/useEventTracking";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  Bell,
  DollarSign,
  Bookmark,
  CheckCircle,
  ChevronLeft,
  Link2,
  Mail,
  Copy,
  Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import AuctionSourceBadge from "@/components/auction/AuctionSourceBadge";
import AuctionVerdictCard from "@/components/auction/AuctionVerdictCard";
import AuctionDamageCard from "@/components/auction/AuctionDamageCard";
import SalvageRiskCard from "@/components/copart/SalvageRiskCard";
import type { AuctionSource, NormalizedAuctionLot, NhtsaRecallSummary } from "@/lib/auction/types";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type { ArbitrageResult } from "@/lib/copart-arbitrage-engine";
import type { ClassificationOutput, RoutineImpactOutput, PolishOutput } from "@/lib/auction/auction-ai-chain";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuctionResultReport {
  report_id: string;
  lot: NormalizedAuctionLot;
  salvage_risk: SalvageRiskResult;
  arbitrage: ArbitrageResult | null;
  recalls: NhtsaRecallSummary[];
  routine_fit: unknown | null;
  verdict: PolishOutput | null;
  classification: ClassificationOutput | null;
  routine_impact: RoutineImpactOutput | null;
  cached: boolean;
  created_at: string;
  expires_at: string;
}

interface AuctionResultApiResponse {
  success: boolean;
  result_id: string;
  auction_source: AuctionSource;
  cache_hit: boolean;
  paid_unlocked: boolean;
  report: AuctionResultReport;
  error?: string;
}

type PageState = "loading" | "done" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

function vehicleTitle(lot: NormalizedAuctionLot): string {
  return [lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ") || "Unknown Vehicle";
}

// ── Auction Unlock button ─────────────────────────────────────────────────────

function AuctionUnlockButton({ resultId }: { resultId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    setLoading(true);
    setError(null);
    try {
      const anonId = getOrCreatePersistentSessionId();
      const res = await fetch(`/api/auction/purchase/${resultId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anon_id: anonId }),
      });
      const json = await res.json();
      if (json.checkout_url) {
        window.location.href = json.checkout_url;
      } else {
        setError(json.error ?? "Checkout failed — try again");
        setLoading(false);
      }
    } catch {
      setError("Network error — try again");
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleUnlock}
        disabled={loading}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to checkout...</>
        ) : (
          <><Lock className="w-4 h-4" /> View Auction Audit</>
        )}
      </button>
      {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
    </div>
  );
}

// ── Share button ──────────────────────────────────────────────────────────────

function ShareButton({ resultId }: { resultId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/auction/${resultId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
        copied
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900"
      }`}
    >
      {copied ? (
        <><CheckCircle className="w-3.5 h-3.5" /> Copied!</>
      ) : (
        <><Copy className="w-3.5 h-3.5" /> Copy link</>
      )}
    </button>
  );
}

// ── Email capture ─────────────────────────────────────────────────────────────

function EmailCaptureCard({ resultId }: { resultId: string }) {
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
        body: JSON.stringify({
          email: email.trim(),
          result_id: resultId,
          anon_id: getOrCreatePersistentSessionId(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
      } else {
        setErrorMsg(data.error ?? "Failed to send. Try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Connection error. Try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">Report sent — check your inbox!</p>
          <p className="text-xs text-green-600 mt-0.5">You can re-open this report any time from the link we sent.</p>
        </div>
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
          {status === "submitting" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            "Send report"
          )}
        </button>
      </form>
      {errorMsg && <p className="text-xs text-red-500 mt-2">{errorMsg}</p>}
      <p className="text-xs text-gray-400 mt-2">No spam. One email. Unsubscribe any time.</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuctionResultPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const { isAuthenticated } = useAuth();
  const { trackEvent } = useEventTracking();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<AuctionResultApiResponse | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => { if (resultId) trackEvent("auction_result_page_viewed", { result_id: resultId }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!resultId) return;
    const anonId = getOrCreatePersistentSessionId() ?? "";
    fetch(`/api/auction/result/${resultId}?anon_id=${encodeURIComponent(anonId)}`)
      .then((r) => r.json())
      .then((json: AuctionResultApiResponse) => {
        if (!json.success) { setPageState("error"); return; }
        setData(json);
        setPageState("done");
      })
      .catch(() => setPageState("error"));
  }, [resultId]);

  const handleSave = async () => {
    if (!resultId || saveState !== "idle") return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/auction/save/${resultId}`, { method: "POST" });
      const json = await res.json();
      setSaveState(json.success ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header variant="homepage" />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
          <div className="animate-pulse space-y-4">
            <div className="h-7 w-48 bg-gray-200 rounded-full" />
            <div className="h-24 bg-gray-200 rounded-2xl" />
            <div className="h-40 bg-gray-200 rounded-2xl" />
            <div className="h-36 bg-gray-200 rounded-2xl" />
            <div className="h-32 bg-gray-200 rounded-2xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (pageState === "error" || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header variant="homepage" />
        <main className="flex-1 flex items-center justify-center">
          <div className="max-w-md mx-auto px-4 text-center space-y-4">
            <p className="text-lg font-semibold text-gray-800">Result not found or expired</p>
            <p className="text-sm text-gray-500">
              Auction analyses are cached for 24 hours. Paste the lot URL again to re-run.
            </p>
            <Link
              href="/copart"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Analyze a new lot
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { report, auction_source } = data;
  const { lot } = report;
  const photo = lot.photos?.[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header variant="homepage" />
      <main className="flex-1">

        {/* Back + share strip */}
        <div className="max-w-2xl mx-auto px-4 pt-4 flex items-center justify-between">
          <Link
            href="/copart"
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Analyze another lot
          </Link>
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-gray-300" />
            <ShareButton resultId={resultId} />
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

          {/* 1. Source badge */}
          <AuctionSourceBadge source={auction_source} lotNumber={lot.lot_number} />

          {/* 2. Vehicle header */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex gap-4 items-start">
            {photo && (
              <div className="relative w-24 h-16 shrink-0 rounded-xl overflow-hidden border border-gray-100">
                <Image src={photo} alt={vehicleTitle(lot)} fill className="object-cover" unoptimized />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{vehicleTitle(lot)}</h1>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                {lot.title_status && <span>Title: <span className="font-medium text-gray-700">{lot.title_status}</span></span>}
                {lot.odometer && <span>{lot.odometer.toLocaleString()} mi</span>}
                {lot.current_bid && <span>Bid: <span className="font-medium text-gray-700">{fmt(lot.current_bid)}</span></span>}
                {lot.vin && <span className="font-mono">VIN: {lot.vin}</span>}
              </div>
            </div>
          </div>

          {/* 3. AI Verdict */}
          <AuctionVerdictCard verdict={report.verdict} />

          {/* 4. Salvage risk score */}
          <SalvageRiskCard result={report.salvage_risk} dataSource="api" />

          {/* 5. Damage assessment */}
          <AuctionDamageCard classification={report.classification} />

          {/* 6. Recalls */}
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-gray-400" />
            {report.recalls.length > 0 ? (
              <span className="text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">
                {report.recalls.length} open recall{report.recalls.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-xs font-medium text-gray-500">No open recalls on record</span>
            )}
          </div>

          {/* 7. Arbitrage */}
          {report.arbitrage ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-800">Financial Arbitrage</h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  report.arbitrage.confidence === "high"
                    ? "bg-green-100 text-green-800 border-green-200"
                    : report.arbitrage.confidence === "medium"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-red-100 text-red-800 border-red-200"
                }`}>
                  {report.arbitrage.confidence} confidence
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {report.arbitrage.arv && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Market Value (ARV)</p>
                    <p className="text-base font-bold text-gray-900">{fmt(report.arbitrage.arv)}</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Repair Cost</p>
                  <p className="text-base font-bold text-gray-900">
                    {fmt(report.arbitrage.repair_cost_low)}–{fmt(report.arbitrage.repair_cost_high)}
                  </p>
                </div>
                {report.arbitrage.max_safe_bid && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Max Safe Bid</p>
                    <p className="text-base font-bold text-green-700">{fmt(report.arbitrage.max_safe_bid)}</p>
                  </div>
                )}
              </div>
              {report.arbitrage.caveats.length > 0 && (
                <ul className="space-y-1">
                  {report.arbitrage.caveats.slice(0, 3).map((c, i) => (
                    <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                      <span className="text-gray-300">·</span> {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {/* 8. Routine impact */}
          {report.routine_impact && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">EV Ownership Impact</h3>
              <p className="text-sm text-gray-700">{report.routine_impact.owner_summary}</p>
              {report.routine_impact.charging_risk && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                  <span className="font-semibold">Charging risk: </span>
                  {report.routine_impact.charging_risk}
                </p>
              )}
            </div>
          )}

          {/* 9. Email capture */}
          <EmailCaptureCard resultId={resultId} />

          {/* 10. Share nudge */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-900">Share this report</p>
              <p className="text-xs text-blue-600 mt-0.5">Send the link to your mechanic, partner, or bidding group.</p>
            </div>
            <ShareButton resultId={resultId} />
          </div>

          {/* 11. Save to Garage (authenticated) */}
          {isAuthenticated && (
            <div className="flex justify-center">
              <button
                onClick={handleSave}
                disabled={saveState !== "idle"}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  saveState === "saved"
                    ? "bg-green-100 text-green-700 border border-green-200 cursor-default"
                    : saveState === "error"
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : "bg-gray-900 text-white hover:bg-gray-700 shadow-sm"
                }`}
              >
                {saveState === "saving" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveState === "saved" ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
                {saveState === "saved" ? "Saved to Garage" : saveState === "error" ? "Save failed — retry?" : "Save to My Garage"}
              </button>
            </div>
          )}

          {/* 12. Analyze another */}
          <div className="text-center pb-4">
            <Link
              href="/copart"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-800 transition-colors"
            >
              Analyze another lot
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
