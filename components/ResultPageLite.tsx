"use client";

/**
 * ResultPageLite - Compressed Report View
 *
 * Design Principle: Web = orientation ("how will this feel")
 * Constraint: 6 blocks, 1.5 screen heights max
 */

import { motion } from "framer-motion";
import type { WebPresentation } from "@/types/presentation";
import {
  FitVerdictBlock,
  WhatBreaksFirstBlock,
  TopDriversBlock,
  PlanBBlock,
  ConfidenceBlock,
} from "./blocks";
import DecisionResolution from "./DecisionResolution";

interface ResultPageLiteProps {
  presentation: WebPresentation;
  vehicleInfo: { year: number; model: string };
  onViewFullReport?: () => void;
}

export function ResultPageLite({
  presentation,
  vehicleInfo,
  onViewFullReport,
}: ResultPageLiteProps) {
  return (
    <motion.div
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

      {/* 6 Blocks */}
      <div className="space-y-5">
        {/* Block 1: Fit Verdict (ALWAYS visible) */}
        <FitVerdictBlock
          fitSignal={presentation.fitSignal}
          verdict={presentation.oneSentenceVerdict}
          mentalLoad={presentation.mentalLoadLabel}
        />

        {/* Block 2: What Breaks First (MAX 2 bullets - P0 Decision Card) */}
        <WhatBreaksFirstBlock items={presentation.whatBreaksFirst} />

        {/* Block 3: Top Drivers (MAX 2, no badges) */}
        <TopDriversBlock drivers={presentation.topDrivers} />

        {/* Block 4: Plan B (CONDITIONAL - only if fit !== Good) */}
        {presentation.showPlanB && <PlanBBlock items={presentation.planB} />}

        {/* Block 5: Confidence (single sentence) */}
        <ConfidenceBlock
          level={presentation.confidenceLevel}
          summary={presentation.confidenceSummary}
        />

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
