/**
 * /auction/[resultId] — Shared Auction Result Page
 *
 * Shareable, bookmarkable result page for any auction analysis.
 * Fetches from GET /api/auction/result/[resultId].
 *
 * Free tier: salvage risk, damage assessment, verdict summary, recall count.
 * Paid tier: arbitrage (ARV, repair cost, max safe bid), routine impact.
 */

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  Bell,
  DollarSign,
  Bookmark,
  CheckCircle,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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

// ── Response type ─────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuctionResultPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const { isAuthenticated } = useAuth();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<AuctionResultApiResponse | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!resultId) return;

    fetch(`/api/auction/result/${resultId}`)
      .then((r) => r.json())
      .then((json: AuctionResultApiResponse) => {
        if (!json.success) {
          setPageState("error");
          return;
        }
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

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header variant="receipt" />
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

  if (pageState === "error" || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header variant="receipt" />
        <main className="flex-1 flex items-center justify-center">
          <div className="max-w-md mx-auto px-4 text-center space-y-4">
            <p className="text-lg font-semibold text-gray-800">Result not found or expired</p>
            <p className="text-sm text-gray-500">
              This auction analysis result was not found or has expired (analyses are cached for 24 hours).
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
      <Header variant="receipt" />
      <main className="flex-1">
      {/* Back link */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <Link
          href="/copart"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Analyze another lot
        </Link>
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

        {/* 6. Recall pill */}
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
        {report.arbitrage && (
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
        )}

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

        {/* 9. Save to Garage */}
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
              {saveState === "saved"
                ? "Saved to Garage"
                : saveState === "error"
                ? "Save failed — retry?"
                : "Save to My Garage"}
            </button>
          </div>
        )}

      </div>
      </main>
      <Footer />
    </div>
  );
}
