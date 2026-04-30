"use client";

import type { VehicleRecommendation } from "@/types/recommendations";

interface Props {
  recommendation: VehicleRecommendation;
  onSelect: () => void;
  rank?: number;
}

const badgeColors: Record<string, string> = {
  "Great Fit":    "bg-[#00a862]",
  "Good Fit":     "bg-[#00a862]",
  "Mixed Fit":    "bg-[#00a862]",
  "High Friction":"bg-[#00a862]",
};

export default function RecommendationCardList({ recommendation: rec, onSelect, rank }: Props) {
  const badgeBg = badgeColors[rec.fit_label] ?? "bg-blue-600";

  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-3 px-4 py-3 bg-[#161b22] rounded-xl border border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.04] transition-colors cursor-pointer"
    >
      {rank !== undefined && (
        <span className="text-xs text-white/30 w-5 shrink-0 text-center">#{rank}</span>
      )}
      <div className={`${badgeBg} text-white w-9 h-9 rounded-lg flex items-center justify-center shrink-0`}>
        <span className="text-sm font-bold">{rec.fit_score}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {rec.make} {rec.model_short}{" "}
          <span className="font-normal text-white/40">{rec.year}</span>
        </p>
        <p className="text-xs text-white/50">
          {rec.fit_label} · {rec.real_world_range_mi ?? rec.epa_range_mi ?? "—"} mi range
        </p>
      </div>
      {rec.incentive_new && (
        <span className="text-xs text-[#00d97e] font-medium shrink-0 hidden sm:block">$7.5k credit</span>
      )}
      <span className="text-xs text-[#00d97e] font-semibold shrink-0">View →</span>
    </div>
  );
}
