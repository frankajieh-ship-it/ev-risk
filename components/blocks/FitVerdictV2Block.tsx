"use client";

import type { FitVerdict } from "@/types/v2-contract";

interface FitVerdictV2BlockProps {
  fitVerdict: FitVerdict;
  vehicle?: { model: string; year: number };
}

const VERDICT_CONFIG = {
  "Great Fit": { color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  "Good Fit": { color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  "Mixed Fit": { color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
  "High Friction": { color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
} as const;

export function FitVerdictV2Block({ fitVerdict, vehicle }: FitVerdictV2BlockProps) {
  const config = VERDICT_CONFIG[fitVerdict.label as keyof typeof VERDICT_CONFIG] ?? VERDICT_CONFIG["Mixed Fit"];

  return (
    <div className={`p-6 rounded-2xl border-2 ${config.border} ${config.bg}`}>
      {vehicle && (
        <p className="text-sm text-gray-500 mb-2">
          {vehicle.year} {vehicle.model}
        </p>
      )}

      <h1 className={`text-3xl font-bold ${config.color} uppercase tracking-wide mb-3`}>
        {fitVerdict.label}
      </h1>

      <p className="text-base text-gray-700 leading-relaxed">
        {fitVerdict.one_liner}
      </p>

      <p className="text-xs text-gray-400 mt-4">
        This is a routine fit signal, not a purchase recommendation.
      </p>
    </div>
  );
}
