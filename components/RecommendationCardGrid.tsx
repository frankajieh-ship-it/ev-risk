"use client";

import VehicleImage from "./VehicleImage";
import type { VehicleRecommendation } from "@/types/recommendations";

interface Props {
  recommendation: VehicleRecommendation;
  onSelect: () => void;
}

const badgeColors: Record<string, string> = {
  "Great Fit":    "bg-[#00a862]",
  "Good Fit":     "bg-[#00a862]",
  "Mixed Fit":    "bg-[#00a862]",
  "High Friction":"bg-[#00a862]",
};

const fitColors: Record<string, { bg: string; text: string }> = {
  "Great Fit":    { bg: "bg-[#00d97e]/15", text: "text-[#00d97e]" },
  "Good Fit":     { bg: "bg-[#00d97e]/15", text: "text-[#00d97e]" },
  "Mixed Fit":    { bg: "bg-[#00d97e]/15", text: "text-[#00d97e]" },
  "High Friction":{ bg: "bg-[#00d97e]/15", text: "text-[#00d97e]" },
};

export default function RecommendationCardGrid({ recommendation: rec, onSelect }: Props) {
  const colors = fitColors[rec.fit_label] ?? fitColors["Good Fit"];
  const badgeBg = badgeColors[rec.fit_label] ?? "bg-blue-600";

  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-[#161b22] overflow-hidden hover:border-white/[0.16] transition-colors cursor-pointer"
      onClick={onSelect}
    >
      {/* Photo */}
      <div className="relative h-36 w-full">
        <VehicleImage
          make={rec.make}
          model={rec.model_short}
          year={rec.year}
          className="w-full h-full"
          imgClassName="w-full h-full object-contain"
        />
        <div className={`absolute top-2 left-2 ${badgeBg} text-white w-9 h-9 rounded-lg flex items-center justify-center shadow`}>
          <span className="text-sm font-bold">{rec.fit_score}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold text-white truncate">{rec.make} {rec.model_short}</p>
        <p className="text-xs text-white/40 mb-2">{rec.year}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
          {rec.fit_label}
        </span>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-white/50">
          <span>⚡ {rec.real_world_range_mi ?? rec.epa_range_mi ?? "—"} mi</span>
          {rec.incentive_new && <span className="text-[#00d97e] font-medium">$7.5k credit</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="mt-3 w-full py-1.5 text-xs font-semibold text-[#00d97e] border border-[#00d97e]/30 rounded-lg hover:bg-[#00d97e]/10 transition-colors"
        >
          See Full Report →
        </button>
      </div>
    </div>
  );
}
