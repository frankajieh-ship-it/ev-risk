"use client";

import type { FitVerdict } from "@/types/v2-contract";
import VehicleImage from "@/components/VehicleImage";

interface FitVerdictV2BlockProps {
  fitVerdict: FitVerdict;
  vehicle?: { make?: string; model: string; year: number };
}

const VERDICT_CONFIG = {
  "Great Fit":    { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
  "Good Fit":     { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
  "Mixed Fit":    { color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" },
  "High Friction":{ color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20"   },
} as const;

export function FitVerdictV2Block({ fitVerdict, vehicle }: FitVerdictV2BlockProps) {
  const config = VERDICT_CONFIG[fitVerdict.label as keyof typeof VERDICT_CONFIG] ?? VERDICT_CONFIG["Mixed Fit"];

  return (
    <div className={`rounded-2xl border-2 ${config.border} ${config.bg} overflow-hidden`}>
      {vehicle && (
        <VehicleImage
          make={vehicle.make}
          model={vehicle.model}
          year={vehicle.year}
          className="w-full h-40"
          imgClassName="w-full h-full object-cover"
        />
      )}
      <div className="p-6">
        {vehicle && (
          <p className="text-sm text-white/50 mb-2">
            {vehicle.year} {vehicle.model}
          </p>
        )}

        <h1 className={`text-3xl font-bold ${config.color} uppercase tracking-wide mb-3`}>
          {fitVerdict.label}
        </h1>

        <p className="text-base text-white/80 leading-relaxed">
          {fitVerdict.one_liner}
        </p>

        <p className="text-xs text-white/30 mt-4">
          This is a routine fit — not a verdict on whether to buy. It tells you how this car would slot into your actual life.
        </p>
      </div>
    </div>
  );
}
