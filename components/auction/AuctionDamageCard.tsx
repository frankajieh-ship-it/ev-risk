"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { ClassificationOutput } from "@/lib/auction/auction-ai-chain";

interface AuctionDamageCardProps {
  classification: ClassificationOutput | null;
}

const SEVERITY_CONFIG = {
  minor: { label: "Minor", className: "bg-green-100 text-green-800 border-green-200" },
  moderate: { label: "Moderate", className: "bg-amber-100 text-amber-800 border-amber-200" },
  severe: { label: "Severe", className: "bg-red-100 text-red-800 border-red-200" },
  total_loss: { label: "Total Loss", className: "bg-red-200 text-red-900 border-red-300 font-bold" },
} as const;

const RISK_CONFIG = {
  low: { label: "Low Risk", className: "bg-green-100 text-green-800 border-green-200" },
  medium: { label: "Medium Risk", className: "bg-amber-100 text-amber-800 border-amber-200" },
  high: { label: "High Risk", className: "bg-red-100 text-red-800 border-red-200" },
  extreme: { label: "Extreme Risk", className: "bg-red-200 text-red-900 border-red-300 font-bold" },
} as const;

export default function AuctionDamageCard({ classification }: AuctionDamageCardProps) {
  if (!classification) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-sm text-gray-400 italic">Damage assessment unavailable for this lot.</p>
      </div>
    );
  }

  const severity = SEVERITY_CONFIG[classification.damage_severity] ?? SEVERITY_CONFIG.moderate;
  const risk = RISK_CONFIG[classification.bid_risk_level] ?? RISK_CONFIG.medium;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-800">Damage Assessment</h3>
      </div>

      {/* Damage tone + badges */}
      <div className="space-y-2">
        <p className="text-base font-semibold text-gray-900">{classification.damage_tone}</p>
        <div className="flex flex-wrap gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${severity.className}`}>
            {severity.label}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${risk.className}`}>
            {risk.label}
          </span>
        </div>
      </div>

      {/* Title risk summary */}
      {classification.title_risk_summary && (
        <p className="text-sm text-gray-700">{classification.title_risk_summary}</p>
      )}

      {/* Red flags */}
      {classification.red_flags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Red Flags</p>
          <ul className="space-y-1">
            {classification.red_flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
