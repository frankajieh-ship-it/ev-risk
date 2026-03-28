"use client";

import { AlertTriangle, CheckCircle, XCircle, SearchCheck } from "lucide-react";
import type { PolishOutput } from "@/lib/auction/auction-ai-chain";

interface AuctionVerdictCardProps {
  verdict: PolishOutput | null;
}

const ACTION_CONFIG = {
  bid: {
    label: "Bid",
    className: "bg-green-100 text-green-800 border-green-200",
    Icon: CheckCircle,
    iconClass: "text-green-600",
  },
  inspect_first: {
    label: "Inspect First",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    Icon: SearchCheck,
    iconClass: "text-amber-600",
  },
  avoid: {
    label: "Avoid",
    className: "bg-red-100 text-red-800 border-red-200",
    Icon: XCircle,
    iconClass: "text-red-600",
  },
} as const;

export default function AuctionVerdictCard({ verdict }: AuctionVerdictCardProps) {
  if (!verdict) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-sm text-gray-400 italic">Analysis verdict unavailable for this lot.</p>
      </div>
    );
  }

  const action = ACTION_CONFIG[verdict.recommended_action] ?? ACTION_CONFIG.inspect_first;
  const { Icon } = action;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900 leading-snug flex-1">
          {verdict.headline}
        </h2>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${action.className}`}
        >
          <Icon className={`w-3.5 h-3.5 ${action.iconClass}`} />
          {action.label}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-700 leading-relaxed">{verdict.summary}</p>

      {/* Top risks */}
      {verdict.top_risks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Top Risks</p>
          <ol className="space-y-1">
            {verdict.top_risks.slice(0, 3).map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                {risk}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
