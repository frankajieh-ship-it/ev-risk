/**
 * /copart/batch — Batch Lot Analysis
 *
 * Dealers paste 1–10 lot numbers (one per line), pick a source (Copart/IAAI),
 * and get a ranked comparison table sorted by OFFO score.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Layers,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import type { AuctionEvalReport, AuctionSource } from "@/lib/auction/types";

interface BatchResultItem {
  lot_index: number;
  lot_number: string | null;
  status: "ok" | "error";
  report?: AuctionEvalReport;
  error?: string;
}

interface BatchResponse {
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  results: BatchResultItem[];
  error?: string;
}

function scoreColor(score: number | undefined) {
  if (score === undefined) return "text-gray-400";
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-500";
}

function scoreBg(score: number | undefined) {
  if (score === undefined) return "bg-gray-100";
  if (score >= 70) return "bg-green-50";
  if (score >= 40) return "bg-yellow-50";
  return "bg-red-50";
}

function VerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict) return <span className="text-xs text-gray-400">—</span>;
  const color =
    verdict === "GREEN" ? "bg-green-100 text-green-700" :
    verdict === "YELLOW" ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {verdict}
    </span>
  );
}

export default function BatchAnalysisPage() {
  const [source, setSource] = useState<AuctionSource>("copart");
  const [lotsText, setLotsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lotLines = lotsText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const handleAnalyze = async () => {
    if (lotLines.length === 0) return;
    if (lotLines.length > 10) {
      setError("Maximum 10 lots per batch");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    const receiptToken = getOrCreateReceiptToken();
    const lots = lotLines.map((ln) => ({
      lot_number: ln,
      auction_source: source,
    }));

    try {
      const res = await fetch("/api/auction/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lots, receipt_token: receiptToken }),
      });
      const data: BatchResponse = await res.json();
      if (!data.success) {
        setError(data.error ?? "Batch analysis failed");
        return;
      }
      setResponse(data);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/copart" className="hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Single Lot
          </Link>
          <span>·</span>
          <span className="text-gray-800 font-medium flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Batch Analysis
          </span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Batch Lot Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Analyze up to 10 lots at once. Results ranked by OFFO score — best buys at the top.
          </p>
        </div>

        {/* Input card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex flex-wrap gap-4 mb-4">
            {/* Source selector */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Auction Source</label>
              <div className="flex gap-2">
                {(["copart", "iaai"] as AuctionSource[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors capitalize ${
                      source === s
                        ? "bg-green-600 border-green-600 text-white"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {s === "copart" ? "Copart" : "IAAI"}
                  </button>
                ))}
              </div>
            </div>

            {/* Lot count indicator */}
            <div className="flex items-end">
              <span className={`text-sm font-medium ${lotLines.length > 10 ? "text-red-600" : "text-gray-500"}`}>
                {lotLines.length}/10 lots
              </span>
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">
              Lot Numbers — one per line
            </label>
            <textarea
              value={lotsText}
              onChange={(e) => setLotsText(e.target.value)}
              placeholder={"73524891\n73891234\n74102938"}
              rows={6}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 font-mono resize-none"
            />
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || lotLines.length === 0 || lotLines.length > 10}
            className="mt-4 w-full py-3 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing {lotLines.length} lot{lotLines.length !== 1 ? "s" : ""}...
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" />
                Analyze {lotLines.length > 0 ? `${lotLines.length} lot${lotLines.length !== 1 ? "s" : ""}` : "lots"}
              </>
            )}
          </button>

          {loading && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Each lot goes through the full OFFO evaluation pipeline — this may take 20–60 seconds.
            </p>
          )}
        </div>

        {/* Results */}
        {response && (
          <div>
            {/* Summary bar */}
            <div className="flex items-center gap-4 mb-4 text-sm">
              <span className="text-gray-600 font-medium">{response.total} lots analyzed</span>
              {response.succeeded > 0 && (
                <span className="flex items-center gap-1 text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  {response.succeeded} succeeded
                </span>
              )}
              {response.failed > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />
                  {response.failed} failed
                </span>
              )}
              <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sorted by OFFO score
              </span>
            </div>

            {/* Comparison table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">#</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Lot</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Vehicle</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs">OFFO Score</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs">Verdict</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Current Bid</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Max Safe Bid</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Title</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {response.results.map((item, rank) => {
                      if (item.status === "error") {
                        return (
                          <tr key={item.lot_index} className="bg-red-50/40">
                            <td className="px-4 py-3 text-gray-400 text-xs">{rank + 1}</td>
                            <td className="px-4 py-3 font-mono text-sm text-gray-600">{item.lot_number ?? "—"}</td>
                            <td colSpan={7} className="px-4 py-3 text-sm text-red-600 flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5" />
                              {item.error}
                            </td>
                          </tr>
                        );
                      }

                      const r = item.report!;
                      const score = r.offo_score?.offo_score;
                      const lot = r.lot;
                      const arb = r.arbitrage;
                      const vehicle = [lot.year, lot.make, lot.model].filter(Boolean).join(" ") || "Unknown";
                      const maxSafeBid = arb?.max_safe_bid;
                      const currentBid = lot.current_bid;

                      return (
                        <tr key={item.lot_index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400">{rank + 1}</td>
                          <td className="px-4 py-3 font-mono text-sm text-gray-700">{lot.lot_number}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 text-sm">{vehicle}</p>
                            {lot.trim && <p className="text-xs text-gray-400">{lot.trim}</p>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {score !== undefined ? (
                              <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold ${scoreBg(score)} ${scoreColor(score)}`}>
                                {score}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <VerdictBadge verdict={r.offo_score?.verdict} />
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">
                            {currentBid != null ? `$${currentBid.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium">
                            {maxSafeBid != null ? (
                              <span className={maxSafeBid >= (currentBid ?? 0) ? "text-green-700" : "text-red-600"}>
                                ${maxSafeBid.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {lot.title_status ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/auction/${r.report_id}`}
                              className="p-1.5 text-gray-300 hover:text-green-600 transition-colors inline-flex"
                              title="View full report"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-400 text-center">
              Click any row&apos;s arrow to open the full evaluation report.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
