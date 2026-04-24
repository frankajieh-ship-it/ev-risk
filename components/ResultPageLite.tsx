"use client";

/**
 * ResultPageLite - Compressed Report View
 *
 * Design Principle: Web = orientation ("how will this feel")
 * Constraint: 6 blocks, 1.5 screen heights max
 *
 * Telemetry (P1):
 * - Scroll depth tracking
 * - Copy-to-clipboard usage
 * - "Did this feel accurate?" feedback
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { WebPresentation } from "@/types/presentation";
import {
  FitVerdictBlock,
  WhatBreaksFirstBlock,
  TopDriversBlock,
  PlanBBlock,
  ConfidenceBlock,
  YourSituationBlock,
  ConstraintContextBlock,
} from "./blocks";
import DecisionResolution from "./DecisionResolution";
import SaveScenarioCTA from "./SaveScenarioCTA";
import { useEventTracking } from "@/hooks/useEventTracking";

interface ResultPageLiteProps {
  presentation: WebPresentation;
  vehicleInfo: { year: number; model: string };
  onViewFullReport?: () => void;
  // Account Save Flow props
  scoringInputs?: {
    model?: string;
    year?: number;
    zipCode?: string;
    dailyMiles?: number;
    homeCharging?: boolean;
    riskTolerance?: string;
    constraintMultiplier?: number;
  };
}

export function ResultPageLite({
  presentation,
  vehicleInfo,
  onViewFullReport,
  scoringInputs,
}: ResultPageLiteProps) {
  const { trackEvent } = useEventTracking();
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxScrollDepth, setMaxScrollDepth] = useState(0);
  const [accuracyFeedback, setAccuracyFeedback] = useState<"up" | "down" | null>(null);
  const [showAppendix, setShowAppendix] = useState(false);
  const scrollTrackedRef = useRef<Set<number>>(new Set());

  // P1: Scroll depth tracking
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = Math.round((scrollTop / docHeight) * 100);

      // Track milestones: 25%, 50%, 75%, 100%
      const milestones = [25, 50, 75, 100];
      milestones.forEach((milestone) => {
        if (scrollPercent >= milestone && !scrollTrackedRef.current.has(milestone)) {
          scrollTrackedRef.current.add(milestone);
          trackEvent("scroll_depth_reached", {
            depth: milestone,
            page: "result_page_lite",
          });
        }
      });

      if (scrollPercent > maxScrollDepth) {
        setMaxScrollDepth(scrollPercent);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [maxScrollDepth, trackEvent]);

  // P1: Handle accuracy feedback
  const handleAccuracyFeedback = (feedback: "up" | "down") => {
    setAccuracyFeedback(feedback);
    trackEvent("accuracy_feedback", {
      feedback,
      fit_signal: presentation.fitSignal,
      page: "result_page_lite",
    });
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-2xl mx-auto px-4 py-8"
    >
      {/* Header - minimal */}
      <header className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {vehicleInfo.year} {vehicleInfo.model}
        </h1>
        <p className="text-sm text-gray-500 mt-1">EV Routine Check</p>
      </header>

      {/* Constraint Context Banner - P0: Shows before blocks if constraint detected */}
      {presentation.showConstraintContext && presentation.constraintContext && (
        <ConstraintContextBlock
          context={presentation.constraintContext}
          signals={presentation.constraintSignals || []}
          banner={presentation.constraintBanner}
        />
      )}

      {/* 6 Blocks */}
      <div className="space-y-5">
        {/* Block 1: Fit Verdict (ALWAYS visible) */}
        <div data-tutorial="fit-verdict">
        <FitVerdictBlock
          fitSignal={presentation.fitSignal}
          verdict={presentation.oneSentenceVerdict}
          mentalLoad={presentation.mentalLoadLabel}
        />
        </div>

        {/* P1: Your Situation - Share-first Reddit-native paragraph */}
        {presentation.yourSituationSummary && (
          <YourSituationBlock summary={presentation.yourSituationSummary} />
        )}

        {/* Block 2: What Breaks First (MAX 2 bullets - P0 Decision Card) */}
        <WhatBreaksFirstBlock items={presentation.whatBreaksFirst} />

        {/* Block 3: Top Drivers (MAX 2, no badges) */}
        <TopDriversBlock drivers={presentation.topDrivers} />

        {/* Block 4: Plan B (CONDITIONAL - only if fit !== Good) */}
        {presentation.showPlanB && <PlanBBlock items={presentation.planB} />}

        {/* Block 5: Confidence (single sentence) */}
        <div data-tutorial="confidence-score">
        <ConfidenceBlock
          level={presentation.confidenceLevel}
          summary={presentation.confidenceSummary}
        />
        </div>

        {/* P0: Stability Bullet for low-friction setups (shown in green) */}
        {presentation.stabilityBullet && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <span className="font-medium">✓</span> {presentation.stabilityBullet}
            </p>
          </div>
        )}

        {/* P0/P1: Conditional Friction Bullets (at most 1 of each, shown in amber) */}
        {(presentation.seasonalBullet ||
          presentation.predictabilityOneLiner ||
          presentation.planningToleranceBullet) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            {presentation.seasonalBullet && (
              <p className="text-sm text-amber-800">
                <span className="font-medium">❄️</span> {presentation.seasonalBullet}
              </p>
            )}
            {presentation.predictabilityOneLiner && (
              <p className="text-sm text-amber-800">
                <span className="font-medium">📍</span> {presentation.predictabilityOneLiner}
              </p>
            )}
            {presentation.planningToleranceBullet && (
              <p className="text-sm text-amber-800">
                <span className="font-medium">📋</span> {presentation.planningToleranceBullet}
              </p>
            )}
          </div>
        )}

        {/* Block 6: Decision Capture (MANDATORY) */}
        <DecisionResolution sessionId={presentation.sessionId} />

        {/* Save Scenario CTA - Account Save Flow */}
        <SaveScenarioCTA
          sessionId={presentation.sessionId}
          vehicleModel={vehicleInfo.model}
          vehicleYear={vehicleInfo.year}
          fitSignal={presentation.fitSignal}
          oneSentenceVerdict={presentation.oneSentenceVerdict}
          inputs={scoringInputs || {
            model: vehicleInfo.model,
            year: vehicleInfo.year,
          }}
        />

        {/* P1: "Did this feel accurate?" feedback - ground truth telemetry */}
        {!accuracyFeedback && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-gray-700 mb-3">Did this feel accurate?</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleAccuracyFeedback("up")}
                className="flex-1 py-2 rounded-lg border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all text-lg"
                aria-label="Yes, accurate"
              >
                👍
              </button>
              <button
                onClick={() => handleAccuracyFeedback("down")}
                className="flex-1 py-2 rounded-lg border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all text-lg"
                aria-label="No, not accurate"
              >
                👎
              </button>
            </div>
          </div>
        )}

        {/* Feedback thank you */}
        {accuracyFeedback && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center mt-4">
            <p className="text-sm text-green-800">Thanks for the feedback!</p>
          </div>
        )}

        {/* Appendix Toggle - "Want to dig deeper?" */}
        <div className="mt-4">
          <button
            onClick={() => {
              setShowAppendix(!showAppendix);
              if (!showAppendix) {
                trackEvent("appendix_expanded", { page: "result_page_lite" });
              }
            }}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${showAppendix ? "rotate-180" : ""}`}
            />
            📚 Want to dig deeper? Expand full details
          </button>

          {showAppendix && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4"
            >
              {/* Climate Assumptions */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Climate Assumptions</h4>
                <p className="text-xs text-gray-600">
                  Range estimates account for seasonal variation. Winter months may reduce
                  effective range by 20-40% depending on temperature and heating use.
                </p>
              </div>

              {/* Charging Pattern */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Charging Pattern</h4>
                <p className="text-xs text-gray-600">
                  Analysis assumes consistent weekly charging patterns. Disruptions
                  (travel, schedule changes, charger outages) may require adjustment.
                </p>
              </div>

              {/* Data Sources */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Data Sources</h4>
                <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                  <li>EPA range estimates adjusted for real-world conditions</li>
                  <li>Battery degradation models based on chemistry type</li>
                  <li>Local charger density from public charging databases</li>
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 italic">
                  This analysis is for informational purposes. Individual results vary
                  based on driving habits, climate, and vehicle condition.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* View Full Report CTA - P1: Reframed for negotiation/planning/peace of mind */}
      {onViewFullReport && (
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600 mb-4">
            Want the deeper analysis for negotiation, planning, or peace of mind?
          </p>
          <button
            onClick={onViewFullReport}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            View Full Report
          </button>
          <p className="text-xs text-gray-500 mt-2">
            For negotiation, long-term planning, and documentation
          </p>
        </div>
      )}

      {/* Footer Disclaimer */}
      <div className="mt-8 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          This report explains fit and uncertainty. It does not rate vehicles or
          recommend purchases.
        </p>
      </div>
    </motion.div>
  );
}
