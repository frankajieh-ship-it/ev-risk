"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { RoutineFitScore, OwnershipRiskFlags, MinimumViableRoutine, StressFlag } from "@/types/v2";
import { RoutineFitHeroBlock } from "./blocks/RoutineFitHeroBlock";
import { WhatBreaksFirstV2Block } from "./blocks/WhatBreaksFirstV2Block";
import { OwnershipRiskPanel } from "./blocks/OwnershipRiskPanel";

interface ResultPageV2Props {
  routineFit: RoutineFitScore;
  ownershipRisk: OwnershipRiskFlags;
  vehicle?: { make: string; model: string; year: number; mileage?: number };
  mvr: MinimumViableRoutine;
  dealerQuestions?: { top_3: string[]; full_list: string[]; walk_away_triggers: string[] };
  reportData?: Record<string, unknown>;
  onBack?: () => void;
}

const CONFIDENCE_CONFIG = {
  high: { label: "High confidence", color: "text-green-700", bg: "bg-green-100" },
  medium: { label: "Medium confidence", color: "text-yellow-700", bg: "bg-yellow-100" },
  low: { label: "Low confidence", color: "text-gray-700", bg: "bg-gray-100" },
} as const;

function StressFlagsList({ flags }: { flags: StressFlag[] }) {
  if (flags.length === 0) return null;

  const severityConfig = {
    high: { dot: "bg-red-500", text: "text-red-700" },
    medium: { dot: "bg-yellow-500", text: "text-yellow-700" },
    low: { dot: "bg-green-500", text: "text-green-700" },
  } as const;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        Stress flags
      </h3>
      {flags.map((flag) => {
        const config = severityConfig[flag.severity];
        return (
          <div key={flag.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100">
            <span className={`w-2 h-2 rounded-full ${config.dot} mt-1.5 flex-shrink-0`} />
            <div>
              <p className="text-sm font-medium text-gray-900">{flag.label}</p>
              <p className="text-xs text-gray-500 italic mt-0.5">{flag.routine_citation}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ResultPageV2({
  routineFit,
  ownershipRisk,
  vehicle,
  mvr,
  dealerQuestions,
  reportData,
  onBack,
}: ResultPageV2Props) {
  const [showDealerQuestions, setShowDealerQuestions] = useState(false);
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleDownloadPdf = async () => {
    if (!reportData) return;
    setPdfState("loading");
    try {
      const res = await fetch("/api/report/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportData }),
      });
      if (!res.ok) throw new Error("Failed to create report");
      const { reportId } = await res.json();

      const link = document.createElement("a");
      link.href = `/api/report/${reportId}/pdf`;
      const model = vehicle?.model?.replace(/\s+/g, "-") || "EV";
      link.download = `EV-Risk-${vehicle?.year || ""}-${model}-Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setPdfState("done");
    } catch {
      setPdfState("error");
    }
  };

  const confConfig = CONFIDENCE_CONFIG[routineFit.confidence.level];

  // Background gradient based on score
  const bgClass = routineFit.score_0_100 >= 65
    ? "from-green-50 via-white to-green-50"
    : routineFit.score_0_100 >= 45
    ? "from-yellow-50 via-white to-yellow-50"
    : "from-red-50 via-white to-red-50";

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgClass}`}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center text-gray-500 hover:text-gray-700 transition-colors text-sm mb-6"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            New Analysis
          </button>
        )}

        {/* ========== PRIMARY: ABOVE THE FOLD ========== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Hero Score */}
          <RoutineFitHeroBlock
            routineFit={routineFit}
            vehicle={vehicle ? { model: vehicle.model, year: vehicle.year } : undefined}
          />

          {/* What Breaks First */}
          <WhatBreaksFirstV2Block whatBreaksFirst={routineFit.what_breaks_first} />

          {/* Stress Flags */}
          <StressFlagsList flags={routineFit.stress_flags} />

          {/* Confidence */}
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${confConfig.bg} ${confConfig.color}`}>
              {confConfig.label}
            </span>
            <p className="text-xs text-gray-500">{routineFit.confidence.note}</p>
          </div>
        </motion.div>

        {/* ========== DIVIDER ========== */}
        <div className="my-10 border-t border-gray-200 relative">
          <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-xs text-gray-400 uppercase tracking-wider">
            Vehicle Details
          </span>
        </div>

        {/* ========== SECONDARY: OWNERSHIP RISK ========== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-6"
        >
          <OwnershipRiskPanel ownershipRisk={ownershipRisk} />

          {/* Dealer Questions (collapsible) */}
          {dealerQuestions && (
            <div>
              <button
                onClick={() => setShowDealerQuestions(!showDealerQuestions)}
                className="flex items-center justify-between w-full text-left p-4 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900">
                  Questions to Ask the Dealer
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${showDealerQuestions ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDealerQuestions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 space-y-4"
                >
                  {/* Top 3 */}
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <h4 className="text-xs font-semibold text-blue-800 uppercase mb-2">Priority Questions</h4>
                    <ol className="space-y-2">
                      {dealerQuestions.top_3.map((q, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-blue-500 font-bold">{i + 1}.</span>
                          {q}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Walk-Away Triggers */}
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <h4 className="text-xs font-semibold text-red-800 uppercase mb-2">Walk-Away Triggers</h4>
                    <ul className="space-y-1">
                      {dealerQuestions.walk_away_triggers.map((t, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-red-400">&#x2022;</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>

        {/* Download PDF */}
        {reportData && (
          <div className="mt-8 text-center">
            <button
              onClick={handleDownloadPdf}
              disabled={pdfState === "loading"}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {pdfState === "loading" ? "Generating PDF..." : pdfState === "done" ? "Downloaded!" : "Download PDF Report"}
            </button>
            {pdfState === "error" && (
              <p className="text-sm text-red-600 mt-2">Failed to generate PDF. Please try again.</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            Generated by EV-Risk&#8482; | This report is for informational purposes only
          </p>
        </div>
      </div>
    </div>
  );
}
