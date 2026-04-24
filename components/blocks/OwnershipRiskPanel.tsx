"use client";

import { useState } from "react";
import type { OwnershipRiskFlags, OwnershipRiskModule } from "@/types/v2";

interface OwnershipRiskPanelProps {
  ownershipRisk: OwnershipRiskFlags;
}

const STATUS_CONFIG = {
  green: { dot: "bg-green-500", bg: "bg-green-500/10", border: "border-green-500/25", label: "Low" },
  yellow: { dot: "bg-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/25", label: "Medium" },
  red: { dot: "bg-red-500", bg: "bg-red-500/10", border: "border-red-500/25", label: "High" },
  unknown: { dot: "bg-white/40", bg: "bg-white/[0.04]", border: "border-white/[0.08]", label: "Unknown" },
} as const;

function ModuleCard({ module }: { module: OwnershipRiskModule }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[module.status];

  return (
    <button
      onClick={() => module.detail && setExpanded(!expanded)}
      className={`w-full text-left p-4 rounded-xl border ${config.border} ${config.bg} transition-all hover:shadow-sm`}
    >
      <div className="flex items-center gap-3">
        <span className={`w-3 h-3 rounded-full ${config.dot} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white text-sm">{module.label}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              module.status === "unknown" ? "bg-white/[0.08] text-white/50" :
              module.status === "green" ? "bg-green-500/20 text-green-400" :
              module.status === "yellow" ? "bg-yellow-500/20 text-yellow-400" :
              "bg-red-500/20 text-red-400"
            }`}>
              {config.label}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1 truncate">{module.summary}</p>
        </div>
        {module.detail && (
          <svg
            className={`w-4 h-4 text-white/40 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
      {expanded && module.detail && (
        <p className="text-xs text-white/60 mt-3 pt-3 border-t border-white/[0.08]">
          {module.detail}
        </p>
      )}
    </button>
  );
}

export function OwnershipRiskPanel({ ownershipRisk }: OwnershipRiskPanelProps) {
  const overallConfig = {
    "Low ownership friction": { color: "text-green-400", bg: "bg-green-500/15" },
    "Moderate ownership friction": { color: "text-yellow-400", bg: "bg-yellow-500/15" },
    "High ownership friction": { color: "text-red-400", bg: "bg-red-500/15" },
    "Insufficient data": { color: "text-white/50", bg: "bg-white/[0.08]" },
  }[ownershipRisk.overall_risk_label];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
          Ownership Friction
        </h3>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${overallConfig.bg} ${overallConfig.color}`}>
          {ownershipRisk.overall_risk_label}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ownershipRisk.modules.map((module) => (
          <ModuleCard key={module.module_id} module={module} />
        ))}
      </div>
    </div>
  );
}
