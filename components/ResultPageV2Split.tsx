"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { EvRiskReportV2Contract } from "@/types/v2-contract";
import { FitVerdictV2Block } from "./blocks/FitVerdictV2Block";
import { FallbackPlanV2Block } from "./blocks/FallbackPlanV2Block";
import { StressFlagsV2Block } from "./blocks/StressFlagsV2Block";
import { FollowupQuestionBlock } from "./blocks/FollowupQuestionBlock";
import { AppendixSection } from "./blocks/AppendixSection";
import SaveScenarioCTA from "./SaveScenarioCTA";

interface ResultPageV2SplitProps {
  contract: EvRiskReportV2Contract;
  trackEvent: (name: string, data?: Record<string, any>) => void;
  sessionId: string | null;
  onBack?: () => void;
}

export function ResultPageV2Split({
  contract,
  trackEvent,
  sessionId,
  onBack,
}: ResultPageV2SplitProps) {
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const { default_view, appendix, _internal } = contract;
  const vehicle = _internal.vehicle;

  // Background gradient based on verdict
  const bgClass =
    default_view.fit_verdict.label === "Good Fit"
      ? "from-green-50 via-white to-green-50"
      : default_view.fit_verdict.label === "Mixed Fit"
        ? "from-yellow-50 via-white to-yellow-50"
        : "from-red-50 via-white to-red-50";

  const handleDownloadPdf = async () => {
    setPdfState("loading");
    try {
      const res = await fetch("/api/report/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportData: contract }),
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

        {/* ========== DEFAULT VIEW (always visible) ========== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Fit Verdict */}
          <FitVerdictV2Block
            fitVerdict={default_view.fit_verdict}
            vehicle={vehicle ? { model: vehicle.model, year: vehicle.year } : undefined}
          />

          {/* Fallback Plan */}
          <FallbackPlanV2Block fallbackPlan={default_view.fallback_plan} />

          {/* Stress Flags (max 2) */}
          <StressFlagsV2Block flags={default_view.stress_flags} />

          {/* Follow-up Question */}
          <FollowupQuestionBlock question={default_view.one_followup_question} />

          {/* Save Scenario CTA — always in default view */}
          <SaveScenarioCTA
            sessionId={sessionId}
            vehicleModel={vehicle?.model || "Unknown"}
            vehicleYear={vehicle?.year || new Date().getFullYear()}
            fitSignal={default_view.fit_verdict.label}
            oneSentenceVerdict={default_view.fit_verdict.one_liner}
            inputs={{
              model: vehicle?.model,
              year: vehicle?.year,
              homeCharging: _internal.routine.charging_access === "home",
            }}
          />
        </motion.div>

        {/* ========== DIVIDER ========== */}
        <div className="my-10 border-t border-gray-200 relative">
          <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-xs text-gray-400 uppercase tracking-wider">
            Detailed Analysis
          </span>
        </div>

        {/* ========== APPENDIX (collapsed by default) ========== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <AppendixSection appendix={appendix} />
        </motion.div>

        {/* Download PDF */}
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
