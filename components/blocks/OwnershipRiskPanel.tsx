"use client";

import { useState } from "react";
import type { OwnershipRiskFlags, OwnershipRiskModule } from "@/types/v2";

interface OwnershipRiskPanelProps {
  ownershipRisk: OwnershipRiskFlags;
}

const STATUS_CONFIG = {
  green: { dot: "bg-green-500", bg: "bg-green-50", border: "border-green-200", label: "Low" },
  yellow: { dot: "bg-yellow-500", bg: "bg-yellow-50", border: "border-yellow-200", label: "Medium" },
  red: { dot: "bg-red-500", bg: "bg-red-50", border: "border-red-200", label: "High" },
  unknown: { dot: "bg-gray-400", bg: "bg-gray-50", border: "border-gray-200", label: "Unknown" },
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
            <span className="font-semibold text-gray-900 text-sm">{module.label}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              module.status === "unknown" ? "bg-gray-200 text-gray-600" :
              module.status === "green" ? "bg-green-200 text-green-700" :
              module.status === "yellow" ? "bg-yellow-200 text-yellow-700" :
              "bg-red-200 text-red-700"
            }`}>
              {config.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate">{module.summary}</p>
        </div>
        {module.detail && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
      {expanded && module.detail && (
        <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-200">
          {module.detail}
        </p>
      )}
    </button>
  );
}

export function OwnershipRiskPanel({ ownershipRisk }: OwnershipRiskPanelProps) {
  const overallConfig = {
    "Low Risk": { color: "text-green-700", bg: "bg-green-100" },
    "Moderate Risk": { color: "text-yellow-700", bg: "bg-yellow-100" },
    "High Risk": { color: "text-red-700", bg: "bg-red-100" },
    "Insufficient Data": { color: "text-gray-700", bg: "bg-gray-100" },
  }[ownershipRisk.overall_risk_label];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Ownership Risk
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
