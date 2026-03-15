"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BreakPoint } from "@/types/v2";

interface WhatBreaksFirstV2BlockProps {
  breakpoints: BreakPoint[];
}

const IMPACT_COLORS = {
  High: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
  Medium: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" },
  Low: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
} as const;

function EvidenceChips({ evidence }: { evidence: BreakPoint["evidence"] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {evidence.map((ev, i) => (
        <span
          key={i}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
        >
          {ev.label}: {ev.value}
        </span>
      ))}
    </div>
  );
}

function PlanB({ planB }: { planB: BreakPoint["fallback_plan_b"] }) {
  return (
    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">
        Your fallback
      </p>
      <div className="space-y-1">
        <p className="text-xs text-gray-700">
          <span className="font-medium text-gray-900">Everyday plan:</span> {planB.anchor}
        </p>
        <p className="text-xs text-gray-700">
          <span className="font-medium text-gray-900">If that falls through:</span> {planB.backup}
        </p>
        <p className="text-xs text-gray-700">
          <span className="font-medium text-gray-900">Rule of thumb:</span> {planB.buffer_rule}
        </p>
      </div>
    </div>
  );
}

function ImpactBadge({ impact }: { impact: BreakPoint["impact"] }) {
  const config = IMPACT_COLORS[impact];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text} ${config.border} border`}>
      {impact}
    </span>
  );
}

export function WhatBreaksFirstV2Block({ breakpoints }: WhatBreaksFirstV2BlockProps) {
  const [showOthers, setShowOthers] = useState(false);

  if (breakpoints.length === 0) return null;

  const top = breakpoints[0];
  const others = breakpoints.slice(1);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        Where it gets tricky
      </h3>

      {/* Top breakpoint — always expanded */}
      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-red-500 text-lg font-bold mt-0.5 flex-shrink-0">1</span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{top.title}</p>
              <p className="text-sm text-gray-600 mt-1">{top.break_point}</p>
              <p className="text-xs text-gray-500 mt-1 italic">{top.trigger}</p>
            </div>
          </div>
          <ImpactBadge impact={top.impact} />
        </div>
        <EvidenceChips evidence={top.evidence} />
        <PlanB planB={top.fallback_plan_b} />
      </div>

      {/* Other breakpoints — collapsed */}
      {others.length > 0 && (
        <div>
          <button
            onClick={() => setShowOthers(!showOthers)}
            className="flex items-center justify-between w-full text-left px-4 py-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">
              Also worth knowing ({others.length})
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showOthers ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {showOthers && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-3 overflow-hidden"
              >
                {others.map((bp, i) => (
                  <div key={bp.id} className="p-4 bg-white rounded-xl border border-gray-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-yellow-500 text-lg font-bold mt-0.5 flex-shrink-0">
                          {i + 2}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">{bp.title}</p>
                          <p className="text-xs text-gray-500 mt-1 italic">{bp.trigger}</p>
                        </div>
                      </div>
                      <ImpactBadge impact={bp.impact} />
                    </div>
                    <EvidenceChips evidence={bp.evidence} />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
