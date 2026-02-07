"use client";

import type { RoutineFitScore } from "@/types/v2";

interface RoutineFitHeroBlockProps {
  routineFit: RoutineFitScore;
  vehicle?: { model: string; year: number };
}

const LABEL_CONFIG = {
  "Great Fit": { color: "text-green-600", bg: "bg-green-50", border: "border-green-200", ring: "ring-green-500" },
  "Good Fit": { color: "text-green-600", bg: "bg-green-50", border: "border-green-200", ring: "ring-green-500" },
  "Mixed Fit": { color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", ring: "ring-yellow-500" },
  "High Friction": { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", ring: "ring-red-500" },
} as const;

const MENTAL_LOAD_CONFIG = {
  low: { label: "Low mental overhead", color: "text-green-700", bg: "bg-green-100" },
  medium: { label: "Ongoing planning required", color: "text-yellow-700", bg: "bg-yellow-100" },
  high: { label: "Frequent attention required", color: "text-red-700", bg: "bg-red-100" },
} as const;

export function RoutineFitHeroBlock({ routineFit, vehicle }: RoutineFitHeroBlockProps) {
  const config = LABEL_CONFIG[routineFit.label];
  const mlConfig = MENTAL_LOAD_CONFIG[routineFit.mental_load];

  return (
    <div className={`p-6 rounded-2xl border-2 ${config.border} ${config.bg}`}>
      {/* Vehicle context */}
      {vehicle && (
        <p className="text-sm text-gray-500 mb-2">
          {vehicle.year} {vehicle.model}
        </p>
      )}

      {/* Score + Label */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className={`text-5xl font-bold ${config.color}`}>
          {routineFit.score_0_100}
        </span>
        <span className="text-lg text-gray-400 font-medium">/100</span>
        <span className={`text-lg font-bold ${config.color} uppercase tracking-wide`}>
          {routineFit.label}
        </span>
      </div>

      {/* Mental Load Pill */}
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${mlConfig.bg} ${mlConfig.color}`}>
        {mlConfig.label}
      </span>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-4">
        This is a routine fit signal, not a purchase recommendation.
      </p>
    </div>
  );
}
