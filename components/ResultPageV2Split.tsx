"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { EvRiskReportV2Contract } from "@/types/v2-contract";
import { FitVerdictV2Block } from "./blocks/FitVerdictV2Block";
import { FallbackPlanV2Block } from "./blocks/FallbackPlanV2Block";
import { StressFlagsV2Block } from "./blocks/StressFlagsV2Block";
import { WhatBreaksFirstV2Block } from "./blocks/WhatBreaksFirstV2Block";
import { FollowupQuestionBlock } from "./blocks/FollowupQuestionBlock";
import { AppendixSection } from "./blocks/AppendixSection";
import { InputChipsBar } from "./blocks/InputChipsBar";
import SaveScenarioCTA from "./SaveScenarioCTA";
import { assignPriceVariant, getDisplayPrice } from "@/lib/price-assignment";

interface ResultPageV2SplitProps {
  contract: EvRiskReportV2Contract;
  trackEvent: (name: string, data?: Record<string, any>) => void;
  sessionId: string | null;
  onBack?: () => void;
  isUnlocked?: boolean;
  paymentsEnabled?: boolean;
  anonId?: string;
  reportId?: string | null;
  isPollingPayment?: boolean;
}

export function ResultPageV2Split({
  contract,
  trackEvent,
  sessionId,
  onBack,
  isUnlocked = false,
  paymentsEnabled = false,
  anonId = "",
  reportId = null,
  isPollingPayment = false,
}: ResultPageV2SplitProps) {
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const { default_view, appendix, _internal } = contract;
  const vehicle = _internal.vehicle;

  // Background gradient based on verdict
  const bgClass =
    default_view.fit_verdict.label === "Great Fit" || default_view.fit_verdict.label === "Good Fit"
      ? "from-green-50 via-white to-green-50"
      : default_view.fit_verdict.label === "Mixed Fit"
        ? "from-yellow-50 via-white to-yellow-50"
        : "from-red-50 via-white to-red-50";

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Resolve the report ID (from props or persisted)
  const effectiveReportId = reportId || (contract as any)._persisted_report_id || null;

  const handleDownloadPdf = async () => {
    // If payments enabled but not unlocked, redirect to checkout
    if (paymentsEnabled && !isUnlocked) {
      handleCheckout();
      return;
    }

    setPdfState("loading");
    try {
      let rId = effectiveReportId;
      if (!rId) {
        const res = await fetch("/api/report/free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportData: contract }),
        });
        if (!res.ok) throw new Error("Failed to create report");
        const data = await res.json();
        rId = data.reportId;
      }

      const link = document.createElement("a");
      link.href = `/api/report/${rId}/pdf`;
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

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      let rId = effectiveReportId;
      if (!rId) {
        const res = await fetch("/api/report/free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportData: contract }),
        });
        if (!res.ok) throw new Error("Failed to create report");
        const data = await res.json();
        rId = data.reportId;
      }

      // Save report data to sessionStorage for checkout return
      sessionStorage.setItem("evreport_checkout_data", JSON.stringify(contract));

      trackEvent("checkout_started", { report_id: rId, scenario_type: "evroutine" });

      const variant = assignPriceVariant(anonId, rId);
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_type: "evroutine",
          scenario_id: rId,
          anon_id: anonId,
          price_variant: variant,
          page_source: "report_page",
        }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      } else if (result.status === "paid") {
        window.location.reload();
      } else {
        alert(result.error || "Checkout failed. Please try again.");
      }
    } catch {
      alert("An error occurred. Please try again.");
    } finally {
      setCheckoutLoading(false);
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
            Back to routine
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
            vehicle={vehicle ? { make: vehicle.make || undefined, model: vehicle.model, year: vehicle.year } : undefined}
          />

          {/* Routine confidence note */}
          {default_view.confidence && (
            <p className="text-xs text-gray-400 -mt-4 ml-1">
              {default_view.confidence.routine_confidence_pct}% confidence — {default_view.confidence.routine_confidence_label.split(" — ")[1]}
            </p>
          )}

          {/* Input chips */}
          <InputChipsBar
            routine={_internal.routine}
            vehicle={vehicle ? { make: vehicle.make || "", model: vehicle.model, year: vehicle.year } : undefined}
          />

          {/* Fallback Plan */}
          <FallbackPlanV2Block fallbackPlan={default_view.fallback_plan} />

          {/* Stress Flags (max 2) */}
          <StressFlagsV2Block flags={default_view.stress_flags} />

          {/* What Breaks First */}
          {_internal.routine_fit.breakpoints_ranked.length > 0 && (
            <WhatBreaksFirstV2Block breakpoints={_internal.routine_fit.breakpoints_ranked} />
          )}

          {/* Follow-up Question */}
          <FollowupQuestionBlock question={default_view.one_followup_question} />

          {/* Ownership confidence note */}
          {default_view.confidence && default_view.confidence.ownership_confidence_pct < 85 && (
            <p className="text-xs text-gray-500 ml-1 -mt-4">
              Vehicle data confidence: {default_view.confidence.ownership_confidence_pct}% — {default_view.confidence.ownership_confidence_label.split(" — ")[1]}
            </p>
          )}

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

        {/* Payment polling indicator */}
        {isPollingPayment && (
          <div className="text-center py-3 px-4 bg-blue-50 rounded-xl text-sm text-blue-700 animate-pulse">
            Confirming your payment...
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
