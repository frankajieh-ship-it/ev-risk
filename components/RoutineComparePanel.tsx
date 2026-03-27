"use client";

import Link from "next/link";
import type { VehicleRecommendation } from "@/types/recommendations";
import type { MinimumViableRoutine } from "@/types/v2";

const FIT_COLORS: Record<string, { badge: string; bar: string; score: string }> = {
  "Great Fit":    { badge: "bg-green-100 text-green-800 border-green-300",  bar: "bg-green-500",  score: "text-green-700" },
  "Good Fit":     { badge: "bg-blue-100 text-blue-800 border-blue-300",    bar: "bg-blue-500",   score: "text-blue-700"  },
  "Mixed Fit":    { badge: "bg-amber-100 text-amber-800 border-amber-300", bar: "bg-amber-500",  score: "text-amber-700" },
  "High Friction":{ badge: "bg-red-100 text-red-800 border-red-300",       bar: "bg-red-500",    score: "text-red-700"   },
};

const DIMENSION_LABELS: Record<string, string> = {
  charging: "Charging",
  range:    "Range",
  climate:  "Climate",
  budget:   "Budget",
  utility:  "Utility",
};

// Pick the 4 most decision-relevant dimensions given the user's routine
function getKeyDimensions(routine: MinimumViableRoutine): (keyof typeof DIMENSION_LABELS)[] {
  const dims: (keyof typeof DIMENSION_LABELS)[] = ["charging", "range", "climate"];
  if (routine.budget_max) dims.push("budget");
  else if (routine.towing_needs && routine.towing_needs !== "none") dims.push("utility");
  else dims.push("budget");
  return dims;
}

function DimensionBar({ label, score, barColor }: { label: string; score: number; barColor: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-700">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
}

function getBestForNote(rec: VehicleRecommendation, routine: MinimumViableRoutine): string {
  const dims = rec.dimensions;
  if (!dims) return `${rec.fit_label} for your routine`;

  const chargingLabel = routine.charging_access === "home"
    ? "home charging"
    : routine.charging_access === "work"
    ? "workplace charging"
    : "public charging";

  if (dims.range >= 85) return `Best range buffer for your ${chargingLabel} setup`;
  if (dims.charging >= 85) return `Lowest charging friction for ${chargingLabel}`;
  if (dims.climate >= 85 && routine.climate === "winter") return "Strong cold-weather range performance";
  if (dims.budget >= 85 && routine.budget_max) return "Best value within your budget";
  if (dims.utility >= 85 && routine.towing_needs) return "Handles your towing and utility needs";
  return `${rec.fit_label} across charging, range, and climate`;
}

interface RoutineComparePanelProps {
  vehicles: VehicleRecommendation[];
  routine: MinimumViableRoutine;
}

export default function RoutineComparePanel({ vehicles, routine }: RoutineComparePanelProps) {
  if (vehicles.length < 2) return null;

  const top = vehicles.slice(0, 3);
  const keyDims = getKeyDimensions(routine);
  const cols = top.length === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Side-by-side comparison</h3>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Top {top.length}</span>
      </div>

      <div className={`grid ${cols} gap-3`}>
        {top.map((rec, idx) => {
          const colors = FIT_COLORS[rec.fit_label] ?? FIT_COLORS["Mixed Fit"];
          const analyzeUrl = `/receipt?model=${encodeURIComponent(rec.model)}&year=${rec.year}&src=routine_compare`;

          return (
            <div
              key={rec.model}
              className={`rounded-2xl border bg-white p-4 flex flex-col gap-3 ${
                idx === 0 ? "border-blue-300 shadow-md" : "border-gray-200 shadow-sm"
              }`}
            >
              {/* Header */}
              <div>
                {idx === 0 && (
                  <span className="text-xs font-semibold text-blue-600 mb-1 block">#1 Pick</span>
                )}
                <p className="text-sm font-bold text-gray-900 leading-tight">{rec.year} {rec.model_short}</p>
                <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${colors.badge}`}>
                  {rec.fit_label}
                </span>
              </div>

              {/* Fit score */}
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${colors.score}`}>{rec.fit_score}</span>
                <span className="text-xs text-gray-400">/100</span>
              </div>

              {/* Key stats */}
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-500">Real-world range</span>
                  <span className="font-medium text-gray-800">{rec.real_world_range_mi} mi</span>
                </div>
                {routine.climate === "winter" && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Winter range</span>
                    <span className="font-medium text-blue-700">
                      ~{Math.round(rec.real_world_range_mi * (
                        routine.parking_exposure === "street"  ? 0.80 :
                        routine.parking_exposure === "outdoor" ? 0.85 : 0.88
                      ))} mi
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Battery</span>
                  <span className="font-medium text-gray-800">{rec.battery_kwh} kWh</span>
                </div>
                {rec.dc_fast_kw && rec.dc_fast_kw > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">10–80% charge</span>
                    <span className="font-medium text-gray-800">
                      ~{Math.round((0.70 * rec.battery_kwh / rec.dc_fast_kw) * 60)} min
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Fed. tax credit</span>
                  <span className={rec.incentive_new ? "font-medium text-green-700" : "font-medium text-gray-400"}>
                    {rec.incentive_new ? "Possible" : "—"}
                  </span>
                </div>
                {rec.ownership_cost_5y && rec.ownership_cost_5y.total > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">5-yr cost est.</span>
                    <span className="font-medium text-gray-800">
                      ${Math.round(rec.ownership_cost_5y.total / 1000)}k
                    </span>
                  </div>
                )}
              </div>

              {/* Dimension bars */}
              {rec.dimensions && (
                <div className="space-y-2 pt-1 border-t border-gray-100">
                  {keyDims.map((dim) => {
                    const score = rec.dimensions![dim as keyof typeof rec.dimensions] ?? 75;
                    return (
                      <DimensionBar
                        key={dim}
                        label={DIMENSION_LABELS[dim]}
                        score={score}
                        barColor={colors.bar}
                      />
                    );
                  })}
                </div>
              )}

              {/* Best for */}
              <p className="text-xs text-gray-500 italic leading-relaxed border-t border-gray-100 pt-2">
                {getBestForNote(rec, routine)}
              </p>

              {/* CTA */}
              <Link
                href={analyzeUrl}
                className="mt-auto block text-center py-2 px-3 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
              >
                Analyze a listing →
              </Link>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center mt-3">
        Scores reflect your routine — changing inputs updates rankings.
      </p>
    </div>
  );
}
