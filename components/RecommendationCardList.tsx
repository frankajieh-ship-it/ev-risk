"use client";

import type { VehicleRecommendation } from "@/types/recommendations";

interface Props {
  recommendation: VehicleRecommendation;
  onSelect: () => void;
  rank?: number;
}

const badgeColors: Record<string, string> = {
  "Great Fit": "bg-green-600",
  "Good Fit": "bg-blue-600",
  "Mixed Fit": "bg-amber-500",
  "High Friction": "bg-red-500",
};

export default function RecommendationCardList({ recommendation: rec, onSelect, rank }: Props) {
  const badgeBg = badgeColors[rec.fit_label] ?? "bg-blue-600";

  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors cursor-pointer"
    >
      {rank !== undefined && (
        <span className="text-xs text-gray-400 w-5 shrink-0 text-center">#{rank}</span>
      )}
      <div className={`${badgeBg} text-white w-9 h-9 rounded-lg flex items-center justify-center shrink-0`}>
        <span className="text-sm font-bold">{rec.fit_score}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {rec.make} {rec.model_short}{" "}
          <span className="font-normal text-gray-400">{rec.year}</span>
        </p>
        <p className="text-xs text-gray-500">
          {rec.fit_label} · {rec.real_world_range_mi ?? rec.epa_range_mi ?? "—"} mi range
        </p>
      </div>
      {rec.incentive_new && (
        <span className="text-xs text-green-600 font-medium shrink-0 hidden sm:block">$7.5k credit</span>
      )}
      <span className="text-xs text-blue-600 font-semibold shrink-0">View →</span>
    </div>
  );
}
