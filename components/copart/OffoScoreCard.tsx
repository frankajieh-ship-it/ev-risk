"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { OffoScore } from "@/types/v2";

interface OffoScoreCardProps {
  offoScore: OffoScore;
}

const VERDICT_CONFIG = {
  green: {
    bgClass:     "bg-green-50",
    borderClass: "border-green-200",
    badgeClass:  "bg-green-100 text-green-800 border-green-200",
    barClass:    "bg-green-500",
    scoreClass:  "text-green-700",
    Icon:        CheckCircle,
    iconClass:   "text-green-600",
  },
  yellow: {
    bgClass:     "bg-amber-50",
    borderClass: "border-amber-200",
    badgeClass:  "bg-amber-100 text-amber-800 border-amber-200",
    barClass:    "bg-amber-500",
    scoreClass:  "text-amber-700",
    Icon:        AlertTriangle,
    iconClass:   "text-amber-600",
  },
  red: {
    bgClass:     "bg-red-50",
    borderClass: "border-red-200",
    badgeClass:  "bg-red-100 text-red-800 border-red-200",
    barClass:    "bg-red-500",
    scoreClass:  "text-red-700",
    Icon:        XCircle,
    iconClass:   "text-red-600",
  },
} as const;

const COMPONENT_LABELS: Record<keyof OffoScore["component_scores"], string> = {
  financial:   "Financial",
  usability:   "Daily Fit",
  feasibility: "Hardware",
  reliability: "Reliability",
};

export default function OffoScoreCard({ offoScore }: OffoScoreCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = VERDICT_CONFIG[offoScore.verdict];
  const { Icon } = cfg;

  return (
    <div className={`rounded-2xl border ${cfg.borderClass} ${cfg.bgClass} shadow-sm p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${cfg.iconClass} flex-shrink-0`} />
          <div>
            <h3 className="text-base font-bold text-gray-900">OFFO Score</h3>
            <p className="text-xs text-gray-500">Unified auction verdict</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-extrabold ${cfg.scoreClass}`}>
            {offoScore.offo_score}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badgeClass}`}>
            {offoScore.verdict_label}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${cfg.barClass}`}
          style={{ width: `${offoScore.offo_score}%` }}
        />
      </div>

      {/* Component scores */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(offoScore.component_scores) as Array<keyof typeof offoScore.component_scores>).map((key) => (
          <div key={key} className="rounded-xl bg-white border border-gray-100 p-2 text-center">
            <p className="text-[10px] text-gray-500 mb-0.5">{COMPONENT_LABELS[key]}</p>
            <p className="text-sm font-bold text-gray-900">{offoScore.component_scores[key]}</p>
          </div>
        ))}
      </div>

      {/* Why bullets */}
      <ul className="space-y-1.5">
        {offoScore.why.map((reason, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
            {reason}
          </li>
        ))}
      </ul>

      {/* Failure modes — collapsible */}
      {offoScore.failure_modes.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Hide" : "Show"} potential failure modes
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1.5 pt-2 border-t border-gray-100">
              {offoScore.failure_modes.map((mode, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  {mode}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Confidence footer */}
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">
        Confidence: {offoScore.confidence}
        {offoScore.context === "auction" && " · Auction formula (40% financial, 35% daily fit)"}
      </p>
    </div>
  );
}
