"use client";

import VehicleImage from "./VehicleImage";
import type { VehicleRecommendation } from "@/types/recommendations";

interface Props {
  recommendation: VehicleRecommendation;
  onSelect: () => void;
}

const badgeColors: Record<string, string> = {
  "Great Fit": "bg-green-600",
  "Good Fit": "bg-blue-600",
  "Mixed Fit": "bg-amber-500",
  "High Friction": "bg-red-500",
};

const fitColors: Record<string, { bg: string; text: string }> = {
  "Great Fit": { bg: "bg-green-50", text: "text-green-700" },
  "Good Fit": { bg: "bg-blue-50", text: "text-blue-700" },
  "Mixed Fit": { bg: "bg-amber-50", text: "text-amber-700" },
  "High Friction": { bg: "bg-red-50", text: "text-red-700" },
};

export default function RecommendationCardGrid({ recommendation: rec, onSelect }: Props) {
  const colors = fitColors[rec.fit_label] ?? fitColors["Good Fit"];
  const badgeBg = badgeColors[rec.fit_label] ?? "bg-blue-600";

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onSelect}
    >
      {/* Photo */}
      <div className="relative h-28 w-full">
        <VehicleImage
          make={rec.make}
          model={rec.model_short}
          year={rec.year}
          className="w-full h-full"
          imgClassName="w-full h-full object-cover"
        />
        <div className={`absolute top-2 left-2 ${badgeBg} text-white w-9 h-9 rounded-lg flex items-center justify-center shadow`}>
          <span className="text-sm font-bold">{rec.fit_score}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold text-gray-900 truncate">{rec.make} {rec.model_short}</p>
        <p className="text-xs text-gray-400 mb-2">{rec.year}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
          {rec.fit_label}
        </span>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-gray-500">
          <span>⚡ {rec.real_world_range_mi ?? rec.epa_range_mi ?? "—"} mi</span>
          {rec.incentive_new && <span className="text-green-600 font-medium">$7.5k credit</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="mt-3 w-full py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          See Full Report →
        </button>
      </div>
    </div>
  );
}
